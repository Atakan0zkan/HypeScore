import { readFile } from "node:fs/promises";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);

export async function loadWorkerSource() {
  return readFile(new URL("../worker/index.js", import.meta.url), "utf8");
}

export async function loadPopupSource() {
  return readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
}

// Minimal VM for worker pure functions. No network, no deps.
export async function loadWorkerContext(overrides = {}) {
  const source = await loadWorkerSource();
  const quiet = { log() {}, warn() {}, error: (...a) => console.error(...a) };
  const ctx = vm.createContext({
    URL, Request, Response, Headers, AbortController, console: quiet,
    setTimeout, clearTimeout, queueMicrotask,
    fetch: overrides.fetch ?? (async () => {
      throw new Error("fetch not stubbed");
    }),
    caches: overrides.caches ?? {
      default: { match: async () => undefined, put: async () => undefined },
    },
    ...overrides.globals,
  });
  const runnable = source.replace("export default", "const __workerDefault =");
  vm.runInContext(`${runnable}\nglobalThis.__W = { normalizeEspnMatches: typeof normalizeEspnMatches !== "undefined" ? normalizeEspnMatches : undefined, normalizeTimeline: typeof normalizeTimeline !== "undefined" ? normalizeTimeline : undefined, normalizeCommentary: typeof normalizeCommentary !== "undefined" ? normalizeCommentary : undefined, normalizeBroadcasts: typeof normalizeBroadcasts !== "undefined" ? normalizeBroadcasts : undefined, groupMatchesByLeague: typeof groupMatchesByLeague !== "undefined" ? groupMatchesByLeague : undefined, handleRequest: typeof handleRequest !== "undefined" ? handleRequest : undefined, isSafeEventId: typeof isSafeEventId !== "undefined" ? isSafeEventId : undefined, isChromeExtensionOrigin: typeof isChromeExtensionOrigin !== "undefined" ? isChromeExtensionOrigin : undefined, getRequestOriginPolicy: typeof getRequestOriginPolicy !== "undefined" ? getRequestOriginPolicy : undefined };`, ctx);
  return { ctx, run: (expr) => vm.runInContext(expr, ctx), source };
}

// In-memory Cache API stand-in keyed by URL. Stores status+body.
export function memoryCache() {
  const store = new Map();
  return {
    async match(req) {
      const hit = store.get(String(req.url || req));
      return hit ? new Response(hit.body, { status: hit.status, headers: { "Content-Type": "application/json" } }) : undefined;
    },
    async put(req, res) {
      store.set(String(req.url || req), { body: await res.clone().text(), status: res.status });
    },
    size: () => store.size,
  };
}

// Minimal ESPN scoreboard event for eng.1 (league id 700).
export function espnEvent({ id = "760486", leagueId = "700", state = "in", kickoff = null } = {}) {
  const team = (homeAway, name) => ({
    homeAway, score: state === "in" ? "1" : "0",
    team: { id: homeAway === "home" ? "331" : "332", displayName: name },
  });
  return {
    id, uid: `s:500~l:${leagueId}~e:${id}`,
    date: kickoff || new Date().toISOString(),
    competitions: [{
      id, date: kickoff || new Date().toISOString(),
      status: { type: { state } },
      competitors: [team("home", "Home FC"), team("away", "Away FC")],
      venue: {},
    }],
  };
}

export function scoreboardResponse(events) {
  return new Response(JSON.stringify({ leagues: [], events }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

// Minimal VM for popup pure logic. Mirrors hardening-test stub:
// DOMContentLoaded never fires in VM, so heavy DOM init is skipped.
export async function loadPopupContext() {
  const source = await loadPopupSource();
  const storage = new Map();
  const quiet = { log() {}, warn() {}, error: (...a) => console.error(...a) };
  const ctx = vm.createContext({
    URL, AbortController, console: quiet, setTimeout, clearTimeout, queueMicrotask,
    Date, JSON, Math, Number, Object, Array, Set, Map, Promise, RegExp, Error,
    encodeURIComponent, decodeURIComponent,
    document: { addEventListener() {}, hidden: false, createElement: () => { throw new Error("DOM not needed"); } },
    window: { location: { protocol: "chrome-extension:" } },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
  });
  vm.runInContext(source, ctx);
  return { ctx, run: (expr) => vm.runInContext(expr, ctx), storage, source };
}

export function matchRow(over = {}) {
  return {
    id: "760486", leagueCode: "eng.1", homeTeam: "Home", awayTeam: "Away",
    state: "live", status: "1H", minute: "23'", kickoff: new Date().toISOString(),
    ...over,
  };
}

export function livePayload({ live = true, upcoming = false } = {}) {
  const matches = [];
  if (live) matches.push(matchRow({ state: "live" }));
  if (upcoming) {
    matches.push(matchRow({
      id: "760487", state: "scheduled",
      kickoff: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    }));
  }
  const codes = ["fifa.world", "uefa.nations", "uefa.euro", "conmebol.america", "eng.1"];
  return {
    matches,
    leagues: codes.map((code) => ({ code, name: code, matches: [] })),
  };
}

export { ROOT };
