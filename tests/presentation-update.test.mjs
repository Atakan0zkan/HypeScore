import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadPopupDOM, domMatch, workerJson } from "./dom-helpers.mjs";
import { loadWorkerContext, memoryCache } from "./helpers.mjs";

let app;
beforeEach(async () => {
  app = await loadPopupDOM({ fetchImpl: async () => workerJson({ matches: [], leagues: [] }) });
});
afterEach(async () => { await app.close(); });

describe("match hero presentation", () => {
  it("shows a single central score with the current minute above it", () => {
    const match = domMatch({ homeScore: 3, awayScore: 1, minute: "90'+4'" });
    app.eval(`renderMatchDetail({name:"Premier League"}, ${JSON.stringify({ ...match, leagueCode: "" })})`);
    const hero = app.document.querySelector(".match-detail-hero");
    assert.equal(hero.querySelectorAll(".detail-team-score").length, 0);
    assert.equal(hero.querySelectorAll(".detail-score").length, 1);
    assert.equal(hero.querySelector(".detail-score").textContent, "3 - 1");
    assert.equal(hero.querySelector(".detail-score-block").firstElementChild.className, "detail-minute");
    assert.equal(hero.querySelector(".detail-minute").textContent, "90'+4'");
    assert.deepEqual([...hero.querySelectorAll(".detail-team-name")].map(el => el.textContent), ["Arsenal", "Chelsea"]);
  });

  it("keeps zero scores and translated half-time/full-time labels in the single score block", () => {
    for (const [minute, expected] of [["HT", "HT"], ["FT", "FT"]]) {
      const block = app.eval(`createScoreBlock(${JSON.stringify(domMatch({ homeScore: 0, awayScore: 0, minute }))})`);
      assert.equal(block.firstElementChild.textContent, expected);
      assert.equal(block.lastElementChild.textContent, "0 - 0");
    }
  });

  it("removes the visible lineup heading but keeps an accessible section name", () => {
    app.eval("appendLineupsSection([])");
    const section = app.document.querySelector(".lineup-section");
    assert.equal(section.querySelectorAll(".lineup-heading").length, 0);
    assert.equal(section.getAttribute("aria-label"), app.eval('msg("lineups")'));
  });
});

