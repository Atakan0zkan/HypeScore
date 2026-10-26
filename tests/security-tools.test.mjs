import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { findSecrets, isPrivateProjectPath, findMutableActions, runSecurityChecks } from "../tools/security-check.mjs";
import { reportTestResults } from "../tools/report-test-failure.mjs";

describe("safe deterministic security checks", () => {
  it("reports secret types and line numbers without returning secret values", () => {
    const token = "cfat_" + "a".repeat(48);
    const found = findSecrets(`ordinary\nvalue=${token}\n`, "example.txt");
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 2);
    assert.ok(!JSON.stringify(found).includes(token));
    assert.equal(findSecrets('const token = process.env.CLOUDFLARE_API_TOKEN;', "file.js").length, 0);
  });
  it("prevents private memory, local env and release output from becoming tracked", () => {
    for (const file of [".ecc/memory/project/notes/x.md", ".codex/config.toml", ".agents/skills/x/SKILL.md", "memory-bank/active.md", ".dev.vars", ".env.local", "dist/release.zip"]) {
      assert.equal(isPrivateProjectPath(file), true, file);
    }
    for (const file of [".env.example", "extension/popup.js", "docs/RELEASE.md"]) assert.equal(isPrivateProjectPath(file), false);
  });
  it("requires immutable remote actions without treating comments as workflows", () => {
    assert.equal(findMutableActions('- uses: actions/checkout@v7', 'a.yml').length, 1);
    assert.equal(findMutableActions('- uses: actions/checkout@' + 'a'.repeat(40), 'a.yml').length, 0);
    assert.equal(findMutableActions('# - uses: arbitrary/action@main', 'a.yml').length, 0);
  });
  it("scans a real Git worktree and history without disclosing a detected value", () => {
    const root = mkdtempSync(join(tmpdir(), "hype-security-check-"));
    const git = args => execFileSync("git", args, { cwd: root, stdio: "pipe", windowsHide: true });
    try {
      git(["init", "--quiet"]);
      git(["config", "user.name", "Fixture"]);
      git(["config", "user.email", "fixture@example.invalid"]);
      const fake = "cfat_" + "a".repeat(48);
      writeFileSync(join(root, "example.txt"), fake);
      git(["add", "example.txt"]);
      git(["commit", "--quiet", "-m", "Fixture"]);
      const current = runSecurityChecks({ root });
      assert.equal(current.ok, false);
      assert.equal(current.findings[0].kind, "Cloudflare token");
      assert.ok(!JSON.stringify(current).includes(fake));
      writeFileSync(join(root, "example.txt"), "ordinary text");
      assert.equal(runSecurityChecks({ root }).ok, true);
      const historical = runSecurityChecks({ root, history: true });
      assert.equal(historical.ok, false);
      assert.equal(historical.historyCommits, 1);
      assert.equal(historical.findings[0].kind, "suspected secret in historical snapshot");
      assert.ok(!JSON.stringify(historical).includes(fake));
    } finally {
      assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()));
      assert.ok(basename(root).startsWith("hype-security-check-"));
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("daily failure reporting without AI or raw logs", () => {
  const marker = "<!-- hype-daily-test:v1 -->";
  const options = { repository: "owner/repo", runId: "12345", token: "test-only-token" };
  function transport(issues = []) {
    const calls = [];
    return { calls, fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(init.method === "GET" ? issues : { number: 7 }),
        { status: 200, headers: { "content-type": "application/json" } });
    } };
  }
  it("does nothing on healthy runs without an existing incident", async () => {
    const api = transport();
    const result = await reportTestResults({ ...options, ...api, results: { offline: "success", e2e: "success" } });
    assert.equal(result.state, "healthy");
    assert.equal(api.calls.length, 1);
  });
  it("opens only a run-link summary and never reads or publishes raw job logs", async () => {
    const api = transport();
    const result = await reportTestResults({ ...options, ...api, results: { offline: "failure", e2e: "success" } });
    assert.equal(result.state, "opened");
    assert.equal(api.calls[1].init.method, "POST");
    const body = JSON.parse(api.calls[1].init.body).body;
    assert.ok(body.includes(marker));
    assert.ok(body.includes("https://github.com/owner/repo/actions/runs/12345"));
    assert.ok(!JSON.stringify(api.calls).includes("/logs"));
    assert.ok(!body.includes(options.token));
  });
  it("closes only its own bot-authored issue after both checks recover", async () => {
    const issue = { number: 7, title: "[daily-test] Automated validation failed", body: marker, user: { login: "github-actions[bot]" } };
    const api = transport([issue]);
    assert.equal((await reportTestResults({ ...options, ...api, results: { offline: "success", e2e: "success" } })).state, "closed");
    assert.equal(JSON.parse(api.calls[1].init.body).state, "closed");
    const human = transport([{ ...issue, user: { login: "owner" } }]);
    assert.equal((await reportTestResults({ ...options, ...human, results: { offline: "success", e2e: "success" } })).state, "healthy");
    assert.equal(human.calls.length, 1);
  });
  it("rejects malformed context before making a request and defers incomplete checks", async () => {
    const api = transport();
    await assert.rejects(reportTestResults({ ...options, ...api, repository: "owner/repo/../other", results: {} }));
    assert.equal(api.calls.length, 0);
    assert.equal((await reportTestResults({ ...options, ...api, results: { offline: "cancelled", e2e: "skipped" } })).state, "deferred");
    assert.equal(api.calls.length, 0);
  });
  it("updates one owned incident, suppresses the same run and omits tokens from transport errors", async () => {
    const issue = { number: 7, title: "[daily-test] Automated validation failed", body: marker, user: { login: "github-actions[bot]" } };
    const changed = transport([issue]);
    assert.equal((await reportTestResults({ ...options, ...changed, results: { offline: "success", e2e: "failure" } })).state, "updated");
    assert.equal(changed.calls[1].init.method, "PATCH");
    const unchanged = transport([{ ...issue, body: marker + " https://github.com/owner/repo/actions/runs/12345" }]);
    assert.equal((await reportTestResults({ ...options, ...unchanged, results: { offline: "failure", e2e: "failure" } })).state, "unchanged");
    assert.equal(unchanged.calls.length, 1);
    await assert.rejects(reportTestResults({ ...options, results: { offline: "failure", e2e: "success" },
      fetchImpl: async () => new Response("untrusted-body", { status: 403 }),
    }), error => error.message.includes("HTTP 403") && !error.message.includes(options.token));
    await assert.rejects(reportTestResults({ ...options, ...transport(), results: { offline: "invented", e2e: "success" } }));
  });
  it("refuses duplicate reports when five full inventory pages cannot establish completeness", async () => {
    let calls = 0;
    await assert.rejects(reportTestResults({ ...options, results: { offline: "failure", e2e: "success" },
      fetchImpl: async (_url, init) => {
        calls++;
        assert.equal(init.method, "GET");
        return new Response(JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ number: index + 1, title: "Human issue" }))));
      },
    }), /inventory incomplete/);
    assert.equal(calls, 5);
  });
});
