import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
describe("daily validation and supply-chain guards", () => {
  it("pins every remote workflow action and keeps test checkouts credential-free", async () => {
    for (const path of ["daily-test.yml", "production-health.yml", "keepalive.yml"]) {
      const text = await read(`.github/workflows/${path}`);
      for (const match of text.matchAll(/^\s*- uses:\s+([^\s#]+)/gm)) {
        assert.match(match[1], /@[a-f0-9]{40}$/, `${path}: mutable action reference`);
      }
      if (path !== "keepalive.yml") {
        const checkouts = [...text.matchAll(/uses: actions\/checkout@/g)].length;
        assert.equal([...text.matchAll(/persist-credentials: false/g)].length, checkouts, `${path}: no checkout token left in Git config`);
      }
    }
  });

  it("runs deterministic security/coverage checks daily without an unpinned AI agent", async () => {
    const text = await read(".github/workflows/daily-test.yml");
    assert.match(text, /cron: "0 4 \* \* \*"/);
    assert.match(text, /npm run security:check/);
    assert.match(text, /npm run test:coverage/);
    assert.match(text, /tools\/report-test-failure.mjs/);
    assert.ok(!text.includes("anomalyco/opencode"));
    assert.ok(!text.includes("OPENCODE_API_KEY"));
    assert.ok(!text.includes("pull_request_target"));
    assert.ok(!text.includes("contents: write"));
  });

  it("retains browser failure evidence and refuses accidentally focused tests in CI", async () => {
    const workflow = await read(".github/workflows/daily-test.yml");
    const config = await read("playwright.config.mjs");
    const suite = await read("tests/e2e/popup.spec.js");
    assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
    assert.match(workflow, /retention-days: 7/);
    assert.match(config, /forbidOnly:/);
    assert.match(suite, /tracing\.start/);
    assert.match(suite, /tracing\.stop/);
    assert.match(suite, /testInfo\.status !== testInfo\.expectedStatus/);
  });
});
