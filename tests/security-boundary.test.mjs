import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, loadPopupContext, memoryCache, scoreboardResponse, espnEvent } from "./helpers.mjs";

const ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const BASE = "https://api.atakanozkan.com";
const req = (path, extra = {}) => new Request(BASE + path, { headers: { Origin: ORIGIN, ...extra } });

describe("public API security boundaries", () => {
  it("does not return upstream diagnostics or configuration details to public callers", async () => {
    const { ctx, run } = await loadWorkerContext({ fetch: async () => { throw new Error("private-upstream-diagnostic"); } });
    for (const path of ["/live-matches", "/league-standings?leagueCode=eng.1"]) {
      ctx.request = req(path);
      const response = await run("__workerDefault.fetch(request, {})");
      assert.equal(response.status, 502);
      const body = await response.text();
      assert.ok(!body.includes("private-upstream-diagnostic"));
      assert.ok(!body.includes("THESPORTSDB_API_KEY"));
      assert.ok(!body.includes('"details"'));
    }
  });

  it("turns unexpected request failures into a generic no-store 500 without a stack", async () => {
    const { ctx, run } = await loadWorkerContext({ caches: { default: {
      match: async () => { throw new Error("private-cache-diagnostic"); }, put: async () => {},
    } } });
    ctx.request = req("/league-standings?leagueCode=eng.1");
    const response = await run("__workerDefault.fetch(request, {})");
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Request could not be completed" });
  });

  it("rejects oversized request URLs and ambiguous duplicate parameters before any upstream call", async () => {
    let calls = 0;
    const { ctx, run } = await loadWorkerContext({ fetch: async () => { calls++; return scoreboardResponse([]); } });
    for (const [path, status] of [
      ["/live-matches?padding=" + "a".repeat(2200), 414],
      ["/league-standings?leagueCode=eng.1&leagueCode=esp.1", 400],
      ["/match-detail?leagueCode=eng.1&eventId=123&eventId=456", 400],
    ]) {
      ctx.request = req(path);
      assert.equal((await run("handleRequest(request, {})")).status, status);
    }
    assert.equal(calls, 0);
  });

  it("rejects non-origin extension URLs while keeping real unpacked origins compatible", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run(`isChromeExtensionOrigin("chrome-extension://${"a".repeat(32)}")`), true);
    for (const suffix of ["/path", "?secret=value", "#fragment", ":443"]) {
      assert.equal(run(`isChromeExtensionOrigin(${JSON.stringify(ORIGIN + suffix)})`), false, suffix);
    }
    assert.equal(run(`isChromeExtensionOrigin("chrome-extension://user@${"a".repeat(32)}")`), false);
  });

  it("enforces the deployed limiter before fetching and does not exempt spoofable monitor labels", async () => {
    let upstreamCalls = 0;
    const keys = [];
    const points = [];
    const env = {
      API_RATE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: false }; } },
      USAGE_ANALYTICS: { writeDataPoint: point => points.push(point) },
    };
    const { ctx, run } = await loadWorkerContext({ fetch: async () => { upstreamCalls++; return scoreboardResponse([]); } });
    ctx.env = env;
    ctx.request = req("/live-matches?client=monitor", {
      "CF-Connecting-IP": "192.0.2.10", "User-Agent": "HypeScore-HealthMonitor/1.0",
    });
    const response = await run("__workerDefault.fetch(request, env)");
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(upstreamCalls, 0);
    assert.equal(keys.length, 1);
    assert.ok(!JSON.stringify(points).includes("192.0.2.10"), "rate-limit keys never enter product analytics");
  });

  it("keeps preflight and internal cron independent of IP counters and remains available on limiter errors", async () => {
    let limits = 0;
    const { ctx, run } = await loadWorkerContext({ caches: { default: memoryCache() },
      fetch: async () => scoreboardResponse([espnEvent()]) });
    ctx.env = { API_RATE_LIMITER: { limit: async () => { limits++; throw new Error("limiter-unavailable"); } } };
    ctx.request = new Request(BASE + "/live-matches", { method: "OPTIONS", headers: { Origin: ORIGIN, "CF-Connecting-IP": "192.0.2.10" } });
    assert.equal((await run("handleRequest(request, env)")).status, 204);
    assert.equal(limits, 0);
    ctx.request = req("/live-matches", { "CF-Connecting-IP": "192.0.2.10" });
    assert.equal((await run("handleRequest(request, env)")).status, 200);
    assert.equal(limits, 1);
    ctx.request = req("/live-matches");
    assert.equal((await run("handleRequest(request, env)")).status, 200);
    assert.equal(limits, 1, "internal calls without a connecting IP do not share a global anonymous bucket");
  });

  it("serves restrictive document headers on errors and successful JSON", async () => {
    const { ctx, run } = await loadWorkerContext();
    ctx.request = req("/not-a-real-route");
    const response = await run("handleRequest(request, {})");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.match(response.headers.get("Content-Security-Policy") || "", /default-src 'none'/);
    assert.match(response.headers.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
  });
});

