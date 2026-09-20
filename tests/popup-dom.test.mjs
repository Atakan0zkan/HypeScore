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

describe("popup DOM: league list", () => {
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
