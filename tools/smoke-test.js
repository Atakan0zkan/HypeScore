#!/usr/bin/env node

const DEFAULT_WORKER_URL = "https://api.atakanozkan.com";
const EXTENSION_ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const REQUEST_TIMEOUT_MS = 10000;

const baseUrl = (process.env.HYPE_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, "");

const headers = {
  Accept: "application/json",
  Origin: EXTENSION_ORIGIN,
};

const results = [];

main().catch((error) => {
  console.error("\nSmoke test failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  console.log(`Smoke testing ${baseUrl}`);

  let livePayload = null;

  await step("GET /live-matches", async () => {
    const payload = await fetchJson("/live-matches");
    assertLivePayload(payload);
    livePayload = payload;
    return `${payload.matches.length} matches, ${payload.leagues.length} leagues`;
  });

  await step("GET /league-standings?leagueCode=esp.1", async () => {
    const payload = await fetchJson("/league-standings?leagueCode=esp.1");
    assertStandingsPayload(payload, "esp.1");
    return `${countStandingsRows(payload.standings)} rows`;
  });

  await step("GET /tournament-bracket?leagueCode=fifa.world", async () => {
    const payload = await fetchJson("/tournament-bracket?leagueCode=fifa.world");
    assertTournamentBracketPayload(payload);
    return `${payload.rounds.length} rounds, ${countBracketMatches(payload.rounds)} matches`;
  });

  const match = livePayload.matches.find((item) => item.id && item.leagueCode);
  if (!match) {
    results.push({
      name: "GET /match-detail",
      status: "skipped",
      detail: "No current match with id + leagueCode in live payload",
    });
  } else {
    await step(`GET /match-detail?eventId=${match.id}&leagueCode=${match.leagueCode}`, async () => {
      const payload = await fetchJson(
        `/match-detail?eventId=${encodeURIComponent(match.id)}&leagueCode=${encodeURIComponent(match.leagueCode)}`,
      );
      assertMatchDetailPayload(payload, match);
      return `${payload.title || match.homeTeam + " vs " + match.awayTeam}`;
    });
  }

  printResults();
}

async function step(name, action) {
  try {
    const detail = await action();
    results.push({ name, status: "ok", detail });
    return detail;
  } catch (error) {
    results.push({
      name,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      throw new Error(`${path} returned non-JSON content-type: ${contentType || "missing"}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertLivePayload(payload) {
  assertObject(payload, "live payload");
  assertArray(payload.matches, "live payload matches");
  assertArray(payload.leagues, "live payload leagues");

  if (payload.leagues.length < 20) {
    throw new Error(`Expected curated league list, got only ${payload.leagues.length} leagues`);
  }

  for (const league of payload.leagues.slice(0, 5)) {
    assertString(league.name, "league.name");
    assertArray(league.matches, `${league.name}.matches`);
  }

  for (const match of payload.matches.slice(0, 5)) {
    assertString(match.id, "match.id");
    assertString(match.league, "match.league");
    assertString(match.homeTeam, "match.homeTeam");
    assertString(match.awayTeam, "match.awayTeam");
    assertNumber(match.homeScore, "match.homeScore");
    assertNumber(match.awayScore, "match.awayScore");
    assertString(match.minute, "match.minute");
    assertString(match.status, "match.status");
  }
}

function assertStandingsPayload(payload, leagueCode) {
  assertObject(payload, "standings payload");
  if (payload.leagueCode !== leagueCode) {
    throw new Error(`Expected standings leagueCode ${leagueCode}, got ${payload.leagueCode}`);
  }
  assertArray(payload.standings, "standings");
}

function assertMatchDetailPayload(payload, match) {
  assertObject(payload, "match detail payload");
  assertString(payload.id, "matchDetail.id");
  if (payload.leagueCode !== match.leagueCode) {
    throw new Error(`Expected match detail leagueCode ${match.leagueCode}, got ${payload.leagueCode}`);
  }
  assertObject(payload.teams, "matchDetail.teams");
  assertObject(payload.teams.home, "matchDetail.teams.home");
  assertObject(payload.teams.away, "matchDetail.teams.away");
  assertArray(payload.timeline, "matchDetail.timeline");
  assertArray(payload.commentary, "matchDetail.commentary");
  assertArray(payload.stats, "matchDetail.stats");
  assertArray(payload.lineups, "matchDetail.lineups");
  assertArray(payload.news, "matchDetail.news");
  assertArray(payload.videos, "matchDetail.videos");
  assertArray(payload.links, "matchDetail.links");
}

function assertTournamentBracketPayload(payload) {
  assertObject(payload, "tournament bracket payload");
  if (payload.leagueCode !== "fifa.world") {
    throw new Error(`Expected tournament bracket leagueCode fifa.world, got ${payload.leagueCode}`);
  }
  assertArray(payload.rounds, "tournament bracket rounds");

  if (payload.rounds.length === 0) {
    throw new Error("Expected at least one tournament bracket round");
  }

  for (const round of payload.rounds) {
    assertString(round.slug, "bracketRound.slug");
    assertString(round.name, "bracketRound.name");
    assertArray(round.matches, "bracketRound.matches");
  }

  const firstMatch = payload.rounds.flatMap((round) => round.matches)[0];
  assertObject(firstMatch, "bracketMatch");
  assertString(firstMatch.id, "bracketMatch.id");
  assertString(firstMatch.homeTeam, "bracketMatch.homeTeam");
  assertString(firstMatch.awayTeam, "bracketMatch.awayTeam");
  assertString(firstMatch.kickoff, "bracketMatch.kickoff");
}

function countStandingsRows(standings) {
  if (!Array.isArray(standings)) {
    return 0;
  }

  if (standings.some((row) => Array.isArray(row?.entries))) {
    return standings.reduce(
      (total, group) => total + (Array.isArray(group.entries) ? group.entries.length : 0),
      0,
    );
  }

  return standings.length;
}

function countBracketMatches(rounds) {
  return rounds.reduce(
    (total, round) => total + (Array.isArray(round.matches) ? round.matches.length : 0),
    0,
  );
}

function printResults() {
  console.log("");
  for (const result of results) {
    const prefix = result.status === "ok" ? "PASS" : result.status === "skipped" ? "SKIP" : "FAIL";
    console.log(`${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}
