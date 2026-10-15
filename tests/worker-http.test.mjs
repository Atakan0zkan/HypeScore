import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, memoryCache, espnEvent, scoreboardResponse } from "./helpers.mjs";

const EXT_ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";

describe("ESPN upstream host recovery", () => {
  const primaryUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
  const alternateUrl = "https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

  it("uses the public API host for the aggregate scoreboard without an extra request on success", async () => {
    const calls = [];
    const { run } = await loadWorkerContext({ fetch: async (url) => {
      calls.push(String(url));
      return scoreboardResponse([espnEvent()]);
    } });
    const payload = await run("fetchJson(ESPN_SCOREBOARD_URL)");
    assert.equal(payload.events.length, 1);
    assert.deepEqual(calls, [primaryUrl]);
    assert.equal(run("ESPN_STANDINGS_BASE_URL"), "https://site.api.espn.com/apis/v2/sports/soccer");
    assert.equal(run("ESPN_SUMMARY_BASE_URL"), "https://site.api.espn.com/apis/site/v2/sports/soccer");
  });

  it("recovers a blocked aggregate host using exactly one alternate request and the same deadline signal", async () => {
    const calls = [];
    const signals = [];
    const { run } = await loadWorkerContext({ fetch: async (url, { signal }) => {
      calls.push(String(url));
      signals.push(signal);
      return calls.length === 1
        ? new Response("Forbidden", { status: 403 })
        : scoreboardResponse([espnEvent()]);
    } });
    const payload = await run("fetchJson(ESPN_SCOREBOARD_URL)");
    assert.equal(payload.events.length, 1);
    assert.deepEqual(calls, [primaryUrl, alternateUrl]);
    assert.equal(signals[0], signals[1]);
  });

  it("returns and caches a complete league list after recovering the aggregate source", async () => {
    const calls = [];
    const { run } = await loadWorkerContext({ caches: { default: memoryCache() }, fetch: async (url) => {
      calls.push(String(url));
      if (String(url) === primaryUrl) return new Response("Forbidden", { status: 403 });
      return scoreboardResponse(String(url) === alternateUrl ? [espnEvent()] : []);
    } });
    const request = `handleRequest(new Request("https://api.atakanozkan.com/live-matches", {headers:{Origin:"${EXT_ORIGIN}"}}), {})`;
    const response = await run(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), EXT_ORIGIN);
    const payload = await response.json();
    assert.equal(payload.matches.length, 1);
    assert.equal(payload.leagues.length, 32);
    assert.equal(calls.length, 6);
    assert.equal((await run(request)).headers.get("X-Cache"), "HIT");
    assert.equal(calls.length, 6, "a healthy recovered result is cached normally");
  });

  it("also recovers legacy standings/detail hosts while preserving the path and season", async () => {
    const calls = [];
    const url = "https://site.web.api.espn.com/apis/v2/sports/soccer/esp.1/standings?season=2026";
    const { run } = await loadWorkerContext({ fetch: async (input) => {
      calls.push(String(input));
      return calls.length === 1
        ? new Response("Unavailable", { status: 503 })
        : scoreboardResponse([]);
    } });
    await run(`fetchJson(${JSON.stringify(url)})`);
    assert.deepEqual(calls, [url, url.replace("site.web.api.espn.com", "site.api.espn.com")]);
  });

  it("does not retry missing seasons, unauthorized requests or rate limits", async () => {
    for (const status of [400, 401, 404, 429]) {
      let calls = 0;
      const { run } = await loadWorkerContext({ fetch: async () => {
        calls += 1;
        return new Response("Unavailable", { status });
      } });
      await assert.rejects(run("fetchJson(ESPN_SCOREBOARD_URL)"), error => error.status === status);
      assert.equal(calls, 1, `HTTP ${status} must not trigger another request`);
    }
  });

  it("retains the intentional empty 2030 response for an unpublished season", async () => {
    const calls = [];
    const { run } = await loadWorkerContext({ fetch: async (url) => {
      calls.push(String(url));
      return new Response("Not found", { status: 404 });
    } });
    const payload = await run('fetchFutureWorldCupJson("https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=2030&season=2030")');
    assert.equal(Object.keys(payload).length, 0);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("season=2030"));
  });

  it("recovers invalid JSON/non-JSON responses but never redirects other providers or untrusted hosts", async () => {
    for (const invalidResponse of [
      () => new Response("<html>Unavailable</html>", { headers: { "Content-Type": "text/html" } }),
      () => new Response("{invalid", { headers: { "Content-Type": "application/json" } }),
    ]) {
      let calls = 0;
      const { run } = await loadWorkerContext({ fetch: async () => ++calls === 1 ? invalidResponse() : scoreboardResponse([]) });
      assert.equal((await run("fetchJson(ESPN_SCOREBOARD_URL)")).events.length, 0);
      assert.equal(calls, 2);
      for (const url of [
        "https://www.thesportsdb.com/api/v2/json/livescore/soccer",
        "https://site.api.espn.com.evil.test/scoreboard",
        "http://site.api.espn.com/scoreboard",
        "https://site.api.espn.com:444/scoreboard",
        "https://user:password@site.api.espn.com/scoreboard",
      ]) {
        assert.equal(run(`getAlternateEspnUrl(${JSON.stringify(url)})`), null);
      }
    }
  });

  it("does not restart the timeout for fallback bodies or ignore an external signal", async () => {
    let deadline;
    let timerCount = 0;
    let cleared = false;
    let calls = 0;
    const { run } = await loadWorkerContext({
      globals: {
        setTimeout(callback) { deadline = callback; timerCount += 1; return 1; },
        clearTimeout() { cleared = true; },
      },
      fetch: async (_url, { signal }) => {
        calls += 1;
        if (calls === 1) return new Response("Forbidden", { status: 403 });
        return { ok: true, headers: new Headers({ "Content-Type": "application/json" }),
          json: () => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("Body aborted")), { once: true });
          }),
        };
      },
    });
    const pending = run("fetchJson(ESPN_SCOREBOARD_URL, {signal: new AbortController().signal})");
    const failure = assert.rejects(pending, /Body aborted/);
    await new Promise(setImmediate);
    assert.equal(calls, 2);
    assert.equal(timerCount, 1);
    assert.equal(cleared, false);
    deadline();
    await failure;
    assert.equal(cleared, true);
  });

  it("respects cancellation before and during a request without trying another host", async () => {
    let calls = 0;
    const { run } = await loadWorkerContext({ fetch: async (_url, { signal }) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
      });
    } });
    run("globalThis.caller = new AbortController(); caller.abort()");
    await assert.rejects(run("fetchJson(ESPN_SCOREBOARD_URL, {signal:caller.signal})"), { name: "AbortError" });
    assert.equal(calls, 0);
    run("globalThis.caller = new AbortController()");
    const pending = run("fetchJson(ESPN_SCOREBOARD_URL, {signal:caller.signal})");
    const failure = assert.rejects(pending, { name: "AbortError" });
    await new Promise(setImmediate);
    run("caller.abort()");
    await failure;
    assert.equal(calls, 1);
  });

  it("returns a real 502 when both hosts fail instead of an invented empty scoreboard", async () => {
    let calls = 0;
    const { run } = await loadWorkerContext({ fetch: async () => {
      calls += 1;
      return new Response("Forbidden", { status: 403 });
    } });
    const result = await run(`handleRequest(new Request("https://api.atakanozkan.com/live-matches", {headers:{Origin:"${EXT_ORIGIN}"}}), {})`);
    assert.equal(result.status, 502);
    assert.equal((await result.json()).error, "Live match data could not be fetched");
    assert.equal(calls, 10, "five scoreboard requests each have at most one alternate host");
  });
});

