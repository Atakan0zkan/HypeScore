import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runSmokeChecks, MONITOR_USER_AGENT } from "../tools/smoke-test.js";
import { monitorProduction, createGithubClient, CONFIRM_DELAY_MS } from "../tools/production-monitor.mjs";
import { waitForWorkerBuild } from "../tools/wait-for-worker-build.mjs";
import { loadWorkerContext, memoryCache, scoreboardResponse } from "./helpers.mjs";

const ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const date = "2026-10-16T12:00:00.000Z";
const json = value => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const healthy = () => ({ ok: true, checks: [{ name: "GET /live-matches", status: "ok" }] });
const unhealthy = (name = "GET /live-matches", code = "HTTP_502") => ({ ok: false, checks: [{ name, status: "failed", code }] });
const emptyLive = () => ({ matches: [], leagues: ["fifa.world", "uefa.nations", "uefa.euro", "conmebol.america",
  ...Array.from({ length: 28 }, (_, i) => `league.${i}`)].map(code => ({ code, name: code, matches: [] })) });
function fixtureFetch(url) {
  const path = new URL(url).pathname;
  if (path === "/live-matches") return json(emptyLive());
  if (path === "/league-standings") return json({ leagueCode: "esp.1", standings: [] });
  if (path === "/tournament-bracket") return json({ leagueCode: "fifa.world", seasonYear: 2030, dates: "2030", rounds: [] });
  throw new Error("Unexpected fixture request");
}

describe("production smoke probes", () => {
  it("labels every request as monitoring, preserves endpoint queries and accepts genuine empty data", async () => {
    const calls = [];
    const report = await runSmokeChecks({ fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return fixtureFetch(url);
    } });
    assert.equal(report.ok, true);
    assert.equal(report.checks.at(-1).status, "skipped");
    assert.equal(calls.length, 3);
    for (const { url, init } of calls) {
      assert.equal(url.searchParams.get("client"), "monitor");
      assert.equal(init.headers["User-Agent"], MONITOR_USER_AGENT);
      assert.equal(init.headers.Origin, ORIGIN);
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.redirect, "error");
    }
    assert.equal(calls[1].url.searchParams.get("leagueCode"), "esp.1");
    assert.equal(calls[2].url.searchParams.get("season"), "2030");
  });
  it("keeps checking other features after a failed scoreboard and never fetches an arbitrary detail", async () => {
    const calls = [];
    const report = await runSmokeChecks({ fetchImpl: async url => {
      calls.push(new URL(url).pathname);
      return calls.length === 1 ? new Response("Down", { status: 502 }) : fixtureFetch(url);
    } });
    assert.equal(report.ok, false);
    assert.equal(report.checks[0].code, "HTTP_502");
    assert.deepEqual(calls, ["/live-matches", "/league-standings", "/tournament-bracket"]);
  });
  it("rejects non-JSON and invalid successful responses", async () => {
    for (const response of [() => new Response("HTML"), () => json({}), () => json({ matches: [], leagues: [] })]) {
      const report = await runSmokeChecks({ fetchImpl: async url => new URL(url).pathname === "/live-matches" ? response() : fixtureFetch(url) });
      assert.equal(report.ok, false);
      assert.equal(report.checks[0].status, "failed");
    }
  });
  it("keeps the deadline active through body consumption", async () => {
    const report = await runSmokeChecks({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => ({
      ok: true, headers: new Headers({ "Content-Type": "application/json" }),
      json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true })),
    }) });
    assert.equal(report.ok, false);
    assert.equal(report.checks[0].code, "TIMEOUT");
  });
  it("rejects credential-bearing or nonlocal insecure base URLs before fetching", async () => {
    for (const baseUrl of ["https://user:password@example.com", "http://example.com", "https://example.com?token=private"]) {
      await assert.rejects(runSmokeChecks({ baseUrl, fetchImpl: () => { throw new Error("must not fetch"); } }), /Invalid Worker base URL/);
    }
  });
});

function fakeGithub() {
  let issue = null;
  const writes = [];
  return {
    writes,
    get issue() { return issue; },
    findIncident: async () => issue?.state === "open" ? issue : null,
    createIssue: async body => {
      writes.push({ method: "create", ...body });
      issue = { number: 12, state: "open", created_at: date, ...body };
      return issue;
    },
    updateIssue: async (number, body) => { writes.push({ method: "update", number, ...body }); Object.assign(issue, body); return issue; },
  };
}
function scenario(reports, github = fakeGithub()) {
  let probes = 0;
  const delays = [];
  return { github, delays, get probes() { return probes; }, run: () => monitorProduction({ github,
    runChecks: async () => reports[Math.min(probes++, reports.length - 1)],
    sleep: async ms => delays.push(ms), now: () => date,
  }) };
}

