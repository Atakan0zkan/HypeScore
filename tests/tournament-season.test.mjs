import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkerContext, loadPopupContext, espnEvent, memoryCache } from "./helpers.mjs";
import { loadPopupDOM, workerJson } from "./dom-helpers.mjs";
import { readFile } from "node:fs/promises";

const origin = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const worldEvent = (year = 2030, id = "203001") => ({
  ...espnEvent({ id, leagueId: "606", state: "pre", kickoff: `${year}-06-15T18:00:00Z` }),
  season: { year, slug: "group-stage" },
});
const json = (payload) => new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
const request = (run, path) => run(`handleRequest(new Request("https://api.atakanozkan.com${path}", {headers:{Origin:"${origin}"}}), {})`);

describe("verified USL identity", () => {
  it("maps s:600 league 4002 to Championship and excludes 23633 from the all-scoreboard", async () => {
    const { run } = await loadWorkerContext();
    const championship = espnEvent({ id: "401842265", leagueId: "4002" });
    const superLeague = espnEvent({ id: "401878629", leagueId: "23633" });
    championship.uid = championship.uid.replace("s:500", "s:600");
    superLeague.uid = superLeague.uid.replace("s:500", "s:600");
    const rows = run(`normalizeEspnMatches(${JSON.stringify({ events: [championship, superLeague] })})`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "401842265");
    assert.equal(rows[0].leagueCode, "usa.usl.1");
    assert.equal(rows[0].league, "USL Championship");
    assert.equal(rows[0].leagueLogoId, "2292");
    const groups = run("groupMatchesByLeague([])");
    assert.equal(groups.length, 32);
    assert.equal(groups.find((group) => group.code === "usa.usl.1").id, "4002");
  });
});