describe("upstream and rendered-link boundaries", () => {
  it("never follows provider redirects with credential-bearing headers", async () => {
    const calls = [];
    const { run } = await loadWorkerContext({ fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: 302, headers: { Location: "https://untrusted.example/collect" } });
    } });
    await assert.rejects(run('fetchJson(THESPORTSDB_LIVE_SCORE_URL, {redirect:"follow",headers:{"X-API-KEY":"test-only-key"}})'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.redirect, "manual");
  });

  it("refuses non-pinned upstream destinations without issuing a request", async () => {
    let calls = 0;
    const { run } = await loadWorkerContext({ fetch: async () => { calls++; return scoreboardResponse([]); } });
    for (const url of ["https://127.0.0.1/private", "https://site.api.espn.com.evil.test/apis/", "http://site.api.espn.com/apis/", "https://user:password@site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard"]) {
      await assert.rejects(run(`fetchJson(${JSON.stringify(url)})`));
    }
    assert.equal(calls, 0);
  });

  it("rejects oversized declared and streamed JSON bodies without parsing them", async () => {
    for (const mode of ["declared", "streamed"]) {
      let cancelled = false;
      const response = () => mode === "declared"
        ? new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "100000000" } })
        : new Response(new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); },
          cancel() { cancelled = true; },
        }), { headers: { "Content-Type": "application/json" } });
      const { run } = await loadWorkerContext({ fetch: async () => response() });
      await assert.rejects(run("fetchJson(ESPN_SCOREBOARD_URL)"), /size limit/);
      if (mode === "streamed") assert.equal(cancelled, true);
    }
  });

  it("never accepts a valid JSON prefix when the body is cancelled before EOF", async () => {
    let cancelled = false;
    const { run } = await loadWorkerContext({ fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("{}")); },
      cancel() { cancelled = true; },
    }), { headers: { "Content-Type": "application/json" } }) });
    run("globalThis.bodyCaller = new AbortController()");
    const pending = run("fetchJson(ESPN_SCOREBOARD_URL, {signal:bodyCaller.signal})");
    const rejected = assert.rejects(pending, { name: "AbortError" });
    await new Promise(setImmediate);
    run("bodyCaller.abort()");
    await rejected;
    assert.equal(cancelled, true);
  });

  it("rejects credential-bearing media and external links in both Worker and popup", async () => {
    const worker = await loadWorkerContext();
    const popup = await loadPopupContext();
    for (const url of ["https://user:password@www.espn.com/story", "https://www.espn.com:444/story"]) {
      assert.equal(worker.run(`safeHttpsUrl(${JSON.stringify(url)}, ["espn.com"])`), null);
      assert.equal(popup.run(`sanitizeExternalUrl(${JSON.stringify(url)}, ["espn.com"])`), "");
    }
    assert.equal(popup.run('sanitizeExternalUrl("https://www.espn.com/story", ["espn.com"])'), "https://www.espn.com/story");
  });
});
