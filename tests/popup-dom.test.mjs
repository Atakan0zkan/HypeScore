import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadPopupDOM, domMatch, domPayload, standingsRows, workerJson } from "./dom-helpers.mjs";

let app;
beforeEach(async () => {
  app = await loadPopupDOM({
    fetchImpl: async () => workerJson({ matches: [], leagues: [] }),
  });
});
afterEach(async () => { await app.close(); });

function render(payload = domPayload()) {
  app.eval(`__T.lastPayload = ${JSON.stringify(payload)}`);
  app.eval("__T.renderLast()");
}
const cards = () => [...app.document.querySelectorAll(".league-pick-card")];
const cardByName = (name) => cards().find((c) => c.querySelector(".league-pick-name").textContent === name);

describe("popup DOM: concise league metadata", () => {
  const meta = matches => app.eval(`buildLeagueMetaText({matches:${JSON.stringify(matches)}}, countLiveMatches(${JSON.stringify(matches)}), countUpcomingMatches(${JSON.stringify(matches)}))`);
  const scheduled = count => Array.from({ length: count }, (_, i) => domMatch({ id: `scheduled-${i}`, state: "scheduled", kickoff: new Date(Date.now() + 3600000).toISOString() }));

  it("combines the upcoming count and noun without repeating the total", () => {
    assert.equal(meta(scheduled(4)), "4 upcoming matches");
    assert.equal(meta(scheduled(1)), "1 upcoming match");
    render({ matches: scheduled(4), leagues: [{ code: "arg.1", name: "Argentine Liga Profesional", matches: scheduled(4) }] });
    assert.equal(cardByName("Argentine Liga Profesional").querySelector(".league-pick-meta").textContent, "4 upcoming matches");
    cardByName("Argentine Liga Profesional").click();
    assert.equal(app.document.querySelector(".league-detail-meta").textContent, "4 upcoming matches");
  });

  it("uses singular and plural labels for live and completed matches", () => {
    assert.equal(meta([domMatch()]), "1 live match");
    assert.equal(meta([domMatch(), domMatch()]), "2 live matches");
    assert.equal(meta([domMatch({ state: "finished" })]), "1 completed match");
    assert.equal(meta(Array.from({ length: 4 }, () => domMatch({ state: "finished" }))), "4 completed matches");
  });

  it("counts mixed categories once each without adding a redundant total", () => {
    const matches = [domMatch(), ...scheduled(2), ...Array.from({ length: 3 }, () => domMatch({ state: "finished" }))];
    assert.equal(meta(matches), "1 live match · 2 upcoming matches · 3 completed matches");
    assert.ok(!meta(matches).includes("6 matches"));
  });

  it("retains sensible unknown-state and empty-data fallbacks", () => {
    assert.equal(meta([domMatch({ state: "postponed" })]), "1 match");
    assert.equal(meta([domMatch({ state: "postponed" }), domMatch({ state: "unknown" })]), "2 matches");
    assert.equal(meta([]), "No live matches");
    assert.equal(app.eval('buildLeagueMetaText({matches:{}}, 0, 0)'), "No live matches");
  });
});

