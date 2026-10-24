import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, memoryCache, espnEvent, scoreboardResponse, loadPopupContext } from "./helpers.mjs";
import { loadPopupDOM, domPayload, workerJson } from "./dom-helpers.mjs";
import { runSmokeChecks } from "../tools/smoke-test.js";

const ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const MAX_AGE = 300000;

async function workerFixture() {
  let clock = Date.now();
  let blocked = false;
  let calls = 0;
  const initialTime = clock;
  const RealDate = Date;
  class TestDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const cache = memoryCache();
  const { run } = await loadWorkerContext({ caches: { default: cache }, globals: { Date: TestDate },
    fetch: async () => { calls += 1; return blocked ? new Response("Forbidden", { status: 403 }) : scoreboardResponse([espnEvent()]); },
  });
  const request = (query = "allowStale=1", origin = ORIGIN, method = "GET") =>
    run(`__workerDefault.fetch(new Request("https://api.atakanozkan.com/live-matches?${query}",
      {method:${JSON.stringify(method)},headers:{Origin:${JSON.stringify(origin)}}}), {})`);
  await request();
  return { cache, run, request, initialTime, get calls() { return calls; },
    set blocked(value) { blocked = value; }, advance(ms) { clock += ms; },
    lastGoodKey: run("LAST_GOOD_LIVE_CACHE_URL"), freshKey: run("CACHE_KEY_URL"),
  };
}

describe("bounded Worker last-successful snapshots", () => {
  it("stores source time once and serves an opted-in, no-store degraded result after upstream failure", async () => {
    const test = await workerFixture();
    const first = await (await test.request()).json();
    assert.equal(first.freshness.stale, false);
    assert.equal(Date.parse(first.freshness.updatedAt), test.initialTime);
    test.blocked = true;
    test.advance(35000);
    const response = await test.request();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Cache"), "STALE");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(response.headers.get("X-Data-Source"), "espn");
    assert.equal(payload.freshness.stale, true);
    assert.equal(payload.freshness.updatedAt, first.freshness.updatedAt);
    assert.equal(payload.matches.length, first.matches.length);
    const stored = await (await test.cache.match(test.lastGoodKey)).json();
    assert.equal(stored.freshness.stale, false, "a degraded response must never replace the last successful snapshot");
    assert.equal(stored.freshness.updatedAt, first.freshness.updatedAt);
  });

  it("cannot renew fallback age across repeated failures and expires at exactly five minutes", async () => {
    const test = await workerFixture();
    test.blocked = true;
    test.advance(35000);
    const timestamp = (await (await test.request()).json()).freshness.updatedAt;
    test.advance(MAX_AGE - 35001);
    assert.equal((await (await test.request()).json()).freshness.updatedAt, timestamp);
    test.advance(1);
    assert.equal((await test.request()).status, 502);
  });

  it("does not silently serve snapshots to old clients, foreign origins or invalid methods", async () => {
    const test = await workerFixture();
    test.blocked = true;
    test.advance(35000);
    assert.equal((await test.request("client=extension&version=1.6")).status, 502);
    assert.equal((await test.request("allowStale=1", "https://untrusted.example")).status, 403);
    assert.equal((await test.request("allowStale=1", ORIGIN, "POST")).status, 405);
    assert.equal((await test.request()).status, 200);
  });

  it("keeps each coalesced caller's capability and origin separate", async () => {
    const test = await workerFixture();
    test.blocked = true;
    test.advance(35000);
    const calls = test.calls;
    const otherOrigin = "chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const [oldClient, newClient] = await Promise.all([
      test.request("client=extension"), test.request("allowStale=1", otherOrigin),
    ]);
    assert.equal(oldClient.status, 502);
    assert.equal(newClient.status, 200);
    assert.equal(newClient.headers.get("Access-Control-Allow-Origin"), otherOrigin);
    assert.equal(test.calls - calls, 10, "one bounded two-host scoreboard refresh is shared");
  });

  it("rejects malformed, future, incomplete and already-degraded cache records", async () => {
    const test = await workerFixture();
    const good = await (await test.cache.match(test.lastGoodKey)).json();
    test.blocked = true;
    test.advance(35000);
    const invalid = [
      { ...good, freshness: { ...good.freshness, updatedAt: "invalid" } },
      { ...good, freshness: { ...good.freshness, updatedAt: new Date(test.initialTime + 60000).toISOString() } },
      { ...good, freshness: { ...good.freshness, stale: true } },
      { ...good, leagues: good.leagues.slice(1) },
      { ...good, matches: null },
    ];
    for (const payload of invalid) {
      await test.cache.put(test.lastGoodKey, workerJson(payload));
      assert.equal((await test.request()).status, 502);
    }
  });

  it("does not reuse previous-version cache entries", async () => {
    const cache = memoryCache();
    await cache.put("https://live-score-extension.internal/live-matches/v16/last-good", workerJson({ matches: [] }));
    const { run } = await loadWorkerContext({ caches: { default: cache },
      fetch: async () => new Response("Forbidden", { status: 403 }) });
    assert.equal((await run(`handleRequest(new Request("https://api.atakanozkan.com/live-matches?allowStale=1",
      {headers:{Origin:${JSON.stringify(ORIGIN)}}}), {})`)).status, 502);
  });

  it("recovers to fresh data without waiting for the fallback to expire", async () => {
    const test = await workerFixture();
    test.blocked = true;
    test.advance(35000);
    assert.equal((await (await test.request()).json()).freshness.stale, true);
    test.blocked = false;
    const fresh = await test.request();
    const payload = await fresh.json();
    assert.equal(fresh.headers.get("X-Cache"), "MISS");
    assert.equal(payload.freshness.stale, false);
    assert.equal(Date.parse(payload.freshness.updatedAt), test.initialTime + 35000);
  });

  it("does not let cache read/write failures prevent a healthy upstream response", async () => {
    const { run } = await loadWorkerContext({
      caches: { default: { match: async () => { throw new Error("Cache unavailable"); }, put: async () => { throw new Error("Cache unavailable"); } } },
      fetch: async () => scoreboardResponse([]),
    });
    const response = await run(`handleRequest(new Request("https://api.atakanozkan.com/live-matches?allowStale=1",
      {headers:{Origin:${JSON.stringify(ORIGIN)}}}), {})`);
    assert.equal(response.status, 200);
  });

  it("keeps Cron checks degraded when the user-facing API can use a snapshot", async () => {
    const test = await workerFixture();
    test.blocked = true;
    test.advance(35000);
    await assert.rejects(test.run("__workerDefault.scheduled({}, {})"), /degraded/);
  });
});

