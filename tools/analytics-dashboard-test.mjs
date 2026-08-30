#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  createUsageQueries,
  getTokenVerificationUrl,
  shapeDashboardData,
} from "../analytics-dashboard/server.mjs";

const queries = createUsageQueries(7);
assert.match(queries.coverage, /INTERVAL '7' DAY/);
assert.doesNotMatch(JSON.stringify(queries), /client_ip|user_id|device_id/i);
assert.equal(
  getTokenVerificationUrl("cfat_example", "account-id"),
  "https://api.cloudflare.com/client/v4/accounts/account-id/tokens/verify",
);
assert.equal(
  getTokenVerificationUrl("legacy-user-token", "account-id"),
  "https://api.cloudflare.com/client/v4/user/tokens/verify",
);

const payload = shapeDashboardData(
  {
    coverage: [
      {
        first_event: "2026-08-29T00:00:00Z",
        last_event: "2026-08-30T00:00:00Z",
        requests: 20,
        avg_duration_ms: 125,
      },
    ],
    daily: [
      { day: "2026-08-29", status_class: "2xx", requests: 8, avg_duration_ms: 100 },
      { day: "2026-08-29", status_class: "5xx", requests: 2, avg_duration_ms: 200 },
      { day: "2026-08-30", status_class: "2xx", requests: 10, avg_duration_ms: 120 },
    ],
    endpoints: [
      { endpoint: "/live-matches", status_class: "2xx", requests: 12, avg_duration_ms: 100 },
      { endpoint: "/match-detail", status_class: "2xx", requests: 6, avg_duration_ms: 150 },
      { endpoint: "/match-detail", status_class: "5xx", requests: 2, avg_duration_ms: 200 },
    ],
    countries: [{ country: "TR", requests: 14 }],
    versions: [{ version: "1.5", requests: 14 }],
    browsers: [{ browser: "Chrome", major: "140", requests: 14 }],
    leagues: [{ league_code: "eng.1", requests: 8 }],
    cache: [
      { cache_status: "HIT", requests: 12 },
      { cache_status: "MISS", requests: 8 },
    ],
    clients: [
      { client: "extension", origin_policy: "allowed-origin", requests: 20 },
    ],
  },
  [
    { day: "2026-08-29", estimatedVisits: 3 },
    { day: "2026-08-30", estimatedVisits: 4 },
  ],
  7,
);

assert.equal(payload.summary.requests, 20);
assert.equal(payload.summary.featureRequests, 8);
assert.equal(payload.summary.successRate, 0.9);
assert.equal(payload.summary.cacheHitRate, 0.6);
assert.equal(payload.summary.latestEstimatedVisits, 4);
assert.equal(payload.endpoints[0].endpoint, "/live-matches");
assert.equal(payload.countries[0].label, "TR");

console.log("PASS analytics dashboard data model tests");