describe("popup DOM: league match previews", () => {
  const select = (matches) => app.eval(`getLeaguePreviewMatch({matches:${JSON.stringify(matches)}})`);
  const preview = (match) => app.eval(`createLeagueMatchPreview(${JSON.stringify(match)})`);

  it("shows one live match and its real score directly below the league name", () => {
    render();
    const card = cardByName("Premier League");
    assert.equal(card.querySelectorAll(".league-pick-preview").length, 1);
    assert.equal(card.querySelector(".league-pick-name").nextElementSibling.className, "league-pick-preview league-pick-preview--live");
    assert.deepEqual([...card.querySelectorAll(".league-preview-team")].map(el => el.textContent), ["Arsenal", "Chelsea"]);
    assert.equal(card.querySelector(".league-preview-score").textContent, "2 – 1");
    assert.equal(card.querySelector(".league-preview-status").textContent, "67' · Live");
    assert.ok(card.getAttribute("aria-label").includes("Arsenal 2 – 1 Chelsea"));
    assert.equal(cardByName("LaLiga").querySelector(".league-pick-preview"), null);
  });

  it("recognizes half time from either provider status or clock without showing a stale minute", () => {
    for (const [status, minute] of [["Half Time", "45'"], ["HT", "45'+3'"], ["half-time", "45'"], ["STATUS_HALFTIME", "45'"], ["Live", "HT"], ["Live", "Half Time"]]) {
      const node = preview(domMatch({ status, minute }));
      assert.ok(node.classList.contains("league-pick-preview--half-time"));
      assert.equal(node.querySelector(".league-preview-status").textContent, "Half Time");
    }
  });

  it("labels finished matches Full Time regardless of a residual clock", () => {
    const node = preview(domMatch({ state: "finished", status: "FT", minute: "90'+6'" }));
    assert.equal(node.querySelector(".league-preview-status").textContent, "Full Time");
    assert.ok(node.classList.contains("league-pick-preview--finished"));
  });

  it("prioritizes live games with stable ordering when the API reorders matches", () => {
    const matches = [domMatch({ id: "z", homeTeam: "Zulu" }), domMatch({ id: "f", state: "finished" }), domMatch({ id: "a", homeTeam: "Ajax" })];
    assert.equal(select(matches).id, "a");
    assert.equal(select([...matches].reverse()).id, "a");
    assert.equal(select([domMatch({ id: "z" }), domMatch({ id: "a" })]).id, "a");
  });

  it("falls back to the latest finished kickoff when popularity is equal or unknown", () => {
    const older = domMatch({ id: "old", homeTeam: "Alpha FC", awayTeam: "Minor FC", state: "finished", kickoff: "2026-10-05T10:00:00Z" });
    const latest = domMatch({ id: "new", homeTeam: "Zulu FC", awayTeam: "Minor FC", state: "finished", kickoff: "2026-10-05T12:00:00Z" });
    const invalid = domMatch({ id: "bad", homeTeam: "Minor FC", awayTeam: "Unknown FC", state: "finished", kickoff: "invalid" });
    assert.equal(select([older, invalid, latest]).id, "new");
    assert.equal(select([{ ...invalid, id: "z", homeTeam: "Zulu FC" }, { ...invalid, id: "a", homeTeam: "Alpha FC" }]).id, "a");
    assert.equal(select([{ ...latest, id: "z" }, { ...latest, id: "a" }]).id, "a");
  });

  it("prefers popular club matchups within each phase but never puts a result ahead of a live game", () => {
    const small = domMatch({ id: "small", homeTeam: "Alpha FC", awayTeam: "Minor FC" });
    const popular = domMatch({ id: "popular", homeTeam: "Manchester United", awayTeam: "Liverpool" });
    assert.equal(select([small, popular]).id, "popular");
    assert.equal(select([popular, small]).id, "popular");
    assert.equal(select([{ ...popular, state: "finished", kickoff: "2026-10-05T10:00:00Z" }, { ...small, state: "finished", kickoff: "2026-10-05T12:00:00Z" }]).id, "popular");
    assert.equal(select([{ ...popular, state: "finished" }, small]).id, "small");
    const derby = domMatch({ id: "derby", homeTeam: "Manchester United", awayTeam: "Manchester City" });
    assert.equal(select([popular, derby]).id, "derby");
  });

  it("uses verified ESPN IDs and exact accent-normalized aliases without fuzzy club collisions", () => {
    const score = match => app.eval(`getMatchPopularityScore(${JSON.stringify(match)})`);
    assert.equal(score(domMatch({ homeTeam: "Provider-localized name", homeTeamId: "360", awayTeam: "Unknown" })), 2386);
    assert.equal(score(domMatch({ homeTeam: "Man Utd", awayTeam: "Unknown" })), 2386);
    assert.equal(score(domMatch({ leagueCode: "tur.1", homeTeam: "Fenerbahçe", awayTeam: "Beşiktaş" })), 616);
    assert.equal(score(domMatch({ homeTeam: "City", awayTeam: "United" })), 0);
    assert.equal(score(domMatch({ homeTeam: "Inter", awayTeam: "Sporting" })), 0);
    assert.equal(score(domMatch({ homeTeam: "Manchester United Youth", awayTeam: "Arsenal Women" })), 0);
  });

  it("does not apply men's club social reach to national or women's competitions", () => {
    for (const leagueCode of ["eng.w.1", "fifa.world", "uefa.euro", "uefa.nations", "conmebol.america", "unsupported"]) {
      const match = domMatch({ leagueCode, homeTeamId: "360", homeTeam: "Manchester United", awayTeam: "Liverpool" });
      assert.equal(app.eval(`getMatchPopularityScore(${JSON.stringify(match)})`), 0);
    }
  });

  it("does not present scheduled, cancelled, malformed or historical World Cup data as live", () => {
    const future = domMatch({ state: "scheduled", kickoff: new Date(Date.now() + 3600000).toISOString() });
    assert.equal(select([null, {}, future, domMatch({ state: "cancelled" }), domMatch({ homeTeam: null }), domMatch({ awayTeam: " " })]), null);
    assert.equal(select([domMatch({ leagueCode: "fifa.world", seasonYear: 2026, state: "finished", kickoff: "2026-07-19T18:00:00Z" })]), null);
    const payload = domPayload();
    payload.leagues[0].matches = [future];
    render(payload);
    assert.equal(cardByName("Premier League").querySelector(".league-pick-preview"), null);
    assert.ok(cardByName("Premier League").querySelector(".league-pick-meta"));
  });

  it("preserves zero scores and never converts missing or invalid scores to fake goals", () => {
    for (const [value, expected] of [[0, "0"], ["2", "2"], [null, "–"], ["", "–"], [-1, "–"], [2.5, "–"], ["<img>", "–"], [1000, "–"]]) {
      const node = preview(domMatch({ homeScore: value, awayScore: 0 }));
      assert.equal(node.querySelector(".league-preview-score").textContent, `${expected} – 0`);
    }
  });

  it("updates score and phase on normal renders without duplicate previews or changing favorites", () => {
    app.eval('__T.favoriteLeagues.add("eng.1")');
    for (const [state, status, label] of [["live", "Live", "67' · Live"], ["live", "Half Time", "Half Time"], ["finished", "Full Time", "Full Time"]]) {
      const match = domMatch({ state, status, homeScore: 3 });
      render({ matches: [match], leagues: [{ code: "eng.1", name: "Premier League", matches: [match] }] });
      const card = cardByName("Premier League");
      assert.equal(card.querySelectorAll(".league-pick-preview").length, 1);
      assert.equal(card.querySelector(".league-preview-score").textContent, "3 – 1");
      assert.equal(card.querySelector(".league-preview-status").textContent, label);
      assert.ok(card.querySelector(".favorite-btn--active"));
    }
  });

  it("renders provider names as isolated plain text and keeps full text available for truncated names", () => {
    const node = preview(domMatch({ homeTeam: '<img src=x onerror="alert(1)">', awayTeam: "A very long away team name" }));
    assert.equal(node.querySelectorAll("img,script").length, 0);
    assert.equal(node.querySelectorAll("bdi").length, 2);
    assert.equal(node.querySelector(".league-preview-team").title, '<img src=x onerror="alert(1)">');
    assert.equal(node.querySelector(".league-preview-score").dir, "ltr");
    assert.ok(node.title.includes("A very long away team name"));
  });

  it("keeps opening the league from the preview and isolates favorite button clicks", () => {
    render();
    cardByName("Premier League").querySelector(".favorite-btn").click();
    assert.equal(app.eval("__T.selectedLeagueKey"), null);
    cardByName("Premier League").querySelector(".league-pick-preview").click();
    assert.equal(app.eval("__T.selectedLeagueKey"), "eng.1");
  });

  it("adds no requests when selecting or rendering preview data", async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    let requests = 0;
    app.window.fetch = async () => { requests += 1; return workerJson(domPayload()); };
    select(domPayload().matches);
    render();
    render();
    assert.equal(requests, 0);
  });
});