describe("known-event registry survives live-cache expiry and isolate changes", () => {
  it("keeps only issued events eligible without fetching arbitrary summaries", async () => {
    const cache = memoryCache();
    const first = await loadWorkerContext({ caches: { default: cache } });
    await first.run('persistKnownMatches(caches.default, [{id:"760486",leagueCode:"eng.1"}])');
    let calls = 0;
    const second = await loadWorkerContext({ caches: { default: cache }, fetch: async () => {
      calls += 1;
      return scoreboardResponse([]);
    } });
    assert.equal(second.run("rememberedEventKeys.size"), 0);
    assert.equal(await second.run('isKnownMatchDetailEvent(caches.default,"760486","eng.1")'), true);
    assert.equal(await second.run('isKnownMatchDetailEvent(caches.default,"760486","esp.1")'), false);
    const request = (id) => second.run(`handleRequest(new Request("https://api.atakanozkan.com/match-detail?eventId=${id}&leagueCode=eng.1", {headers:{Origin:"${EXT_ORIGIN}"}}), {})`);
    assert.equal((await request("760486")).status, 200);
    assert.equal((await request("999999")).status, 404);
    assert.equal(calls, 1);
  });
  it("expires old entries, caps the registry, and preserves previous fixtures", async () => {
    const cache = memoryCache();
    const { run } = await loadWorkerContext({ caches: { default: cache } });
    await run('persistKnownMatches(caches.default, [{id:"760486",leagueCode:"eng.1"}])');
    await run('persistKnownMatches(caches.default, [{id:"760487",leagueCode:"eng.1"}])');
    assert.equal((await run('readKnownMatches(caches.default)')).length, 2);
    await run('caches.default.put(new Request(KNOWN_EVENTS_CACHE_URL), new Response(JSON.stringify([{key:"eng.1:760486",expires:Date.now()-1}])))');
    assert.equal(await run('isKnownMatchDetailEvent(caches.default,"760486","eng.1")'), false);
    await run('persistKnownMatches(caches.default, Array.from({length:1100},(_,i)=>({id:String(100000+i),leagueCode:"eng.1"})))');
    assert.equal((await run('readKnownMatches(caches.default)')).length, 1024);
  });
});
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
    const first = await call("/live-matches?client=extension&version=1.6", { Origin: UNPACKED_ORIGIN });
    assert.equal(first.status, 200);
    assert.ok(Array.isArray(first.json.matches) && Array.isArray(first.json.leagues));
    assert.equal(first.json.leagues.length, 32);
    assert.equal(first.cors, UNPACKED_ORIGIN);
    assert.ok(first.json.matches.length >= 1, "live event survived");
    const second = await call("/live-matches?client=extension&version=1.6", { Origin: UNPACKED_ORIGIN });
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
