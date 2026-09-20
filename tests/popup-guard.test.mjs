import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadPopupContext, livePayload, matchRow } from "./helpers.mjs";

describe("popup constants (budget contract)", () => {
  it("refresh tiers 60s/5m/30m, guards 10m/3m, daily 2000", async () => {
    const { run } = await loadPopupContext();
    assert.equal(run("LIVE_REFRESH_INTERVAL_MS"), 60000);
    assert.equal(run("IDLE_REFRESH_INTERVAL_MS"), 300000);
    assert.equal(run("QUIET_REFRESH_INTERVAL_MS"), 1800000);
    assert.equal(run("AUTO_PAUSE_AFTER_MS"), 600000);
    assert.equal(run("INACTIVITY_PAUSE_AFTER_MS"), 180000);
    assert.equal(run("DAILY_REQUEST_LIMIT"), 2000);
    assert.equal(run("FETCH_TIMEOUT_MS"), 10000);
    assert.equal(run("LAZY_ERROR_RETRY_MS"), 60000);
    assert.equal(run("CLIENT_LIVE_CACHE_VERSION"), "v10");
    assert.equal(run("UPCOMING_MATCH_WINDOW_MS"), 86400000);
  });
});

describe("popup refresh math", () => {
  it("getRefreshInterval: live > upcoming > quiet", async () => {
    const { run } = await loadPopupContext();
    assert.equal(run(`getRefreshInterval(${JSON.stringify(livePayload({ live: true }))})`), 60000);
    assert.equal(run(`getRefreshInterval(${JSON.stringify(livePayload({ live: false, upcoming: true }))})`), 300000);
    assert.equal(run(`getRefreshInterval(${JSON.stringify(livePayload({ live: false, upcoming: false }))})`), 1800000);
  });

  it("getRemainingRefreshDelay subtracts elapsed", async () => {
    const { run } = await loadPopupContext();
    const payload = livePayload({ live: true }); // interval 60s
    const now = Date.now();
    // 10s elapsed -> 50s remain (1s tolerance for VM clock)
    const remain = run(`getRemainingRefreshDelay(${JSON.stringify(payload)}, ${now - 10000})`);
    assert.ok(remain > 48000 && remain <= 50000, `remain=${remain}`);
    assert.equal(run(`getRemainingRefreshDelay(${JSON.stringify(payload)}, 0)`), 0);
  });

  it("upcoming window: 24h inside, 25h outside, bad kickoff outside", async () => {
    const { run } = await loadPopupContext();
    const inW = matchRow({ state: "scheduled", kickoff: new Date(Date.now() + 2 * 3600 * 1000).toISOString() });
    const outW = matchRow({ state: "scheduled", kickoff: new Date(Date.now() + 25 * 3600 * 1000).toISOString() });
    const bad = matchRow({ state: "scheduled", kickoff: "not-a-date" });
    assert.equal(run(`isUpcomingWithinWindow(${JSON.stringify(inW)})`), true);
    assert.equal(run(`isUpcomingWithinWindow(${JSON.stringify(outW)})`), false);
    assert.equal(run(`isUpcomingWithinWindow(${JSON.stringify(bad)})`), false);
    assert.equal(run(`isUpcomingWithinWindow(${JSON.stringify(matchRow({ state: "live" }))})`), false);
  });
});

describe("popup daily guard (attempted vs successful)", () => {
  it("blocks at 2000 successful, failed attempts don't burn budget", async () => {
    const { run, storage } = await loadPopupContext();
    const today = run("getUtcDateKey()");
    storage.set("hype_daily_request_count", JSON.stringify({ date: today, attempted: 2000, successful: 5 }));
    assert.equal(run("tryStartDailyRequest()"), true); // attempted high, successful low -> allowed
    const b1 = JSON.parse(storage.get("hype_daily_request_count"));
    assert.equal(b1.attempted, 2001);
    assert.equal(b1.successful, 5);
    run("recordDailyRequestSuccess()");
    const b2 = JSON.parse(storage.get("hype_daily_request_count"));
    assert.equal(b2.successful, 6);
    storage.set("hype_daily_request_count", JSON.stringify({ date: today, attempted: 0, successful: 2000 }));
    assert.equal(run("tryStartDailyRequest()"), false);
  });

  it("legacy {count} bucket migrates, new day resets", async () => {
    const { run, storage } = await loadPopupContext();
    storage.set("hype_daily_request_count", JSON.stringify({ date: run("getUtcDateKey()"), count: 7 }));
    const migrated = run("readDailyRequestBucket()");
    assert.equal(migrated.attempted, 7);
    assert.equal(migrated.successful, 7);
    storage.set("hype_daily_request_count", JSON.stringify({ date: "2000-01-01", attempted: 9, successful: 9 }));
    const fresh = run("readDailyRequestBucket()");
    assert.equal(fresh.attempted, 0);
    assert.equal(fresh.successful, 0);
  });
});

