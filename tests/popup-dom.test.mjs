import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadPopupDOM, domPayload, standingsRows, workerJson } from "./dom-helpers.mjs";

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

describe("match presentation", () => {
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

  it("puts only both starting XIs on a pitch and retains the full roster", () => {
    app.eval(`appendLineupsSection(${JSON.stringify([lineup("Home"), lineup("Away")])})`);
    assert.equal(app.document.querySelectorAll(".pitch-player").length, 22);
    assert.equal(app.document.querySelectorAll(".lineup-player").length, 24);
    assert.ok(!app.document.querySelector(".lineup-pitch").textContent.includes("Bench Player"));
    const names = [...app.document.querySelector(".pitch-half .pitch-line:nth-of-type(2)").querySelectorAll(".pitch-player")].map((p) => p.getAttribute("aria-label").split(" · ")[0]);
    assert.deepEqual(names, ["Home Player 1", "Home Player 2", "Home Player 3", "Home Player 4"]);
    assert.equal(app.document.querySelector(".lineup-section").tagName, "SECTION");
    assert.equal(app.document.querySelector(".lineup-roster").open, false);
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
    assert.equal(app.document.querySelectorAll(".lineup-team").length, 2);
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

  it("live league gets a badge, quiet league gets none", () => {
    render();
    assert.ok(cardByName("Premier League").querySelector(".league-pick-badge"), "live badge present");
    assert.equal(cardByName("LaLiga").querySelector(".league-pick-badge"), null);
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