function popupPayload(timestamp = Date.now(), stale = false) {
  const payload = domPayload();
  for (const code of ["fifa.world", "uefa.nations", "uefa.euro", "conmebol.america"]) {
    payload.leagues.push({ code, name: code, matches: [] });
  }
  return { ...payload, freshness: { updatedAt: new Date(timestamp).toISOString(), stale } };
}
async function settle() { for (let i = 0; i < 8; i += 1) await new Promise(resolve => setImmediate(resolve)); }
const stored = (payload, timestamp) => ({ hype_live_matches_cache: JSON.stringify({ payload, savedAt: timestamp, version: "v12" }) });

describe("popup silent bounded fallback and hard expiry", () => {
  it("preserves source time in storage without freshness UI and recovers", async () => {
    const timestamp = Date.now() - 80000;
    let payload = popupPayload(timestamp, true);
    const calls = [];
    const app = await loadPopupDOM({ fetchImpl: async (url, init) => { calls.push({ url, init }); return workerJson(payload); } });
    try {
      await settle();
      assert.equal(app.document.getElementById("snapshotNotice"), null);
      assert.ok(app.document.querySelectorAll(".league-pick-card").length > 0);
      assert.equal(JSON.parse(app.window.localStorage.getItem("hype_live_matches_cache")).savedAt, timestamp);
      assert.equal(new URL(calls[0].url).searchParams.get("allowStale"), "1");
      assert.equal(calls[0].init.cache, "no-store");
      await app.eval("loadMatches({force:true})");
      assert.equal(JSON.parse(app.window.localStorage.getItem("hype_live_matches_cache")).savedAt, timestamp);
      payload = popupPayload();
      await app.eval("loadMatches({force:true})");
      assert.equal(app.document.getElementById("snapshotNotice"), null);
    } finally { await app.close(); }
  });

  it("uses a recent local snapshot on a cold-open network failure without renewing it", async () => {
    const timestamp = Date.now() - 90000;
    const app = await loadPopupDOM({ storage: stored(popupPayload(timestamp), timestamp),
      fetchImpl: async () => new Response("Unavailable", { status: 502 }) });
    try {
      await settle();
      assert.equal(app.document.getElementById("snapshotNotice"), null);
      assert.equal(app.document.getElementById("leaguePickList").hidden, false);
      assert.equal(app.document.getElementById("errorState").hidden, true);
      assert.equal(JSON.parse(app.window.localStorage.getItem("hype_live_matches_cache")).savedAt, timestamp);
    } finally { await app.close(); }
  });

  it("does not show expired local scores even when a request fails", async () => {
    const timestamp = Date.now() - MAX_AGE - 1000;
    const app = await loadPopupDOM({ storage: stored(popupPayload(timestamp), timestamp),
      fetchImpl: async () => new Response("Unavailable", { status: 502 }) });
    try {
      await settle();
      assert.equal(app.document.getElementById("errorState").hidden, false);
      assert.equal(app.document.getElementById("leaguePickList").hidden, true);
      assert.equal(app.document.getElementById("snapshotNotice"), null);
    } finally { await app.close(); }
  });

  it("removes expired snapshots without a request, including while settings are open", async () => {
    const timestamp = Date.now() - 290000;
    let calls = 0;
    const app = await loadPopupDOM({ fetchImpl: async () => { calls += 1; return workerJson(popupPayload(timestamp, true)); } });
    try {
      await settle();
      const before = calls;
      app.document.getElementById("settingsToggle").click();
      app.eval(`Date.now = () => ${timestamp + MAX_AGE}; enforceSnapshotExpiry();`);
      app.document.getElementById("settingsClose").click();
      assert.equal(app.document.getElementById("snapshotNotice"), null);
      assert.equal(app.document.getElementById("leaguePickList").hidden, true);
      assert.equal(app.document.getElementById("leagueDetailView").hidden, true);
      assert.equal(app.document.getElementById("errorState").hidden, false);
      assert.equal(app.eval("__T.lastPayload"), null);
      assert.equal(calls, before);
    } finally { await app.close(); }
  });

  it("does not resurrect an expired snapshot during a render", async () => {
    const timestamp = Date.now() - 290000;
    const app = await loadPopupDOM({ fetchImpl: async () => workerJson(popupPayload(timestamp, true)) });
    try {
      await settle();
      app.eval(`Date.now = () => ${timestamp + MAX_AGE}; __T.renderLast();`);
      assert.equal(app.document.getElementById("leaguePickList").hidden, true);
      assert.equal(app.document.getElementById("errorState").hidden, false);
    } finally { await app.close(); }
  });

  it("rejects invalid or over-age network freshness metadata", async () => {
    const { run } = await loadPopupContext();
    for (const metadata of [null, { stale: "true", updatedAt: new Date().toISOString() },
      { stale: true, updatedAt: "<script>" }, { stale: true, updatedAt: new Date(Date.now() - MAX_AGE - 1000).toISOString() },
      { stale: false, updatedAt: new Date(Date.now() + 60000).toISOString() }]) {
      assert.throws(() => run(`getPayloadFreshness({freshness:${JSON.stringify(metadata)}})`), /freshness/);
    }
  });

  it("ignores a corrupted local timestamp object without throwing", async () => {
    const timestamp = Date.now() - 90000;
    const payload = popupPayload(timestamp);
    payload.freshness.updatedAt = { toString: null };
    const app = await loadPopupDOM({ storage: stored(payload, timestamp),
      fetchImpl: async () => workerJson(popupPayload()) });
    try {
      await settle();
      assert.equal(app.document.getElementById("errorState").hidden, true);
      assert.equal(app.document.getElementById("snapshotNotice"), null);
      assert.ok(app.document.querySelectorAll(".league-pick-card").length > 0);
    } finally { await app.close(); }
  });
});

describe("monitoring does not hide degraded snapshots", () => {
  it("opts in but reports an HTTP 200 stale scoreboard as STALE_DATA", async () => {
    const test = await workerFixture();
    const payload = await (await test.request()).json();
    payload.freshness.stale = true;
    const report = await runSmokeChecks({ fetchImpl: async url => {
      const parsed = new URL(url);
      if (parsed.pathname === "/live-matches") {
        assert.equal(parsed.searchParams.get("allowStale"), "1");
        return workerJson(payload);
      }
      if (parsed.pathname === "/league-standings") return workerJson({ leagueCode: "esp.1", standings: [] });
      return workerJson({ leagueCode: "fifa.world", seasonYear: 2030, dates: "2030", rounds: [] });
    } });
    assert.equal(report.ok, false);
    assert.equal(report.checks[0].code, "STALE_DATA");
  });
});
