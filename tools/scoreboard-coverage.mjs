// Deeper, opt-in release/daily probe. Never runs in the extension or Worker.
const PROVIDER_BASES = ["https://site.api.espn.com", "https://site.web.api.espn.com"];
const MAX_BYTES = 8 * 1024 * 1024;
const EVENT_LIMIT = 1000;
const START_GRACE_MS = 2 * 60 * 1000;
const fail = (code, message, status) => Object.assign(new Error(message), {code, status});

async function fetchScoreboard(code, {fetchImpl, timeoutMs}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let index = 0; index < PROVIDER_BASES.length; index++) {
      try {
        const response = await fetchImpl(`${PROVIDER_BASES[index]}/apis/site/v2/sports/soccer/${code}/scoreboard?limit=${EVENT_LIMIT}`, {
          headers:{Accept:"application/json", "User-Agent":"HypeScore-HealthMonitor/1.0"},
          redirect:"error", signal:controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          throw fail(`PROVIDER_HTTP_${response.status}`, `Provider returned HTTP ${response.status}`, response.status);
        }
        if (!/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
          await response.body?.cancel().catch(() => {});
          throw fail("PROVIDER_INVALID_DATA", "Provider returned non-JSON data");
        }
        if (Number(response.headers.get("content-length")) > MAX_BYTES) {
          await response.body?.cancel().catch(() => {});
          throw fail("PROVIDER_TOO_LARGE", "Provider scoreboard exceeds the size limit",413);
        }
        const chunks = [];
        let bytes = 0;
        if (response.body) {
          for await (const chunk of response.body) {
            bytes += chunk.byteLength;
            if (bytes > MAX_BYTES) throw fail("PROVIDER_TOO_LARGE", "Provider scoreboard exceeds the size limit",413);
            chunks.push(chunk);
          }
        }
        const data = response.body ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : await response.json();
        if (!data || !Array.isArray(data.events) || !Array.isArray(data.leagues) || !data.leagues.some(league => league?.slug === code)) {
          throw fail("PROVIDER_INVALID_DATA", "Provider scoreboard schema or league identity changed");
        }
        if (data.events.length >= EVENT_LIMIT) throw fail("PROVIDER_TRUNCATED", "Provider scoreboard reached its event limit",413);
        return data;
      } catch (error) {
        const retry = error.status == null || error.status === 403 || error.status === 408 || error.status >= 500;
        if (index === PROVIDER_BASES.length - 1 || !retry || controller.signal.aborted) throw error;
      }
    }
  } finally { clearTimeout(timer); }
}

export async function checkLiveFixtureCoverage(payload, {fetchImpl = globalThis.fetch, timeoutMs = 10000, now = Date.now} = {}) {
  if (!Array.isArray(payload?.leagues) || payload.leagues.length !== 32 ||
      !Array.isArray(payload.matches) || payload.leagues.some(league => !/^[a-z][a-z0-9]*(?:\.[a-z0-9]+){1,3}$/.test(league?.code || "") || league.code.length > 64) ||
      new Set(payload.leagues.map(league => league.code)).size !== 32) throw new Error("Coverage requires 32 unique valid league codes");
  const leagues = payload.leagues.filter(league => league.code !== "fifa.world");
  const issued = new Set(payload.matches.map(match => `${match.leagueCode}:${match.id}`));
  const observedAt = now();
  const results = new Array(leagues.length);
  let next = 0;
  async function worker() {
    while (next < leagues.length) {
      const index = next++;
      const league = leagues[index];
      const name = `Live fixture coverage ${league.code}`;
      try {
        const data = await fetchScoreboard(league.code, {fetchImpl,timeoutMs});
        const providerId = String(data.leagues.find(row => row?.slug === league.code)?.id || "");
        if (/^\d+$/.test(String(league.id || "")) && providerId !== String(league.id)) {
          throw fail("LEAGUE_ID_MISMATCH", "Provider league ID differs from the published mapping");
        }
        const live = data.events.filter(event => {
          const status = event?.competitions?.[0]?.status || event?.status;
          if (status?.type?.state !== "in" || status.type.completed) return false;
          const start = Date.parse(event.date || event.competitions?.[0]?.date || "");
          // Avoid an alert during the normal cache/provider propagation window.
          return !Number.isFinite(start) || start <= observedAt - START_GRACE_MS;
        });
        const missing = live.filter(event => !issued.has(`${league.code}:${event.id}`));
        results[index] = missing.length ? {name,status:"failed",code:"MISSING_LIVE_FIXTURES",
          detail:`${missing.length} live fixture(s) missing; IDs ${missing.slice(0,5).map(event => /^\d{3,20}$/.test(String(event.id)) ? event.id : "invalid").join(", ")}`} :
          {name,status:"ok",detail:`${live.length} established live fixture(s) present`};
      } catch (error) {
        results[index] = {name,status:"failed",code:error.code || (error.name === "AbortError" ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR"),
          detail:"Provider coverage could not be verified"};
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,leagues.length)},worker));
  return results;
}
