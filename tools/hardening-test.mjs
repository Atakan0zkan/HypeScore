import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { request as httpRequest } from "node:http";
import { getDashboardPayload, shapeDashboardData, server } from "../analytics-dashboard/server.mjs";

const workerSource = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
let deadline;
let cleared = false;
const workerContext = vm.createContext({
  URL, Request, Response, Headers, AbortController, console,
  setTimeout(callback) { deadline = callback; return 1; },
  clearTimeout() { cleared = true; },
  fetch: async (_url, { signal }) => ({
    ok: true,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Body aborted")), { once: true });
    }),
  }),
});
vm.runInContext(workerSource.replace("export default", "const worker ="), workerContext);
const bodyRead = vm.runInContext("fetchJson('https://upstream.test')", workerContext);
const bodyFailure = assert.rejects(bodyRead, /Body aborted/);
await new Promise(setImmediate);
assert.equal(cleared, false, "timeout must cover body consumption, not only response headers");
deadline();
await bodyFailure;
assert.equal(cleared, true);
assert.equal(vm.runInContext("normalizeClientVersion('1'.repeat(5000))", workerContext), "unknown");
assert.equal(vm.runInContext("parseBrowserFamily('Chrome/' + '1'.repeat(5000)).major", workerContext), "unknown");
assert.equal(vm.runInContext("normalizeEspnMatches({events: [null]}).length", workerContext), 0);
assert.equal(vm.runInContext("normalizeTimeline([null], []).length", workerContext), 0);
assert.equal(vm.runInContext("normalizeCommentary([null]).length", workerContext), 0);
assert.equal(vm.runInContext("normalizeBroadcasts([{names: {}}]).length", workerContext), 0);
assert.equal(vm.runInContext("normalizeEspnStandings({standings: {entries: [null, {stats: [null, {name: 'pointDifferential', value: 4}]}]}})[0].goalDifference", workerContext), "4");

const popupSource = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
const storage = new Map();
const popupContext = vm.createContext({
  URL, AbortController, console, setTimeout, clearTimeout,
  document: { addEventListener() {}, hidden: false },
  window: { location: { protocol: "chrome-extension:" } },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
});
vm.runInContext(popupSource, popupContext);
const match = { id: "760486", leagueCode: "eng.1", homeTeam: "Home", awayTeam: "Away", state: "live" };
const payload = { matches: [match], leagues: ["fifa.world", "uefa.nations", "uefa.euro", "conmebol.america"].map((code) => ({ code, name: code, matches: [] })) };
const cache = { version: "v10", payload, savedAt: Date.now() };
storage.set("hype_live_matches_cache", JSON.stringify(cache));
assert.ok(vm.runInContext("readClientLiveCache()", popupContext));
for (const invalid of [
  { ...cache, payload: { ...payload, leagues: {} } },
  { ...cache, payload: { ...payload, matches: [null] } },
  { ...cache, payload: { ...payload, leagues: [null] } },
  { ...cache, savedAt: Date.now() + 60_000 },
]) {
  storage.set("hype_live_matches_cache", JSON.stringify(invalid));
  assert.equal(vm.runInContext("readClientLiveCache()", popupContext), null);
}

let finishDetail;
popupContext.fetch = async (_url, { signal }) => new Promise((resolve, reject) => {
  signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
  finishDetail = () => resolve(new Response("{}", { headers: { "Content-Type": "application/json" } }));
});
popupContext.testMatch = match;
const firstDetail = vm.runInContext("loadMatchDetail(testMatch)", popupContext);
vm.runInContext("abortDetailRequest()", popupContext);
assert.equal(vm.runInContext("matchDetailCache.size", popupContext), 0, "power-off must immediately release the loading entry");
const secondDetail = vm.runInContext("loadMatchDetail(testMatch)", popupContext);
await firstDetail;
assert.equal(vm.runInContext("matchDetailCache.get(getDetailCacheKey(testMatch)).status", popupContext), "loading", "old cancellation must not delete a newer request");
finishDetail();
await secondDetail;
assert.equal(vm.runInContext("matchDetailCache.get(getDetailCacheKey(testMatch)).status", popupContext), "loaded");

let builds = 0;
let finishBuild;
const build = () => { builds += 1; return new Promise((resolve) => { finishBuild = resolve; }); };
const requests = [getDashboardPayload(7, true, build), getDashboardPayload(7, true, build)];
await Promise.resolve();
assert.equal(builds, 1, "concurrent forced refreshes must share one build");
finishBuild({ summary: { requests: 42 } });
assert.equal((await Promise.all(requests))[1].summary.requests, 42);
assert.equal((await getDashboardPayload(7, false, build)).cache, "HIT");
await assert.rejects(getDashboardPayload(30, true, async () => { throw new Error("offline"); }), /offline/);
assert.equal((await getDashboardPayload(30, true, async () => ({ recovered: true }))).recovered, true);
const missing = shapeDashboardData({}, null, 7);
for (const value of Object.values(missing.summary)) assert.equal(value, null, "unavailable sources must not become zero measurements");

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const localRequest = (headers) => new Promise((resolve, reject) => {
  const req = httpRequest({ hostname: "127.0.0.1", port, path: "/api/health", headers }, (response) => {
    response.resume();
    response.on("end", () => resolve(response.statusCode));
  });
  req.on("error", reject);
  req.end();
});
try {
  assert.equal(await localRequest({ Host: `127.0.0.1:${port}` }), 200);
  assert.equal(await localRequest({ Host: `localhost:${port}`, Origin: `http://localhost:${port}`, "Sec-Fetch-Site": "same-origin" }), 200);
  assert.equal(await localRequest({ Host: `attacker.test:${port}` }), 403);
  assert.equal(await localRequest({ Host: `127.0.0.1:${port}`, Origin: "https://attacker.test" }), 403);
  assert.equal(await localRequest({ Host: `127.0.0.1:${port}`, "Sec-Fetch-Site": "cross-site" }), 403);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("PASS hardening regressions: body timeout, bounded analytics, malformed cache, cancellation race, dashboard coalescing, missing data and localhost HTTP policy");