describe("popup cache validation", () => {
  it("rejects bad shape, future timestamp, missing required leagues", async () => {
    const { run, storage } = await loadPopupContext();
    const good = { version: "v10", savedAt: Date.now(), payload: livePayload() };
    storage.set("hype_live_matches_cache", JSON.stringify(good));
    assert.ok(run("readClientLiveCache()"), "good cache accepted");
    for (const bad of [
      { ...good, payload: { ...good.payload, matches: [null] } },
      { ...good, payload: { ...good.payload, leagues: {} } },
      { ...good, savedAt: Date.now() + 60000 },
      { ...good, version: "v9" },
      { ...good, payload: { matches: [], leagues: [{ code: "eng.1", name: "x", matches: [] }] } },
    ]) {
      storage.set("hype_live_matches_cache", JSON.stringify(bad));
      assert.equal(run("readClientLiveCache()"), null, JSON.stringify(bad).slice(0, 80));
    }
  });

  it("storage helpers never throw on corrupt/quota errors", async () => {
    const { run, storage } = await loadPopupContext();
    storage.set("k", "{not-json");
    assert.equal(run(`safeReadStorageJson("k", "fb")`), "fb");
    assert.equal(run(`safeReadStorageJson("missing", "fb")`), "fb");
    assert.equal(run(`sanitizeExternalUrl("javascript:alert(1)", ["espn.com"])`), "");
    assert.equal(run(`sanitizeExternalUrl("http://www.espn.com/x", ["espn.com"])`), "");
    assert.ok(run(`sanitizeExternalUrl("https://www.espn.com/x", ["espn.com"])`).includes("espn.com"));
    assert.equal(run(`sanitizeExternalUrl("https://evil.com/x", ["espn.com"])`), "");
  });
});

describe("popup display ordering + formatting", () => {
  it("sort: live first, then finished, then scheduled, ties by home name", async () => {
    const { run } = await loadPopupContext();
    const mk = (state, home) => ({ id: home, homeTeam: home, awayTeam: "X", state });
    // spread: VM arrays live in another realm, compare as host arrays
    const sorted = [...run(`sortMatchesForDisplay(${JSON.stringify([
      mk("scheduled", "Zebra"), mk("live", "Lions"), mk("finished", "Bears"), mk("live", "Apes"),
    ])}).map((m) => m.homeTeam)`)];
    assert.deepEqual(sorted, ["Apes", "Lions", "Bears", "Zebra"]);
  });

  it("formatMessage handles $1 and $COUNT$", async () => {
    const { run } = await loadPopupContext();
    assert.equal(run(`formatMessage("a $1 b", ["X"])`), "a X b");
    assert.equal(run(`formatMessage("a $COUNT$ b", ["3"])`), "a 3 b");
  });

  it("getLeagueLogo prefers packaged art, falls back safely", async () => {
    const { run } = await loadPopupContext();
    assert.equal(run(`getLeagueLogo({ code: "eng.1" })`), "icons/leagues/eng-1.png");
    assert.equal(run(`getLeagueLogo({ code: "xx.1", logo: "https://x/y.png" })`), "https://x/y.png");
    assert.ok(String(run(`getLeagueLogo({})`)).startsWith("data:image/svg+xml,"));
  });

  it("lazy error retry window 60s; ENG fallback covers all msg keys", async () => {
    const { readFile } = await import("node:fs/promises");
    const { run } = await loadPopupContext();
    assert.equal(run(`isExpiredLazyError({ status: "error", failedAt: Date.now() })`), false);
    assert.equal(run(`isExpiredLazyError({ status: "error", failedAt: Date.now() - 61000 })`), true);
    assert.equal(run(`isExpiredLazyError({ status: "loading" })`), false);
    // ENG toggle renders via FALLBACK_MESSAGES when chrome.i18n is absent:
    // every msg() key must exist there (except extension identity keys).
    const src = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
    const used = [...new Set([...src.matchAll(/msg\(\s*["']([A-Za-z0-9_]+)["']/g)].map((m) => m[1]))]
      .filter((k) => k !== "extName" && k !== "extDescription");
    const missing = [...run(`(${JSON.stringify(used)}).filter((k) => !(k in FALLBACK_MESSAGES))`)];
    assert.deepEqual(missing, []);
  });

  it("readSet/writeSet roundtrip tolerates corrupt values", async () => {
    const { run, storage } = await loadPopupContext();
    run(`writeSet("s", new Set(["a", "b"]))`);
    assert.deepEqual([...run(`readSet("s")`)], ["a", "b"]);
    storage.set("s", "{bad");
    assert.deepEqual([...run(`readSet("s")`)], []);
  });
});