describe("availability incident lifecycle", () => {
  it("does nothing on a healthy API and uses only one probe", async () => {
    const test = scenario([healthy()]);
    assert.equal((await test.run()).state, "healthy");
    assert.equal(test.probes, 1);
    assert.deepEqual(test.github.writes, []);
    assert.deepEqual(test.delays, []);
  });
  it("confirms a transient failure before deciding not to open an issue", async () => {
    const test = scenario([unhealthy(), healthy()]);
    assert.equal((await test.run()).state, "transient-recovered");
    assert.deepEqual(test.delays, [CONFIRM_DELAY_MS]);
    assert.equal(test.github.writes.length, 0);
  });
  it("opens one issue for repeated failures and suppresses unchanged updates", async () => {
    const test = scenario([unhealthy()]);
    assert.equal((await test.run()).state, "incident-opened");
    assert.equal((await test.run()).state, "incident-ongoing");
    assert.equal(test.github.writes.length, 1);
    assert.match(test.github.issue.body, /HTTP_502/);
  });
  it("updates changed evidence and preserves owner notes outside its section", async () => {
    const github = fakeGithub();
    await scenario([unhealthy()], github).run();
    github.issue.body += "\nOwner notes must remain.";
    await scenario([unhealthy("GET /live-matches", "TIMEOUT")], github).run();
    assert.equal(github.writes.length, 2);
    assert.match(github.issue.body, /TIMEOUT/);
    assert.match(github.issue.body, /Owner notes must remain/);
  });
  it("repairs malformed incident metadata once instead of editing every schedule", async () => {
    const github = fakeGithub();
    await scenario([unhealthy()], github).run();
    github.issue.created_at = "2026-10-16T12:00:00Z";
    github.issue.body = github.issue.body.replace(/<!-- hype-state:[^\n]+ -->/, '<!-- hype-state:{"signature":"invalid","firstSeen":"untrusted text"} -->');
    await scenario([unhealthy()], github).run();
    await scenario([unhealthy()], github).run();
    assert.equal(github.writes.length, 2);
    assert.ok(!github.issue.body.includes("untrusted text"));
  });
  it("closes the same issue only after two healthy probes", async () => {
    const github = fakeGithub();
    await scenario([unhealthy()], github).run();
    const result = await scenario([healthy()], github).run();
    assert.equal(result.state, "recovered");
    assert.equal(result.issue, 12);
    assert.equal(github.issue.state, "closed");
    assert.match(github.issue.body, /Two consecutive healthy checks/);
    await scenario([healthy()], github).run();
    assert.equal(github.writes.length, 2);
  });
  it("keeps the incident open after just one healthy confirmation", async () => {
    const github = fakeGithub();
    await scenario([unhealthy()], github).run();
    assert.equal((await scenario([unhealthy(), healthy()], github).run()).state, "awaiting-recovery-confirmation");
    assert.equal(github.issue.state, "open");
    assert.equal(github.writes.length, 1);
  });
  it("does not call unrelated one-off feature failures a confirmed incident", async () => {
    const test = scenario([unhealthy(), unhealthy("GET /league-standings")]);
    assert.equal((await test.run()).state, "unconfirmed");
    assert.equal(test.github.writes.length, 0);
  });
  it("has a read-only local mode without a GitHub client", async () => {
    const result = await monitorProduction({ runChecks: async () => unhealthy(), sleep: async () => {} });
    assert.equal(result.state, "confirmed-outage");
    assert.equal(result.ok, false);
  });
});

describe("least-privilege GitHub incident transport", () => {
  it("only finds marked bot-owned issues, not user issues or pull requests", async () => {
    const github = fakeGithub();
    await scenario([unhealthy()], github).run();
    const calls = [];
    const client = createGithubClient({ token: "unit-test-token", repository: "owner/repo", fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return json([
        { number: 1, body: github.issue.body, user: { login: "owner" } },
        { number: 2, body: github.issue.body, user: { login: "github-actions[bot]" }, pull_request: {} },
        { number: 3, body: "unrelated", user: { login: "github-actions[bot]" } },
        { number: 4, body: github.issue.body, user: { login: "github-actions[bot]" } },
      ]);
    } });
    assert.equal((await client.findIncident()).number, 4);
    assert.ok(calls.every(call => new URL(call.url).origin === "https://api.github.com"));
    assert.equal(calls[0].init.redirect, "error");
  });
  it("bounds pagination and refuses to create duplicates if the scan is incomplete", async () => {
    let calls = 0;
    const client = createGithubClient({ token: "unit-test-token", repository: "owner/repo", fetchImpl: async () => {
      calls += 1; return json(Array.from({ length: 100 }, () => ({ body: "unrelated" })));
    } });
    await assert.rejects(client.findIncident(), /scan limit/);
    assert.equal(calls, 5);
  });
  it("writes only issue endpoints and never includes tokens in errors", async () => {
    const calls = [];
    const client = createGithubClient({ token: "unit-test-token", repository: "owner/repo", assignee: "owner", fetchImpl: async (url, init) => {
      calls.push({ url, init }); return json({ number: 12 });
    } });
    await client.createIssue({ title: "Availability", body: "Test fixture" });
    await client.updateIssue(12, { state: "closed" });
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].init.body).assignees, ["owner"]);
    assert.equal(calls[1].init.method, "PATCH");
    assert.throws(() => client.updateIssue(-1, {}), /Invalid issue number/);
    const failing = createGithubClient({ token: "unit-test-token", repository: "owner/repo",
      fetchImpl: async () => new Response("Sensitive response content", { status: 403 }) });
    await assert.rejects(failing.findIncident(), error => error.message === "GitHub incident API returned HTTP 403");
  });
});