describe("World Cup 2030 only", () => {
  it("requires a verified 2030 season or date and rejects conflicting years", async () => {
    const { run } = await loadWorkerContext();
    const future = worldEvent();
    for (const [event, expected] of [
      [future, true], [worldEvent(2026), false], [null, false], [{}, false],
      [{ ...future, season: { year: 2026 } }, false],
      [{ ...future, date: "invalid", competitions: [] }, false],
      [{ season: { year: 2030 } }, true],
      [{ ...future, season: undefined }, true],
    ]) assert.equal(run(`isWorldCup2030Event(${JSON.stringify(event)})`), expected);
  });

  it("removes old World Cup results from scoreboards and groups future rounds only", async () => {
    const { run } = await loadWorkerContext();
    const past = worldEvent(2026, "760517");
    past.competitions[0].status.type.state = "post";
    const payload = { events: [null, past, worldEvent(), { ...worldEvent(2026, "999"), season: { year: 2030 } }] };
    const currentMatches = run(`normalizeEspnMatches(${JSON.stringify(payload)})`);
    assert.ok(currentMatches.every((match) => match.id === "203001"), "past and conflicting-year matches never enter the live response");
    const bracket = run(`normalizeTournamentBracket(${JSON.stringify(payload)}, "fifa.world")`);
    assert.equal(bracket.seasonYear, 2030);
    assert.equal(bracket.dates, "2030");
    assert.equal(bracket.rounds.length, 1);
    assert.equal(bracket.rounds[0].matches.length, 1);
    assert.equal(bracket.rounds[0].matches[0].id, "203001");
    assert.equal(bracket.rounds[0].matches[0].seasonYear, 2030);
  });

  it("lazily queries the whole 2030 season and only registers its issued events", async () => {
    const calls = [];
    const cache = memoryCache();
    const { run } = await loadWorkerContext({ caches: { default: cache }, fetch: async (url) => {
      calls.push(String(url));
      return json({ events: [worldEvent(2026, "760517"), worldEvent()], leagues: [{ season: { year: 2026 } }] });
    } });
    const response = await request(run, "/tournament-bracket?leagueCode=fifa.world&season=2030");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rounds[0].matches[0].id, "203001");
    assert.match(calls[0], /scoreboard\?dates=2030&season=2030$/);
    assert.equal(await run('isKnownMatchDetailEvent(caches.default,"760517","fifa.world")'), false);
    assert.equal(await run('isKnownMatchDetailEvent(caches.default,"203001","fifa.world")'), true);
    assert.equal((await request(run, "/tournament-bracket?leagueCode=fifa.world")).headers.get("X-Cache"), "HIT");
    assert.equal(calls.length, 1);
  });

  it("returns an empty 200 for unpublished 400/404 seasons without falling back", async () => {
    for (const status of [400, 404]) {
      const urls = [];
      const { run } = await loadWorkerContext({ fetch: async (url) => {
        urls.push(String(url)); return new Response("{}", { status });
      } });
      const r = await request(run, "/tournament-bracket?leagueCode=fifa.world");
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.equal(data.seasonYear, 2030);
      assert.deepEqual(data.rounds, []);
      assert.equal(urls.length, 1);
      assert.ok(!urls.some((url) => url.includes("2026")));
      assert.deepEqual(Array.from(await run('refreshStandingsForLeague("fifa.world")')), []);
    }
  });

  it("does not hide actual upstream outages as empty data", async () => {
    const { run } = await loadWorkerContext({ fetch: async () => new Response("{}", { status: 503 }) });
    assert.equal((await request(run, "/tournament-bracket?leagueCode=fifa.world")).status, 502);
    assert.equal((await request(run, "/league-standings?leagueCode=fifa.world")).status, 502);
  });

  it("does not reuse old live, standings, detail or known-event caches", async () => {
    const cache = memoryCache();
    await cache.put(new Request("https://live-score-extension.internal/known-events/v1"), json([
      { key: "fifa.world:760517", expires: Date.now() + 60000 },
    ]));
    await cache.put(new Request("https://live-score-extension.internal/match-detail/v7/fifa.world/760517"), json({ id: "760517" }));
    const { run } = await loadWorkerContext({ caches: { default: cache } });
    assert.equal((await request(run, "/match-detail?leagueCode=fifa.world&eventId=760517")).status, 404);
    assert.match(run('getStandingsCacheKey("fifa.world").url'), /fifa.world\/2030$/);
    assert.match(run('getTournamentBracketCacheKey("fifa.world").url'), /v2\/fifa.world\/2030$/);
    assert.ok(!run("CACHE_KEY_URL").endsWith("v15"));
  });

  it("rejects previous-season standings and filters conflicting child seasons", async () => {
    const entry = { team: { id: "1", displayName: "Future FC" }, stats: [] };
    let payload = { season: { year: 2026 }, standings: { entries: [entry] } };
    const { run } = await loadWorkerContext({ fetch: async (url) => {
      assert.match(String(url), /standings\?season=2030$/); return json(payload);
    } });
    assert.equal((await run('refreshStandingsForLeague("fifa.world")')).length, 0);
    payload = { season: { year: 2030 }, children: [
      { season: { year: 2026 }, standings: { entries: [entry] } },
      { season: { year: 2030 }, standings: { entries: [entry] } },
    ] };
    const response = await request(run, "/league-standings?leagueCode=fifa.world&season=2030");
    const data = await response.json();
    assert.equal(data.seasonYear, 2030);
    assert.equal(data.standings.length, 1);
    assert.equal(data.standings[0].team, "Future FC");
  });

  it("rejects an old summary even if a future event was registered", async () => {
    const { run } = await loadWorkerContext({ caches: { default: memoryCache() }, fetch: async () => json({ header: worldEvent(2026) }) });
    await run('persistKnownMatches(caches.default, [{id:"203001",leagueCode:"fifa.world"}])');
    assert.equal((await request(run, "/match-detail?leagueCode=fifa.world&eventId=203001")).status, 502);
  });
});