describe("match presentation", () => {
  it("shows one ball per goal and tiny cards with a bounded vertical stack", () => {
    app.eval('window.shirt = document.createElement("span"); appendPlayerMatchBadges(window.shirt, {goals:5,yellowCards:2,redCards:1})');
    const shirt = app.window.shirt;
    assert.equal(shirt.querySelectorAll(".pitch-goal").length, 5);
    assert.equal(shirt.querySelectorAll(".pitch-card--yellow").length, 2);
    assert.equal(shirt.querySelectorAll(".pitch-card--red").length, 1);
    assert.deepEqual([...shirt.querySelectorAll(".pitch-goal")].map((ball) => ball.style.bottom), ["0px", "3px", "6px", "9px", "12px"]);
    assert.equal(shirt.querySelector(".pitch-goals").getAttribute("aria-label"), "⚽ × 5");
    app.eval('window.empty = document.createElement("span"); appendPlayerMatchBadges(window.empty, {goals:999,yellowCards:-1,redCards:"1"})');
    assert.equal(app.window.empty.childElementCount, 0);
  });
  it("recovers a cold-cache 404 exactly once after verifying the current scoreboard", async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const calls = [];
    app.window.fetch = async (url, options) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (calls.length === 1) return new Response('{}', {status:404});
      if (path === "/live-matches") assert.equal(options.cache, "reload");
      return workerJson(path === "/live-matches" ? domPayload() : {id:"m1",lineups:[]});
    };
    const data = await app.eval('fetchMatchDetailWithRecovery({id:"m1",leagueCode:"eng.1"}, new AbortController().signal)');
    assert.equal(data.id, "m1");
    assert.deepEqual(calls, ["/match-detail", "/live-matches", "/match-detail"]);
  });
  it("does not loop, retry absent IDs, or recover a non-404 failure", async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const status of [404, 502]) {
      let calls = 0;
      app.window.fetch = async (url) => {
        calls += 1;
        return new URL(url).pathname === "/live-matches" ? workerJson({matches:[]}) : new Response('{}', {status});
      };
      await assert.rejects(app.eval('fetchMatchDetailWithRecovery({id:"m1",leagueCode:"eng.1"}, new AbortController().signal)'), /Backend returned/);
      assert.equal(calls, status === 404 ? 2 : 1);
    }
  });
  it("stops after a second 404 and respects cancellation before recovery", async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let calls = 0;
    app.window.fetch = async (url) => {
      calls += 1;
      return new URL(url).pathname === "/live-matches" ? workerJson(domPayload()) : new Response('{}', {status:404});
    };
    await assert.rejects(app.eval('fetchMatchDetailWithRecovery({id:"m1",leagueCode:"eng.1"}, new AbortController().signal)'), /Backend returned 404/);
    assert.equal(calls, 3);
    calls = 0;
    await assert.rejects(app.eval('fetchMatchDetailWithRecovery({id:"m1",leagueCode:"eng.1"}, AbortSignal.abort())'), {name:"AbortError"});
    assert.equal(calls, 0);
  });
  it("sorts activity inside favorites and non-favorites independently", () => {
    const league = (code, state) => ({ code, name: code, matches: state ? [{ state, kickoff: new Date(Date.now() + 3600000).toISOString() }] : [] });
    const leagues = [league("a.empty", null), league("b.result", "finished"), league("c.upcoming", "scheduled"), league("d.live", "live")];
    const favorites = leagues.map((l) => ({ ...l, code: `f.${l.code}`, name: `f.${l.name}` }));
    for (const l of favorites) app.eval(`__T.favoriteLeagues.add(${JSON.stringify(l.code)})`);
    const ordered = app.eval(`${JSON.stringify([...leagues, ...favorites])}.sort(compareLeagues).map(l => l.code)`);
    assert.deepEqual(Array.from(ordered), ["f.d.live", "f.c.upcoming", "f.b.result", "f.a.empty", "d.live", "c.upcoming", "b.result", "a.empty"]);
  });

  it("does not promote fixtures outside the visible upcoming window", () => {
    assert.equal(app.eval(`getLeagueActivityRank({matches:[{state:'scheduled',kickoff:${JSON.stringify(new Date(Date.now() + 3 * 86400000).toISOString())}}]})`), 2);
  });

  it("renders proportional stats and preserves numeric zero", () => {
    const row = app.eval('createStatItem({label:"Shots",homeValue:5,awayValue:10})');
    const fills = row.querySelectorAll(".stat-bar-fill");
    assert.ok(Math.abs(parseFloat(fills[0].style.width) - 100 / 3) < 0.001);
    assert.ok(Math.abs(parseFloat(fills[1].style.width) - 200 / 3) < 0.001);
    const zero = app.eval('createStatItem({homeValue:0,awayValue:0})');
    assert.equal(zero.querySelector(".stat-value--home").textContent, "0");
    assert.equal(zero.querySelectorAll(".stat-bar-fill").length, 0);
    const percent = app.eval('createStatItem({homeValue:"40%",awayValue:"60%"})');
    assert.equal(percent.querySelector(".stat-bar-fill").style.width, "40%");
  });

  it("does not invent ratios from missing, composite or negative statistics", () => {
    for (const value of [null, "-", "5 (2)", "-1", "Infinity"]) {
      const row = app.eval(`createStatItem({homeValue:${JSON.stringify(value)},awayValue:10})`);
      assert.equal(row.querySelectorAll(".stat-bar-fill").length, 0);
    }
  });

  it("distinguishes event types without mislabeling missed penalties as goals", () => {
    for (const [type, kind] of [["Yellow Card", "yellow-card"], ["Second Yellow Card", "red-card"], ["Goal", "goal"], ["Own Goal", "own-goal"], ["Penalty - Scored", "goal"], ["Penalty - Missed", "penalty"], ["Kickoff", "kickoff"], ["VAR", "var"]]) {
      const row = app.eval(`createTimelineItem({type:${JSON.stringify(type)},minute:"45'+3'",text:"<img src=x onerror=alert(1)>"})`);
      assert.ok(row.classList.contains(`timeline-item--${kind}`));
      assert.equal(row.querySelector(".timeline-icon").getAttribute("aria-hidden"), "true");
      assert.equal(row.querySelector("img"), null);
      assert.equal(row.querySelector(".timeline-type").textContent, type);
    }
  });

  const lineup = (team) => ({ team, players: ["G", "LB", "CD-L", "CD-R", "RB", "LM", "RM", "AM-L", "AM", "AM-R", "F"].map((position, i) => ({ id: String(i), name: `${team} Player ${i}`, position, jersey: String(i + 1), starter: true })).concat({ name: "Bench Player", position: "F", starter: false }) });

  it("puts both starting XIs on a pitch and lists only substitutes underneath", () => {
    app.eval(`appendLineupsSection(${JSON.stringify([lineup("Home"), lineup("Away")])})`);
    assert.equal(app.document.querySelectorAll(".pitch-player").length, 22);
    assert.equal(app.document.querySelectorAll(".lineup-player").length, 2);
    assert.equal(app.document.querySelectorAll(".lineup-substitutes .lineup-team").length, 2);
    assert.equal(app.document.querySelectorAll(".lineup-player--starter").length, 0);
    assert.ok(!app.document.querySelector(".lineup-pitch").textContent.includes("Bench Player"));
    const names = [...app.document.querySelector(".pitch-half .pitch-line:nth-of-type(2)").querySelectorAll(".pitch-player")].map((p) => p.getAttribute("aria-label").split(" · ")[0]);
    assert.deepEqual(names, ["Home Player 1", "Home Player 2", "Home Player 3", "Home Player 4"]);
    assert.equal(app.document.querySelector(".lineup-section").tagName, "SECTION");
    assert.equal(app.document.querySelector(".lineup-roster"), null);
    assert.equal(app.document.querySelector(".lineup-substitutes").closest("details"), null);
    assert.ok(!app.document.querySelector(".lineup-section").textContent.includes("Full squads"));
  });

  it("falls back to rosters for incomplete XIs or unknown positions", () => {
    const incomplete = lineup("Home");
    incomplete.players.pop();
    incomplete.players.pop();
    assert.equal(app.eval(`getPitchLayout(${JSON.stringify(incomplete)})`), null);
    const unknown = lineup("Home");
    unknown.players[1].position = "Unknown";
    app.eval(`appendLineupsSection(${JSON.stringify([unknown, lineup("Away")])})`);
    assert.equal(app.document.querySelectorAll(".lineup-pitch").length, 0);
    assert.equal(app.document.querySelectorAll(".lineup-starters .lineup-team").length, 2);
    assert.equal(app.document.querySelectorAll(".lineup-substitutes .lineup-team").length, 2);
    assert.equal(app.document.querySelectorAll(".lineup-substitutes .lineup-player").length, 2);
  });

  it("handles absent or malformed rosters without inventing substitute players", () => {
    app.eval('appendLineupsSection([null, {team:"Home",players:{}}, {team:"Away",players:[null]}])');
    assert.equal(app.document.querySelectorAll(".lineup-player").length, 0);
    assert.equal(app.document.querySelectorAll(".lineup-pitch").length, 0);
    assert.equal(app.document.querySelectorAll(".lineup-substitutes .lineup-team").length, 2);
  });

  it("does not render the removed Commentary section from legacy API responses", () => {
    app.eval('renderLoadedMatchDetail({commentary:[{text:"legacy"}]})');
    assert.ok(!app.document.querySelector("#leagueDetailContent").textContent.includes("Commentary"));
    assert.ok(!app.document.querySelector("#leagueDetailContent").textContent.includes("legacy"));
  });
});

