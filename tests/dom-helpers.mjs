import { Window } from "happy-dom";
import { readFile } from "node:fs/promises";

// Full popup runtime in a real DOM (popup.html + popup.js, no mocks
// except fetch). Each call returns an isolated window.
export async function loadPopupDOM({ fetchImpl = null } = {}) {
  const html = await readFile(new URL("../extension/popup.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");
  const window = new Window({ url: "chrome-extension://test/popup.html" });
  if (fetchImpl) window.fetch = fetchImpl;
  window.document.write(html);
  // NOTE: happy-dom runs each eval() in a fresh lexical scope sharing one
  // global object. `function` declarations survive (global object props) but
  // top-level `let/const` do not. The bridge below is appended to the SAME
  // eval as the popup source so it can close over those bindings. It is
  // test-only; the shipped popup.js is untouched.
  window.eval(`${js}\n;window.__T = {
    get lastPayload(){ return lastPayload; }, set lastPayload(v){ lastPayload = v; },
    get selectedLeagueKey(){ return selectedLeagueKey; },
    get selectedMatchKey(){ return selectedMatchKey; },
    get refreshTimer(){ return refreshTimer; },
    get isEnabled(){ return isEnabled; },
    get isEnglishOverride(){ return isEnglishOverride; },
    get dailyLimitReached(){ return dailyLimitReached; },
    get autoPausedForSession(){ return autoPausedForSession; },
    get inactivePaused(){ return inactivePaused; },
    get consecutiveRefreshErrors(){ return consecutiveRefreshErrors; },
    set consecutiveRefreshErrors(v){ consecutiveRefreshErrors = v; },
    get lastFetchCompletedAt(){ return lastFetchCompletedAt; },
    set lastFetchCompletedAt(v){ lastFetchCompletedAt = v; },
    get favoriteLeagues(){ return favoriteLeagues; },
    get standingsCache(){ return leagueStandingsCache; },
    get detailCache(){ return matchDetailCache; },
    renderLast(){ renderPayload(lastPayload); },
  };`);
  // happy-dom does not fire DOMContentLoaded for document.write() before the
  // script registers its listener, so boot the popup explicitly. The handler
  // only (re)assigns element refs and listeners, so a later native fire is
  // harmless.
  window.document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));
  return {
    window,
    document: window.document,
    eval: (expr) => window.eval(expr),
    close: () => window.happyDOM.close(),
  };
}

export function domMatch(over = {}) {
  return {
    id: "m1", leagueCode: "eng.1", league: "Premier League",
    homeTeam: "Arsenal", awayTeam: "Chelsea",
    homeScore: 2, awayScore: 1, homeLogo: null, awayLogo: null,
    state: "live", status: "2H", minute: "67'",
    kickoff: new Date().toISOString(), venue: "Emirates Stadium",
    ...over,
  };
}

export function domPayload() {
  const live = domMatch({});
  const finished = domMatch({ id: "m2", homeTeam: "Liverpool", awayTeam: "City", homeScore: 1, awayScore: 1, state: "finished", status: "FT" });
  const upcoming = domMatch({
    id: "m3", homeTeam: "Spurs", awayTeam: "Villa", homeScore: 0, awayScore: 0,
    state: "scheduled", status: "Scheduled",
    kickoff: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  });
  return {
    matches: [live, finished, upcoming],
    leagues: [
      { code: "eng.1", name: "Premier League", logoTone: "dark", matches: [live, finished, upcoming] },
      { code: "esp.1", name: "LaLiga", logoTone: "dark", matches: [] },
    ],
  };
}

export function standingsRows() {
  return [
    { position: 1, team: "Arsenal", logo: null, played: 10, wins: 8, draws: 1, losses: 1, goalsFor: 20, goalsAgainst: 8, goalDifference: "+12", points: 25 },
    { position: 2, team: "Chelsea", logo: null, played: 10, wins: 7, draws: 2, losses: 1, goalsFor: 18, goalsAgainst: 9, goalDifference: "+9", points: 23 },
  ];
}

// Minimal Worker-shaped JSON for stubbed fetch calls.
export function workerJson(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