describe("popup future-tournament safeguards", () => {
  it("labels 2030 and removes historic matches, including older API responses", async () => {
    const { run } = await loadPopupContext();
    const league = { code: "fifa.world", name: "FIFA World Cup", matches: [
      { id: "past", state: "finished", kickoff: "2026-07-19T18:00:00Z" },
    ] };
    const rows = run(`normalizeLeagueGroups(${JSON.stringify({ matches: [], leagues: [league] })})`);
    assert.equal(rows[0].name, "FIFA World Cup 2030");
    assert.equal(rows[0].matches.length, 0);
    assert.equal(new URL(run('buildTournamentBracketUrl("fifa.world")')).searchParams.get("season"), "2030");
    assert.equal(new URL(run('buildLeagueStandingsUrl("fifa.world")')).searchParams.get("season"), "2030");
  });

  it("does not render stale bracket/standings bodies from the old backend contract", async () => {
    const { ctx, run } = await loadPopupContext();
    ctx.fetch = async () => json({ rounds: [{ matches: [{ id: "past", kickoff: "2026-07-19" }] }], standings: [{ team: "Old team" }] });
    await run('loadTournamentBracket("fifa.world")');
    await run('loadLeagueStandings("fifa.world")');
    assert.equal(run('tournamentBracketCache.get("fifa.world").rounds.length'), 0);
    assert.equal(run('leagueStandingsCache.get("fifa.world").standings.length'), 0);
  });

  it("retains verified future matches beyond the ordinary 24-hour list window", async () => {
    const { ctx, run } = await loadPopupContext();
    ctx.fetch = async () => json({ seasonYear: 2030, rounds: [{ slug: "group-stage", matches: [
      { id: "future", kickoff: "2030-06-15", seasonYear: 2030 },
      { id: "past", kickoff: "2026-07-19", seasonYear: 2030 }, null,
    ] }] });
    await run('loadTournamentBracket("fifa.world")');
    assert.equal(run('tournamentBracketCache.get("fifa.world").rounds[0].matches.length'), 1);
    assert.equal(run('tournamentBracketCache.get("fifa.world").rounds[0].matches[0].id'), "future");
  });

  it("fetches future information when the World Cup is clicked and stays empty without it", async () => {
    const calls = [];
    const payload = { matches: [], leagues: [{ code: "fifa.world", name: "FIFA World Cup", matches: [] }] };
    const app = await loadPopupDOM({ fetchImpl: async (url) => {
      calls.push(new URL(url));
      return workerJson(new URL(url).pathname === "/live-matches" ? payload : { seasonYear: 2030, rounds: [], standings: [] });
    } });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      app.eval(`__T.lastPayload = ${JSON.stringify(payload)}; __T.renderLast()`);
      app.document.querySelector(".league-pick-card").click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(app.document.querySelector(".league-detail-title").textContent, "FIFA World Cup 2030");
      assert.ok(calls.some((url) => url.pathname === "/tournament-bracket" && url.searchParams.get("season") === "2030"));
      assert.equal(app.document.querySelectorAll(".match-card,.bracket-match-card,.standings-table").length, 0);
      assert.equal(app.document.querySelectorAll(".bracket-message--error,.standings-message--error").length, 0);
    } finally { await app.close(); }
  });
});

describe("dependency maintenance automation", () => {
  it("checks both ecosystems daily and tests PRs with read-only permissions", async () => {
    const dependabot = await readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8");
    const workflow = await readFile(new URL("../.github/workflows/daily-test.yml", import.meta.url), "utf8");
    assert.match(dependabot, /package-ecosystem: npm/);
    assert.match(dependabot, /package-ecosystem: github-actions/);
    assert.equal((dependabot.match(/interval: cron/g) || []).length, 2);
    assert.equal((dependabot.match(/timezone: Europe\/Istanbul/g) || []).length, 2);
    assert.match(dependabot, /applies-to: security-updates/);
    assert.match(workflow, /pull_request:/);
    assert.match(workflow, /permissions:\s+contents: read/);
    assert.match(workflow, /npm audit --audit-level=moderate/);
    assert.match(workflow, /github.event_name == 'schedule'/, "AI triage must not receive untrusted PR code/secrets");
    assert.ok(!workflow.includes("pull_request_target"));
    assert.ok(!workflow.includes("gh pr merge"));
  });
});
