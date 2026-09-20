import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, ROOT), "utf8");

describe("static release guards (regression watchlist as code)", () => {
  it("manifest/package versions + minimal permissions", async () => {
    const manifest = JSON.parse(await read("extension/manifest.json"));
    const pkg = JSON.parse(await read("package.json"));
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, []);
    assert.deepEqual(manifest.host_permissions, ["https://api.atakanozkan.com/*"]);
    const csp = manifest.content_security_policy.extension_pages;
    assert.ok(csp.includes("connect-src https://api.atakanozkan.com"));
    assert.ok(!csp.includes("unsafe-"), "no unsafe-* in CSP");
    assert.ok(!csp.includes("http:"), "no plain http in CSP");
  });

  it("no injection / eval primitives in runtime", async () => {
    const popup = await read("extension/popup.js");
    const worker = await read("worker/index.js");
    for (const [name, src] of [["popup", popup], ["worker", worker]]) {
      for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"]) {
        assert.ok(!src.includes(bad), `${name} contains ${bad}`);
      }
    }
    for (const bad of ["eval(", "new Function("]) {
      assert.ok(!popup.includes(bad), `popup contains ${bad}`);
      assert.ok(!worker.includes(bad), `worker contains ${bad}`);
    }
  });

  it("no fixed 15s refresh, no 100vh root collapse", async () => {
    const popup = await read("extension/popup.js");
    const css = await read("extension/popup.css");
    assert.ok(!popup.includes("15000"), "15s loop must not return");
    assert.ok(!/100vh/.test(css), "100vh collapses MV3 popup");
  });

  it("locale parity fast (en count == all others, msg keys covered)", async () => {
    const dir = new URL("extension/_locales/", ROOT);
    const locales = (await readdir(dir)).filter((d) => !d.startsWith("."));
    assert.ok(locales.length >= 50, `locales=${locales.length}`);
    const en = JSON.parse(await read("extension/_locales/en/messages.json"));
    const enKeys = Object.keys(en);
    assert.ok(enKeys.length >= 80, `en keys=${enKeys.length}`);
    for (const loc of locales) {
      const m = JSON.parse(await read(`extension/_locales/${loc}/messages.json`));
      assert.equal(Object.keys(m).length, enKeys.length, loc);
    }
    const popup = await read("extension/popup.js");
    const used = new Set([...popup.matchAll(/msg\(\s*["']([A-Za-z0-9_]+)["']/g)].map((x) => x[1]));
    for (const k of used) {
      assert.ok(k in en || k === "extName" || k === "extDescription", `msg key missing: ${k}`);
    }
  });

  it("32 packaged league logos present", async () => {
    const { readdir: rd } = await import("node:fs/promises");
    const files = await rd(new URL("extension/icons/leagues/", ROOT));
    const pngs = files.filter((f) => f.endsWith(".png"));
    assert.equal(pngs.length, 32, pngs.join(",").slice(0, 200));
  });

  it("popup.html ids match popup.js lookups", async () => {
    const html = await read("extension/popup.html");
    const popup = await read("extension/popup.js");
    const ids = [...new Set([...popup.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]))];
    assert.ok(ids.length > 5, `lookups=${ids.length}`);
    // statusBar was intentionally removed from the header; setStatus() is a
    // defensive no-op when the element is absent (memory-bank UI pattern).
    const REMOVED_BY_DESIGN = new Set(["statusBar"]);
    for (const id of ids) {
      if (REMOVED_BY_DESIGN.has(id)) continue;
      assert.ok(html.includes(`id="${id}"`), `popup.html missing #${id}`);
    }
  });

  it("wrangler config keeps Worker name + analytics binding", async () => {
    const raw = await read("wrangler.jsonc");
    const stripped = raw.replace(/\/\/.*$/gm, "");
    const cfg = JSON.parse(stripped);
    assert.equal(cfg.name, "live-score-football");
    const bindings = JSON.stringify(cfg.analytics_engine_datasets || cfg.bindings || cfg);
    assert.ok(bindings.includes("hype_usage"), "hype_usage binding present");
  });

  it("no secrets baked into runtime source", async () => {
    const worker = await read("worker/index.js");
    const popup = await read("extension/popup.js");
    for (const pat of ["THESPORTSDB_API_KEY=", "cfat_", "api_token", "API_TOKEN="]) {
      assert.ok(!worker.includes(pat), `worker leaks ${pat}`);
      assert.ok(!popup.includes(pat), `popup leaks ${pat}`);
    }
    assert.ok(worker.includes("env.THESPORTSDB_API_KEY") || worker.includes("THESPORTSDB_API_KEY"), "fallback reads key from env");
  });
});