describe("deployment-aware live checks", () => {
  it("waits for the exact commit's Cloudflare check instead of testing an older build", async () => {
    let clock = 0;
    let calls = 0;
    const sha = "a".repeat(40);
    await waitForWorkerBuild({ repository: "owner/repo", sha, token: "unit-test-token",
      now: () => clock, sleep: async ms => { clock += ms; }, pollMs: 10,
      fetchImpl: async () => {
        calls += 1;
        return json({ check_runs: [{ name: "Workers Builds: live-score-football", head_sha: calls === 1 ? "b".repeat(40) : sha,
          status: calls < 3 ? "in_progress" : "completed", conclusion: calls < 3 ? null : "success" }] });
      },
    });
    assert.equal(calls, 3);
    assert.equal(clock, 20);
  });
  it("fails visibly on a failed or missing build rather than probing old production", async () => {
    const options = { repository: "owner/repo", sha: "a".repeat(40), token: "unit-test-token" };
    await assert.rejects(waitForWorkerBuild({ ...options, fetchImpl: async () => json({ check_runs: [{
      name: "Workers Builds: live-score-football", head_sha: options.sha, status: "completed", conclusion: "failure",
    }] }) }), /did not succeed/);
    let clock = 0;
    await assert.rejects(waitForWorkerBuild({ ...options, timeoutMs: 20, pollMs: 10,
      now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async () => json({ check_runs: [] }),
    }), /Timed out/);
    assert.equal(clock, 20);
  });
});

describe("Cloudflare health cron and analytics separation", () => {
  it("runs the normal fallback/cache path without writing product usage", async () => {
    const points = [];
    const { run } = await loadWorkerContext({ fetch: async () => scoreboardResponse([]),
      caches: { default: memoryCache() }, globals: { TEST_ENV: { USAGE_ANALYTICS: { writeDataPoint: point => points.push(point) } } } });
    await run("__workerDefault.scheduled({}, TEST_ENV)");
    assert.equal(points.length, 0);
  });
  it("reports a real provider outage as a failed cron invocation", async () => {
    const { run } = await loadWorkerContext({ fetch: async () => new Response("Unavailable", { status: 503 }) });
    await assert.rejects(run("__workerDefault.scheduled({}, {})"), /HTTP 502/);
  });
  it("excludes labeled external probes but still enforces origin policy and counts extension usage", async () => {
    const points = [];
    const { run } = await loadWorkerContext({ fetch: async () => scoreboardResponse([]),
      caches: { default: memoryCache() }, globals: { TEST_ENV: { USAGE_ANALYTICS: { writeDataPoint: point => points.push(point) } } } });
    const request = (client, origin, ua = MONITOR_USER_AGENT) => run(`__workerDefault.fetch(new Request("https://api.atakanozkan.com/live-matches?client=${client}",
      {headers:{Origin:${JSON.stringify(origin)},"User-Agent":${JSON.stringify(ua)}}}), TEST_ENV)`);
    assert.equal((await request("monitor", ORIGIN)).status, 200);
    assert.equal(points.length, 0);
    assert.equal((await request("extension", ORIGIN)).status, 200);
    assert.equal(points.length, 1);
    assert.equal((await request("monitor", "https://untrusted.example")).status, 403);
    assert.equal(points.length, 2);
    assert.equal((await request("monitor", ORIGIN, "ordinary-browser")).status, 200);
    assert.equal(points.length, 3, "a query label alone is insufficient");
  });
});

describe("production monitoring workflow guards", () => {
  it("schedules both layers, serializes incident writers and does not grant code-write permissions", async () => {
    const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const workflow = await read(".github/workflows/production-health.yml");
    const daily = await read(".github/workflows/daily-test.yml");
    const config = JSON.parse(await read("wrangler.jsonc"));
    assert.deepEqual(config.triggers.crons, ["*/5 * * * *"]);
    assert.match(workflow, /2-59\/5 \* \* \* \*/);
    for (const text of [workflow, daily]) {
      assert.match(text, /group: production-availability/);
      assert.match(text, /issues: write/);
      assert.match(text, /github.repository == 'Atakan0zkan\/HypeScore'/);
      assert.ok(!text.includes("contents: write"));
      assert.ok(!text.includes("pull-requests: write"));
      assert.ok(!text.includes("gh pr merge"));
    }
    const live = daily.split("  live-smoke:")[1].split("  e2e:")[0];
    assert.ok(!live.includes("continue-on-error"));
    assert.match(live, /wait-for-worker-build/);
    assert.match(live, /production-monitor.mjs --manage-incidents/);
    assert.ok(!workflow.includes("pull_request"));
  });
});