describe("popup DOM: league list", () => {
  it("merges news and highlights into one section with videos first and safe links", () => {
    app.eval('appendNewsHighlightsSection([{title:"Article",url:"https://www.espn.com/story"}], [{title:"Video",url:"https://www.espn.com/video/clip/1"},{title:"Unsafe",url:"javascript:alert(1)"}])');
    const section = app.document.querySelector('[data-section-key="media"]');
    assert.ok(section.querySelector("summary").textContent.includes("News"));
    assert.ok(section.querySelector("summary").textContent.includes("Highlights"));
    assert.ok(section.querySelector(".media-list").firstElementChild.classList.contains("video-card--highlight"));
    assert.equal(section.querySelectorAll("a").length, 2);
    assert.equal(section.querySelectorAll(".highlight-badge").length, 2);
    assert.equal(app.document.querySelectorAll("details").length, 1);
  });

  it("keeps lineups between the score and stats without an accordion", () => {
    const league = domPayload().leagues[0];
    app.eval(`__T.detailCache.set(getDetailCacheKey(${JSON.stringify(league.matches[0])}), {status:'loaded', data:{stats:[],lineups:[]}})`);
    app.eval(`renderMatchDetail(${JSON.stringify(league)}, ${JSON.stringify(league.matches[0])})`);
    const hero = app.document.querySelector(".match-detail-hero");
    assert.ok(hero.nextElementSibling.classList.contains("lineup-section"));
    assert.equal(hero.nextElementSibling.nextElementSibling.dataset.sectionKey, "stats");
  });

  it("restores independent scroll positions and section states without storage writes", () => {
    const payload = domPayload();
    for (const match of payload.matches) app.eval(`__T.detailCache.set(getDetailCacheKey(${JSON.stringify(match)}), {status:'loaded', data:{stats:[],lineups:[]}})`);
    app.eval('__T.standingsCache.set("eng.1", {status:"loaded",standings:[]})');
    render(payload);
    const pick = app.document.getElementById("leaguePickList");
    const detail = app.document.getElementById("leagueDetailContent");
    pick.scrollTop = 120;
    cardByName("Premier League").click();
    assert.equal(detail.scrollTop, 0);
    detail.scrollTop = 210;
    app.document.querySelector(".match-card").click();
    assert.equal(detail.scrollTop, 0);
    app.document.querySelector('[data-section-key="stats"]').open = true;
    detail.scrollTop = 330;
    app.document.getElementById("backBtn").click();
    assert.equal(detail.scrollTop, 210);
    app.document.querySelector(".match-card").click();
    assert.equal(detail.scrollTop, 330);
    assert.equal(app.document.querySelector('[data-section-key="stats"]').open, true);
    app.document.getElementById("backBtn").click();
    app.document.querySelectorAll(".match-card")[1].click();
    assert.equal(detail.scrollTop, 0);
    assert.equal(app.document.querySelector('[data-section-key="stats"]').open, false);
    app.document.getElementById("backBtn").click();
    app.document.getElementById("backBtn").click();
    assert.equal(pick.scrollTop, 120);
    assert.equal(app.window.localStorage.getItem("hype_navigation"), null);
  });

  it("preserves open sections through a same-view re-render and language switch", () => {
    const league = domPayload().leagues[0];
    app.eval(`__T.detailCache.set(getDetailCacheKey(${JSON.stringify(league.matches[0])}), {status:'loaded', data:{stats:[]}})`);
    render();
    cardByName("Premier League").click();
    app.document.querySelector(".match-card").click();
    app.document.querySelector('[data-section-key="media"]').open = true;
    app.document.getElementById("leagueDetailContent").scrollTop = 160;
    app.eval("toggleEnglishOverride()");
    assert.equal(app.document.querySelector('[data-section-key="media"]').open, true);
    assert.equal(app.document.getElementById("leagueDetailContent").scrollTop, 160);
  });

  it("keeps the saved position while a short loading shell is replaced with data", () => {
    const league = domPayload().leagues[0];
    const match = league.matches[0];
    const setCache = (value) => app.eval(`__T.detailCache.set(getDetailCacheKey(${JSON.stringify(match)}), ${JSON.stringify(value)})`);
    const show = () => app.eval(`renderMatchDetail(${JSON.stringify(league)}, ${JSON.stringify(match)})`);
    setCache({ status: "loaded", data: { stats: [] } });
    show();
    const detail = app.document.getElementById("leagueDetailContent");
    app.document.querySelector('[data-section-key="stats"]').open = true;
    detail.scrollTop = 400;
    setCache({ status: "loading" });
    show();
    detail.scrollTop = 0; // Browser clamps scroll while only the loading shell exists.
    setCache({ status: "loaded", data: { stats: [] } });
    show();
    assert.equal(detail.scrollTop, 400);
    assert.equal(app.document.querySelector('[data-section-key="stats"]').open, true);
  });

  it("renders one card per league with names and meta", () => {
    render();
    assert.equal(cards().length, 2);
    const names = cards().map((c) => c.querySelector(".league-pick-name").textContent);
    assert.ok(names.includes("Premier League") && names.includes("LaLiga"));
  });

  it("keeps live status in the match preview and only the favorite button on the right", () => {
    render();
    assert.equal(app.document.querySelectorAll(".league-pick-badge").length, 0);
    assert.equal(cardByName("Premier League").querySelector(".league-preview-status").textContent, "67' · Live");
    for (const card of cards()) {
      const actions = card.querySelector(".league-card-actions");
      assert.equal(actions.childElementCount, 1);
      assert.ok(actions.firstElementChild.classList.contains("favorite-btn"));
    }
  });

  it("favorite league sorts first with active star", () => {
    render();
    app.eval('toggleFavoriteLeague("esp.1")');
    assert.equal(app.document.querySelector(".league-pick-card .league-pick-name").textContent, "LaLiga");
    assert.ok(app.document.querySelector(".league-pick-card .favorite-btn--active"), "star active");
    assert.equal(app.eval('JSON.parse(localStorage.getItem("hype_favorite_leagues"))').length, 1);
  });

  it("click opens league detail, back returns to list", () => {
    render();
    cardByName("Premier League").click();
    assert.equal(app.document.getElementById("leagueDetailView").hidden, false);
    assert.equal(app.document.getElementById("leaguePickList").hidden, true);
    assert.equal(app.eval("__T.selectedLeagueKey"), "eng.1");
    app.document.getElementById("backBtn").click();
    assert.equal(app.document.getElementById("leaguePickList").hidden, false);
  });

  it("keyboard Enter opens league detail", () => {
    render();
    cards()[0].dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.equal(app.document.getElementById("leagueDetailView").hidden, false);
  });
});

