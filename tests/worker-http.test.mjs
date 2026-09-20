import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, memoryCache, espnEvent, scoreboardResponse } from "./helpers.mjs";

const EXT_ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const UNPACKED_ORIGIN = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BROWSER_NO_ORIGIN = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Sec-Fetch-Site": "none",
};

function stubFetch(events) {
  return async (url) => {
    if (String(url).includes("/all/scoreboard")) return scoreboardResponse(events);
    return scoreboardResponse([]);
  };
}

async function liveContext(events, cache = memoryCache()) {
  const { ctx, run } = await loadWorkerContext({
    fetch: stubFetch(events),
    caches: { default: cache },
  });
  // expose caller for VM-side request driving
  return { ctx, run, cache };
}

describe("worker HTTP: live-matches routing + cache", () => {
  it("200 + 32 groups + CORS echo + MISS then HIT", async () => {
    const cache = memoryCache();
    const { ctx, run } = await liveContext([espnEvent({ state: "in" })], cache);
    const call = (path, headers) => run(`(async () => {
      const r = await handleRequest(new Request("https://api.atakanozkan.com${path}", { headers: new Headers(${JSON.stringify(headers)}) }), {});
      const t = await r.clone().text();
      let j = null; try { j = JSON.parse(t); } catch {}
      return { status: r.status, json: j, cors: r.headers.get("Access-Control-Allow-Origin"), cache: r.headers.get("X-Cache") };
    })()`);
    const first = await call("/live-matches?client=extension&version=1.5.1", { Origin: UNPACKED_ORIGIN });
    assert.equal(first.status, 200);
    assert.ok(Array.isArray(first.json.matches) && Array.isArray(first.json.leagues));
    assert.equal(first.json.leagues.length, 32);
    assert.equal(first.cors, UNPACKED_ORIGIN);
    assert.ok(first.json.matches.length >= 1, "live event survived");
    const second = await call("/live-matches?client=extension&version=1.5.1", { Origin: UNPACKED_ORIGIN });
    assert.equal(second.status, 200);
    assert.equal(second.cache, "HIT");
  });

  it("far-future scheduled event is dropped from live payload", async () => {
    const far = espnEvent({
      id: "999001", state: "pre",
      kickoff: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
    });
    const soon = espnEvent({
      id: "999002", state: "pre",
      kickoff: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    const { run } = await liveContext([far, soon]);
    const res = await run(`(async () => {
      const r = await handleRequest(new Request("https://api.atakanozkan.com/live-matches", { headers: new Headers({ Origin: "${EXT_ORIGIN}" }) }), {});
      return JSON.parse(await r.clone().text());
    })()`);
    const ids = res.matches.map((m) => m.id);
    assert.ok(!ids.includes("999001"), "25h away dropped");
    assert.ok(ids.includes("999002"), "2h away kept");
  });
});

describe("worker HTTP: origin policy + method + routes", () => {
  it("Origin null / web / raw-missing -> 403; browser-like no-Origin -> 200", async () => {
    const { run } = await liveContext([]);
    const get = (headers) => run(`(async () => {
      const r = await handleRequest(new Request("https://api.atakanozkan.com/live-matches", { headers: new Headers(${JSON.stringify(headers)}) }), {});
      return { status: r.status, json: JSON.parse(await r.clone().text()) };
    })()`);
    assert.equal((await get({ Origin: "null" })).status, 403);
    assert.equal((await get({ Origin: "https://evil.example" })).status, 403);
    assert.equal((await get({})).status, 403);
    assert.equal((await get(BROWSER_NO_ORIGIN)).status, 200);
  });

  it("OPTIONS -> 204; unknown route -> 404; POST live -> 405", async () => {
    const { run } = await liveContext([]);
    const call = (path, method, headers = { Origin: EXT_ORIGIN }) => run(`(async () => {
      const r = await handleRequest(new Request("https://api.atakanozkan.com${path}", { method: "${method}", headers: new Headers(${JSON.stringify(headers)}) }), {});
      return r.status;
    })()`);
    assert.equal(await call("/live-matches", "OPTIONS"), 204);
    assert.equal(await call("/nope", "GET"), 404);
    assert.equal(await call("/live-matches", "POST"), 405);
  });

  it("bad params fail closed without upstream fanout", async () => {
    let calls = 0;
    const { run } = await loadWorkerContext({
      fetch: async () => { calls += 1; return scoreboardResponse([]); },
      caches: { default: memoryCache() },
    });
    const call = (path) => run(`(async () => {
      const r = await handleRequest(new Request("https://api.atakanozkan.com${path}", { headers: new Headers({ Origin: "${EXT_ORIGIN}" }) }), {});
      return r.status;
    })()`);
    assert.equal(await call("/league-standings?leagueCode=bad.code"), 400);
    assert.equal(await call("/tournament-bracket?leagueCode=eng.1"), 400);
    assert.equal(await call("/match-detail?eventId=12&leagueCode=eng.1"), 400); // too short
    assert.equal(await call("/match-detail?eventId=760486&leagueCode=bad.code"), 400);
    assert.equal(await call("/match-detail?eventId=760486&leagueCode=eng.1"), 404); // unknown event, no ESPN call
    assert.equal(calls, 0, "no upstream fetch for invalid params");
  });

  it("event-id shape guard: 3-20 digits", async () => {
    const { run } = await loadWorkerContext();
    assert.equal(run(`isSafeEventId("760486")`), true);
    assert.equal(run(`isSafeEventId("12")`), false);
    assert.equal(run(`isSafeEventId("${"1".repeat(21)}")`), false);
    assert.equal(run(`isSafeEventId("abc")`), false);
    assert.equal(run(`isChromeExtensionOrigin("${EXT_ORIGIN}")`), true);
    assert.equal(run(`isChromeExtensionOrigin("https://evil.example")`), false);
    assert.equal(run(`isChromeExtensionOrigin("chrome-extension://short")`), false);
  });
});