describe("safe, high-quality logos", () => {
  it("packages the current official TFF Trendyol logo instead of the legacy Spor Toto mark", async () => {
    // Unmodified asset from https://www.tff.org/Images/Common/tsl.png,
    // referenced by TFF's official league/logo pages and verified 2026-11-07.
    const image = await readFile(new URL("../extension/icons/leagues/tur-1.png", import.meta.url));
    assert.equal(createHash("sha256").update(image).digest("hex"), "2f2585a9c276fa8552950b853074409f587bcbdf8c0d119d1722bf577290c0fa");
    assert.equal(image.readUInt32BE(16), 131);
    assert.equal(image.readUInt32BE(20), 144);
  });

  it("gives the official dark-wordmark Süper Lig logo a light canvas even with old Worker metadata", () => {
    const image = app.eval('createLogoImage("league-pick-logo", getLeagueLogo({code:"tur.1"}), "Turkish Super Lig", {tone:"dark"})');
    assert.equal(image.classList.contains("league-logo--light"), true);
    assert.match(image.querySelector("img").getAttribute("src"), /^icons\/leagues\/tur-1\.png\?v=trendyol-2024$/);
  });

  it("rejects untrusted, credential-bearing and nonstandard-port image URLs before assigning src", () => {
    const fallback = app.eval('createLogoImage("detail-team-logo", null, "").src');
    for (const src of ["https://untrusted.example/crest.png", "https://a.espncdn.com@untrusted.example/a.png", "https://user:pass@a.espncdn.com/a.png", "https://a.espncdn.com:444/a.png", "javascript:alert(1)", "icons/../popup.html", "data:image/svg+xml,<svg/>"]) {
      const image = app.eval(`createLogoImage("detail-team-logo", ${JSON.stringify(src)}, "Team")`);
      assert.equal(image.src, fallback, src);
    }
  });

  it("retains high-resolution allowed assets and falls back only once on an image error", () => {
    const src = "https://a.espncdn.com/i/teamlogos/soccer/500/368.png";
    const image = app.eval(`createLogoImage("detail-team-logo", ${JSON.stringify(src)}, "Everton")`);
    assert.equal(image.src, src);
    assert.equal(image.decoding, "async");
    assert.equal(image.referrerPolicy, "no-referrer");
    image.onerror.call(image, new app.window.Event("error"));
    const fallback = app.eval('createLogoImage("detail-team-logo", null, "").src');
    assert.equal(image.src, fallback);
    assert.equal(image.onerror, null);
    image.dispatchEvent(new app.window.Event("error"));
    assert.equal(image.src, fallback);
    const league = app.eval('createLogoImage("league-pick-logo", getLeagueLogo({code:"eng.1"}), "Premier League")');
    assert.equal(league.querySelector("img").getAttribute("src"), "icons/leagues/eng-1.png");
  });

  it("selects a valid full-size team crest rather than an earlier thumbnail or untrusted URL", async () => {
    const { run } = await loadWorkerContext();
    const team = { id: "368", logos: [
      { href: "https://a.espncdn.com/i/teamlogos/soccer/50/368.png", width: 50, height: 50, rel: ["full", "default"] },
      { href: "https://bad.example/crest.png", width: 2000, height: 2000 },
      { href: "https://a.espncdn.com/i/teamlogos/soccer/500/368.png", width: 500, height: 500, rel: ["full", "default"] },
    ] };
    assert.equal(run(`getTeamLogoFromTeam(${JSON.stringify(team)})`), team.logos[2].href);
    assert.equal(run('getTeamLogoFromTeam({id:"368",logos:[null,{href:"https://bad.example/crest.png"}]})'), team.logos[2].href);
    assert.equal(run(`getTeamLogoFromTeam(${JSON.stringify({logos:[{...team.logos[0],width:{toString:"not callable"}},team.logos[2]]})})`), team.logos[2].href);
    assert.equal(run(`getTeamLogoFromTeam(${JSON.stringify({logos:[team.logos[0],{...team.logos[2],rel:["full","dark"]}]})})`), team.logos[2].href);
  });
});