describe("popup DOM: league detail + standings", () => {
  it("detail shows live/results/upcoming sections in order", () => {
    render();
    app.eval(`renderLeagueDetail(${JSON.stringify(domPayload().leagues[0])})`);
    const titles = [...app.document.querySelectorAll(".match-section .section-title")].map((t) => t.textContent);
    assert.deepEqual(titles, [`\u25CF ${app.eval('msg("live")')}`, app.eval('msg("results")'), app.eval('msg("upcoming")')]);
    assert.equal(app.document.querySelectorAll(".match-card").length, 3);
  });

  it("loaded standings render a 10-column table with team rows", () => {
    render();
    app.eval(`__T.standingsCache.set("eng.1", ${JSON.stringify({ standings: standingsRows() })})`);
    app.eval(`renderLeagueDetail(${JSON.stringify(domPayload().leagues[0])})`);
    const table = app.document.querySelector(".standings-table");
    assert.ok(table, "table rendered");
    assert.equal(table.querySelectorAll("thead th").length, 10);
    const bodyNames = [...table.querySelectorAll(".standings-team-name")].map((n) => n.textContent);
    assert.deepEqual(bodyNames, ["Arsenal", "Chelsea"]);
  });

  it("empty standings show the empty message, codeless league too", () => {
    render();
    app.eval('__T.standingsCache.set("eng.1", { standings: [] })');
    app.eval(`renderLeagueDetail(${JSON.stringify(domPayload().leagues[0])})`);
    assert.ok(app.document.querySelector(".standings-message"), "empty message shown");
    const section = app.eval("createStandingsSection({})");
    assert.ok(section.textContent.length > 0);
  });
});

