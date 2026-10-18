#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_WORKER_URL = "https://api.atakanozkan.com";
export const MONITOR_USER_AGENT = "HypeScore-HealthMonitor/1.0";
const EXTENSION_ORIGIN = "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa";
const REQUEST_TIMEOUT_MS = 10000;
const REQUIRED_LEAGUE_CODES = [
  "fifa.world",
  "uefa.nations",
  "uefa.euro",
  "conmebol.america",
];

const headers = {
  Accept: "application/json",
  Origin: EXTENSION_ORIGIN,
  "User-Agent": MONITOR_USER_AGENT,
};

export async function runSmokeChecks({
  baseUrl = process.env.HYPE_WORKER_URL || DEFAULT_WORKER_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const base = new URL(baseUrl);
  if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== "https:" && !(base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) {
    throw new Error("Invalid Worker base URL");
  }
  const results = [];

  async function step(name, action) {
    try {
      const detail = await action();
      results.push({ name, status: "ok", detail });
    } catch (error) {
      results.push({ name, status: "failed",
        code: error.code || (error.name === "AbortError" || error.name === "TimeoutError" ? "TIMEOUT" :
          error.name === "TypeError" ? "NETWORK_ERROR" : "INVALID_RESPONSE"),
        detail: String(error.message || "Request failed").replace(/[\r\n\t]/g, " ").slice(0, 240),
      });
    }
  }

  async function fetchJson(path) {
    const url = new URL(path, base);
    url.searchParams.set("client", "monitor");
    if (url.pathname === "/live-matches") url.searchParams.set("allowStale", "1");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, { headers, signal: controller.signal, redirect: "error" });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw Object.assign(new Error(`${path.split("?")[0]} returned HTTP ${response.status}`), { code: `HTTP_${response.status}` });
      }
      if (!(response.headers.get("content-type") || "").includes("json")) {
        await response.body?.cancel().catch(() => {});
        throw Object.assign(new Error("API returned non-JSON data"), { code: "NON_JSON" });
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

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

  await step("GET /tournament-bracket?leagueCode=fifa.world&season=2030", async () => {
    const payload = await fetchJson("/tournament-bracket?leagueCode=fifa.world&season=2030");
    assertTournamentBracketPayload(payload);
    return `${payload.rounds.length} rounds, ${countBracketMatches(payload.rounds)} matches (2030; unpublished data may be empty)`;
  });

  const match = livePayload?.matches?.find((item) => item.id && item.leagueCode);
  if (!match) {
    results.push({
      name: "GET /match-detail",
      status: "skipped",
      detail: "No current match with id + leagueCode in live payload",
    });
  } else {
    await step("GET /match-detail", async () => {
      const payload = await fetchJson(
        `/match-detail?eventId=${encodeURIComponent(match.id)}&leagueCode=${encodeURIComponent(match.leagueCode)}`,
      );
      assertMatchDetailPayload(payload, match);
      return `${payload.title || match.homeTeam + " vs " + match.awayTeam}`;
    });
  }

  return { ok: results.every(result => result.status !== "failed"), checks: results };
}

function assertLivePayload(payload) {
  assertObject(payload, "live payload");
  if (payload.freshness !== undefined &&
      (typeof payload.freshness?.stale !== "boolean" ||
       typeof payload.freshness?.updatedAt !== "string" ||
       !Number.isFinite(Date.parse(payload.freshness.updatedAt)))) {
    throw new Error("API returned invalid score freshness metadata");
  }
  if (payload.freshness?.stale === true) {
    throw Object.assign(new Error("API is serving a last-successful snapshot, not fresh scores"), { code: "STALE_DATA" });
  }
  assertArray(payload.matches, "live payload matches");
  assertArray(payload.leagues, "live payload leagues");

  if (payload.leagues.length < 32) {
    throw new Error(`Expected 32 curated leagues, got only ${payload.leagues.length} leagues`);
  }

  const leagueCodes = new Set(payload.leagues.map((league) => league?.code));
  for (const code of REQUIRED_LEAGUE_CODES) {
    if (!leagueCodes.has(code)) {
      throw new Error(`Missing required league code: ${code}`);
    }
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
  if (payload.seasonYear !== 2030 || payload.dates !== "2030") throw new Error("Expected only World Cup 2030 data");

  for (const round of payload.rounds) {
    assertString(round.slug, "bracketRound.slug");
    assertString(round.name, "bracketRound.name");
    assertArray(round.matches, "bracketRound.matches");
  }

  for (const match of payload.rounds.flatMap((round) => round.matches)) {
    assertObject(match, "bracketMatch");
    assertString(match.id, "bracketMatch.id");
    assertString(match.homeTeam, "bracketMatch.homeTeam");
    assertString(match.awayTeam, "bracketMatch.awayTeam");
    if (match.seasonYear !== 2030 || (match.kickoff && new Date(match.kickoff).getUTCFullYear() !== 2030)) {
      throw new Error("Historical or unverified World Cup match in 2030 response");
    }
  }
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

export function printResults(results) {
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

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log("Smoke testing the deployed Hype API");
  runSmokeChecks().then(report => {
    printResults(report.checks);
    if (!report.ok) process.exitCode = 1;
  }).catch(() => { console.error("Smoke test could not run"); process.exitCode = 1; });
}