describe("provider-backed standings zones", () => {
  const entry = (description, rank = 1) => ({
    team: { displayName: "Team" }, stats: [{ name: "rank", value: rank }],
    ...(description == null ? {} : { note: { description, color: "not trusted CSS" } }),
  });

  it("preserves European qualification, qualifying rounds and relegation/playoff distinctions", async () => {
    const { run } = await loadWorkerContext();
    for (const [description, kind, phase] of [
      ["Champions League", "champions-league", "direct"],
      ["Champions League qualifying", "champions-league", "qualifying"],
      ["Europa League", "europa-league", "direct"],
      ["Europa League qualifying", "europa-league", "qualifying"],
      ["Conference League qualifying", "conference-league", "qualifying"],
      ["UEFA Europa Conference League", "conference-league", "direct"],
      ["Relegation", "relegation", "direct"],
      ["Relegated", "relegation", "direct"],
      ["Relegation playoff", "relegation", "playoff"],
      ["Eliminated", "elimination", "direct"],
    ]) {
      const rows = run(`normalizeEspnStandings(${JSON.stringify({ standings: { entries: [entry(description)] } })})`);
      assert.equal(rows[0].zone?.kind, kind, description);
      assert.equal(rows[0].zone.phase, phase, description);
      assert.equal(rows[0].zone.description, description);
      assert.equal("color" in rows[0].zone, false);
    }
  });

  it("renders the Süper Lig provider notes for European places and all three relegation positions", async () => {
    const notes = ["Champions League", "Champions League qualifying", "Europa League qualifying", "Conference League qualifying"];
    const entries = Array.from({length:18}, (_,i) => ({...entry(i < 4 ? notes[i] : i >= 15 ? "Relegated" : null,i+1),team:{displayName:`Team ${i+1}`}}));
    const { run } = await loadWorkerContext();
    const standings = run(`normalizeEspnStandings(${JSON.stringify({children:[{name:"Turkish Super Lig",standings:{entries}}]})})`);
    app.eval(`__T.standingsCache.set("tur.1", {status:"loaded",standings:${JSON.stringify(standings)}})`);
    const section = app.eval('createStandingsSection({code:"tur.1"})');
    const redRanks = [...section.querySelectorAll("td.standings-position--relegation")].map(el => Number(el.textContent));
    assert.deepEqual(redRanks, [16,17,18]);
    assert.equal(section.querySelectorAll("td.standings-position--champions-league").length, 2);
    assert.equal(section.querySelectorAll("td.standings-position--europa-league").length, 1);
    assert.equal(section.querySelectorAll("td.standings-position--conference-league").length, 1);
    assert.equal(section.querySelectorAll("tbody tr").length, 18);
  });

  it("never invents zones from a team's rank or from unknown/malformed provider notes", async () => {
    const { run } = await loadWorkerContext();
    for (const note of [undefined, null, [], "Champions League", { description: 5 }, { description: "<img src=x>" }, { description: "CONCACAF Champions League" }]) {
      const rows = run(`normalizeEspnStandings(${JSON.stringify({ standings: { entries: [{ ...entry(null, 20), note }] } })})`);
      assert.equal(rows[0].zone, null);
    }
  });

  it("delivers zones through the cached standings endpoint without additional provider requests", async () => {
    let fetches = 0;
    const { run } = await loadWorkerContext({
      caches: {default:memoryCache()},
      fetch: async () => { fetches++; return workerJson({standings:{entries:[entry("Conference League qualifying",4)]}}); },
    });
    const request = () => run('handleRequest(new Request("https://api.atakanozkan.com/league-standings?leagueCode=tur.1", {headers:{Origin:"chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa"}}), {})');
    const first = await request();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).standings[0].zone.kind, "conference-league");
    const second = await request();
    assert.equal(second.headers.get("X-Cache"), "HIT");
    assert.equal((await second.json()).standings[0].zone.phase, "qualifying");
    assert.equal(fetches, 1);
  });

  it("renders rank-side markers and a deduplicated text legend without changing the ten-column table", () => {
    const rows = [
      { position: 1, team: "Home", zone: { kind: "champions-league", phase: "direct" } },
      { position: 2, team: "Second", zone: { kind: "champions-league", phase: "direct" } },
      { position: 3, team: "Third", zone: { kind: "europa-league", phase: "qualifying" } },
      { position: 4, team: "Fourth", zone: { kind: "conference-league", phase: "qualifying" } },
      { position: 17, team: "Playoff", zone: { kind: "relegation", phase: "playoff" } },
      { position: 18, team: "Bottom", zone: { kind: "relegation", phase: "direct" } },
      { position: 19, team: "No note", zone: null },
    ];
    app.eval(`__T.standingsCache.set("eng.1", {status:"loaded",standings:${JSON.stringify(rows)}})`);
    const section = app.eval('createStandingsSection({code:"eng.1"})');
    assert.equal(section.querySelectorAll("thead th").length, 10);
    assert.equal(section.querySelectorAll("tbody tr").length, rows.length);
    assert.equal(section.querySelectorAll("td.standings-position--champions-league").length, 2);
    assert.equal(section.querySelectorAll("td.standings-position--relegation").length, 2);
    assert.equal(section.querySelectorAll(".standings-legend-item").length, 5);
    assert.match(section.querySelector("td.standings-position--relegation").getAttribute("aria-label"), /play-off/i);
    assert.match(section.querySelector(".standings-legend").textContent, /Champions League/);
    assert.match(section.querySelector(".standings-legend").textContent, /Qualifying/);
  });

  it("ignores unsupported client metadata and stays compatible with older Worker responses", () => {
    for (const zone of [null, {}, { kind: 'relegation" style="color:red' }, { kind: "relegation", phase: "unknown" }, { kind: {toString:"not callable"}, phase:"direct" }]) {
      app.eval(`__T.standingsCache.set("eng.1", {standings:[{position:20,team:"<img src=x>",zone:${JSON.stringify(zone)}}]})`);
      const section = app.eval('createStandingsSection({code:"eng.1"})');
      assert.equal(section.querySelectorAll(".standings-legend-item,[class*=standings-position--],img[src=x]").length, 0);
      assert.equal(section.querySelector(".standings-team-name").textContent, "<img src=x>");
    }
  });

  it("keeps an isolated provider note at rank ten without the removed qualification warning", () => {
    const standings = [
      {position:1,team:"Leader",zone:{kind:"champions-league",phase:"direct"}},
      {position:9,team:"Other",zone:null},
      {position:10,team:"Villarreal",zone:{kind:"europa-league",phase:"direct"}},
    ];
    app.eval(`__T.standingsCache.set("esp.1", {standings:${JSON.stringify(standings)}})`);
    const section = app.eval('createStandingsSection({code:"esp.1"})');
    const row = [...section.querySelectorAll("tbody tr")].find(el => el.querySelector(".standings-team-name").textContent === "Villarreal");
    assert.equal(row.firstElementChild.textContent, "10");
    assert.equal(row.firstElementChild.classList.contains("standings-position--europa-league"), true);
    assert.equal(section.querySelector(".standings-qualification-note") === null, true);
  });

  it("marks European elimination positions only when the provider supplies an Eliminated note", async () => {
    const { run } = await loadWorkerContext();
    for (const code of ["uefa.champions", "uefa.europa", "uefa.europa.conf"]) {
      const entries = Array.from({length:36}, (_,i) => ({...entry(i >= 24 ? "Eliminated" : null,i+1),team:{displayName:`Team ${i+1}`}}));
      const rows = run(`normalizeEspnStandings(${JSON.stringify({standings:{entries}})})`);
      app.eval(`__T.standingsCache.set(${JSON.stringify(code)}, {standings:${JSON.stringify(rows)}})`);
      const section = app.eval(`createStandingsSection({code:${JSON.stringify(code)}})`);
      assert.deepEqual([...section.querySelectorAll("td.standings-position--elimination")].map(el => Number(el.textContent)), Array.from({length:12},(_,i) => i+25));
      assert.equal(section.querySelectorAll("td.standings-position--relegation").length, 0);
      assert.equal(section.querySelector(".standings-legend").textContent, "Elimination zone");
      assert.match(section.querySelector("td.standings-position--elimination").getAttribute("aria-label"), /Elimination zone/);
      assert.equal(section.querySelector(".standings-qualification-note") === null, true);
    }
    const rows = run(`normalizeEspnStandings(${JSON.stringify({standings:{entries:[entry(null,36)]}})})`);
    assert.equal(rows[0].zone, null);
    assert.equal(app.eval('getStandingZonePresentation({kind:"elimination",phase:"playoff"})'), null);
  });

  it("does not add a European qualification warning to relegation-only or unmarked tables", () => {
    for (const zone of [null,{kind:"relegation",phase:"direct"}]) {
      app.eval(`__T.standingsCache.set("eng.1", {standings:[{position:20,team:"Team",zone:${JSON.stringify(zone)}}]})`);
      const section = app.eval('createStandingsSection({code:"eng.1"})');
      assert.equal(section.querySelectorAll(".standings-qualification-note").length,0);
    }
  });
});