describe("popup DOM: match detail", () => {
  it("opens hero with teams/scores and pauses main refresh", () => {
    render();
    // record clearTimeout: openMatchDetail must cancel the live timer
    // (clearTimeout does not null the variable, so observe the call).
    app.eval('window.__cleared = []; window.__origClear = window.clearTimeout; window.clearTimeout = (id) => { window.__cleared.push(id); return window.__origClear(id); };');
    app.eval(`openMatchDetail(${JSON.stringify(domPayload().leagues[0])}, ${JSON.stringify(domPayload().matches[0])})`);
    const hero = app.document.querySelector(".match-detail-hero");
    assert.ok(hero, "hero rendered");
    assert.ok(hero.textContent.includes("Arsenal") && hero.textContent.includes("Chelsea"));
    assert.ok(app.eval("window.__cleared.length") > 0, "live refresh timer cancelled");
  });

  it("empty detail data shows the no-details panel", () => {
    render();
    const match = domPayload().matches[0];
    app.eval(`__T.detailCache.set("eng.1:${match.id}", { data: {} })`);
    app.eval(`openMatchDetail(${JSON.stringify(domPayload().leagues[0])}, ${JSON.stringify(match)})`);
    assert.ok(app.document.querySelector(".match-detail-hero"), "hero still rendered");
  });

  it("match card keyboard opens detail from league view", () => {
    render();
    app.eval(`renderLeagueDetail(${JSON.stringify(domPayload().leagues[0])})`);
    const card = app.document.querySelector(".match-card");
    assert.equal(card.getAttribute("role"), "button");
    card.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    assert.ok(app.document.querySelector(".match-detail-hero"), "detail opened via keyboard");
  });
});

describe("popup DOM: header toggles", () => {
  it("power off grays UI with overlay, state persists", () => {
    render();
    app.document.getElementById("powerToggle").click();
    assert.equal(app.eval("__T.isEnabled"), false);
    assert.ok(app.document.querySelector(".app-shell--disabled"), "disabled class");
    assert.ok(app.document.querySelector(".content-overlay"), "overlay added");
    assert.equal(app.window.localStorage.getItem("hype_enabled"), "0");
  });

  it("ENG toggle forces English and persists without fetching", async () => {
    let fetches = 0;
    await app.close();
    app = await loadPopupDOM({ fetchImpl: async () => { fetches += 1; return workerJson({ matches: [], leagues: [] }); } });
    render();
    fetches = 0; // ignore the boot load; ENG toggle itself must not fetch
    app.document.getElementById("englishToggle").click();
    assert.equal(app.eval("__T.isEnglishOverride"), true);
    assert.equal(app.window.localStorage.getItem("hype_english_override"), "1");
    assert.equal(fetches, 0, "ENG toggle must not fetch");
    assert.equal(app.document.documentElement.getAttribute("dir") || "ltr", "ltr");
  });
});
