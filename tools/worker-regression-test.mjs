#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const WORKER_SOURCE_URL = new URL("../worker/index.js", import.meta.url);
const ALLOWED_ORIGIN_A = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ALLOWED_ORIGIN_B = "chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const KNOWN_EVENT_ID = "760486";
const REQUIRED_LEAGUE_CODES = [
  "fifa.world",
  "uefa.nations",
  "uefa.euro",
  "conmebol.america",
];

const upstreamCalls = [];
const cache = createMemoryCache();

globalThis.caches = { default: cache };
globalThis.fetch = async (input) => {
  const url = String(input);
  upstreamCalls.push(url);

  if (url.endsWith("/all/scoreboard")) {
    await delay(25);
    return jsonResponse(createScoreboardPayload());
  }

  if (url.includes(`/summary?event=${KNOWN_EVENT_ID}`)) {
    await delay(25);
    return jsonResponse({});
  }

  if (url.endsWith("/uefa.nations/scoreboard")) {
    return jsonResponse(createEmptyLeaguePayload("2395", "uefa.nations", "UEFA Nations League"));
  }

  if (url.endsWith("/uefa.euro/scoreboard")) {
    return jsonResponse(createEmptyLeaguePayload("781", "uefa.euro", "UEFA European Championship"));
  }

  if (url.endsWith("/conmebol.america/scoreboard")) {
    return jsonResponse(createEmptyLeaguePayload("780", "conmebol.america", "Copa America"));
  }

  return jsonResponse({ leagues: [], events: [] });
};

const workerSource = await readFile(WORKER_SOURCE_URL, "utf8");
const workerModuleUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`;
const { default: worker } = await import(workerModuleUrl);

const liveRequestA = createApiRequest("/live-matches", ALLOWED_ORIGIN_A);
const liveRequestB = createApiRequest("/live-matches", ALLOWED_ORIGIN_B);
const [liveResponseA, liveResponseB] = await Promise.all([
  worker.fetch(liveRequestA, {}),
  worker.fetch(liveRequestB, {}),
]);

assert.equal(liveResponseA.status, 200);
assert.equal(liveResponseB.status, 200);
assert.equal(liveResponseA.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN_A);
assert.equal(liveResponseB.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN_B);

const livePayload = await liveResponseA.json();
assert.equal(livePayload.leagues.length, 32);
const leagueCodes = new Set(livePayload.leagues.map((league) => league.code));
for (const code of REQUIRED_LEAGUE_CODES) {
  assert.ok(leagueCodes.has(code), `missing required league ${code}`);
}

for (const code of [
  "uefa.europa.conf",
  "fifa.world",
  "uefa.nations",
  "uefa.euro",
  "conmebol.america",
]) {
  assert.ok(
    upstreamCalls.some((url) => url.endsWith(`/${code}/scoreboard`)),
    `missing direct scoreboard probe for ${code}`,
  );
}

const detailCallsBefore = countSummaryCalls();
const [detailResponseA, detailResponseB] = await Promise.all([
  worker.fetch(createDetailRequest(KNOWN_EVENT_ID, ALLOWED_ORIGIN_A), {}),
  worker.fetch(createDetailRequest(KNOWN_EVENT_ID, ALLOWED_ORIGIN_B), {}),
]);

assert.equal(detailResponseA.status, 200);
assert.equal(detailResponseB.status, 200);
assert.equal(detailResponseA.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN_A);
assert.equal(detailResponseB.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN_B);
assert.equal(countSummaryCalls() - detailCallsBefore, 1, "same-event requests must coalesce");

const cachedDetailResponse = await worker.fetch(
  createDetailRequest(KNOWN_EVENT_ID, ALLOWED_ORIGIN_A),
  {},
);
assert.equal(cachedDetailResponse.status, 200);
assert.equal(countSummaryCalls() - detailCallsBefore, 1, "cached detail must not refetch");

const unknownResponse = await worker.fetch(
  createDetailRequest("999999", ALLOWED_ORIGIN_A),
  {},
);
assert.equal(unknownResponse.status, 404);
assert.equal(countSummaryCalls() - detailCallsBefore, 1, "unknown event must not reach upstream");

const overlongResponse = await worker.fetch(
  createDetailRequest("1".repeat(21), ALLOWED_ORIGIN_A),
  {},
);
assert.equal(overlongResponse.status, 400);
assert.equal(countSummaryCalls() - detailCallsBefore, 1, "overlong event id must not reach upstream");

console.log("PASS worker regression tests");
console.log("- 32 curated leagues include UEFA Nations League, UEFA EURO, and Copa America");
console.log("- direct scoreboard probes are present and start within one live refresh");
console.log("- coalesced live/detail responses retain each request's CORS origin");
console.log("- known match detail is cached/coalesced; unknown and overlong ids fail closed");

function createApiRequest(path, origin) {
  return new Request(`https://worker.test${path}`, {
    headers: { Origin: origin },
  });
}

function createDetailRequest(eventId, origin) {
  return createApiRequest(
    `/match-detail?eventId=${encodeURIComponent(eventId)}&leagueCode=eng.1`,
    origin,
  );
}

function countSummaryCalls() {
  return upstreamCalls.filter((url) => url.includes("/summary?event=")).length;
}

function createMemoryCache() {
  const entries = new Map();
  const keyFor = (request) => (request instanceof Request ? request.url : String(request));

  return {
    async match(request) {
      return entries.get(keyFor(request))?.clone();
    },
    async put(request, response) {
      entries.set(keyFor(request), response.clone());
    },
  };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function createEmptyLeaguePayload(id, slug, name) {
  return {
    leagues: [{ id, uid: `s:600~l:${id}`, slug, name, logos: [] }],
    events: [],
  };
}

function createScoreboardPayload() {
  return {
    leagues: [],
    events: [
      {
        id: KNOWN_EVENT_ID,
        uid: "s:600~l:700~e:760486",
        date: "2026-07-13T18:00:00Z",
        season: { slug: "2026" },
        competitions: [
          {
            id: KNOWN_EVENT_ID,
            date: "2026-07-13T18:00:00Z",
            status: {
              clock: 1200,
              type: {
                state: "in",
                completed: false,
                description: "In Progress",
                shortDetail: "20'",
              },
            },
            competitors: [
              createCompetitor("home", "1", "Home FC", "1"),
              createCompetitor("away", "2", "Away FC", "0"),
            ],
          },
        ],
      },
    ],
  };
}

function createCompetitor(homeAway, id, name, score) {
  return {
    homeAway,
    id,
    score,
    team: {
      id,
      displayName: name,
      shortDisplayName: name,
      logos: [],
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
