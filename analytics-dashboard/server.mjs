#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.HYPE_ANALYTICS_PORT || "4173", 10);
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "a0c8a7b71431f1ab7b86856e06ebc98a";
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "";
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME || "atakanozkan.com";
const API_HOSTNAME = process.env.HYPE_API_HOSTNAME || "api.atakanozkan.com";
const DATASET = process.env.HYPE_ANALYTICS_DATASET || "hype_usage";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CACHE_TTL_MS = 4 * 60 * 1000;
const ALLOWED_RANGES = new Set([7, 30, 90]);
const responseCache = new Map();

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${HOST}:${PORT}`);

    if (request.method !== "GET") {
      return sendJson(response, 405, { error: "Method not allowed" });
    }

    if (requestUrl.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: Boolean(API_TOKEN),
        dataset: DATASET,
        hostname: API_HOSTNAME,
        tokenConfigured: Boolean(API_TOKEN),
      });
    }

    if (requestUrl.pathname === "/api/analytics") {
      if (!API_TOKEN) {
        return sendJson(response, 503, {
          error: "CLOUDFLARE_API_TOKEN is not configured",
        });
      }

      const requestedDays = Number.parseInt(requestUrl.searchParams.get("days") || "7", 10);
      const days = ALLOWED_RANGES.has(requestedDays) ? requestedDays : 7;
      const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
      const cacheKey = String(days);
      const cached = responseCache.get(cacheKey);

      if (!forceRefresh && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
        return sendJson(response, 200, { ...cached.payload, cache: "HIT" });
      }

      const payload = await buildDashboardPayload(days);
      responseCache.set(cacheKey, { createdAt: Date.now(), payload });
      return sendJson(response, 200, { ...payload, cache: "MISS" });
    }

    const staticFile = STATIC_FILES.get(requestUrl.pathname);
    if (!staticFile) {
      return sendJson(response, 404, { error: "Not found" });
    }

    const [fileName, contentType] = staticFile;
    const body = await readFile(join(ROOT, "public", fileName));
    response.writeHead(200, commonHeaders({ contentType, cacheControl: "no-store" }));
    response.end(body);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function buildDashboardPayload(days) {
  await verifyApiToken();
  const warnings = [];
  const queries = createUsageQueries(days);
  const queryEntries = Object.entries(queries);
  const settled = await Promise.allSettled(
    queryEntries.map(([, sql]) => queryAnalyticsEngine(sql)),
  );
  const usage = {};

  settled.forEach((result, index) => {
    const [name] = queryEntries[index];
    if (result.status === "fulfilled") {
      usage[name] = result.value;
    } else {
      usage[name] = [];
      warnings.push(`Analytics Engine ${name}: ${toErrorMessage(result.reason)}`);
    }
  });

  let estimatedVisits = [];
  try {
    const visitDays = Math.min(days, 30);
    estimatedVisits = await queryEstimatedDailyVisits(visitDays);
    if (days > visitDays) {
      warnings.push(
        `Cloudflare hostname visits are limited to the latest ${visitDays} days to keep GraphQL usage predictable.`,
      );
    }
  } catch (error) {
    warnings.push(`Cloudflare hostname visits: ${toErrorMessage(error)}`);
  }

  const payload = shapeDashboardData(usage, estimatedVisits, days);
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    cache: "MISS",
    source: {
      featureAnalytics: `Workers Analytics Engine dataset ${DATASET}`,
      estimatedVisits: `Cloudflare hostname-filtered visits for ${API_HOSTNAME}`,
    },
    warnings,
    definitions: {
      estimatedVisits:
        "Cloudflare visit estimate for the API hostname (latest 30 days at most). It is not a unique person or device count.",
      requests:
        "Existing functional API requests only; no additional tracking ping is sent.",
      privacy:
        "No raw IP, persistent device ID, account, favorite, browsing history, or cross-site activity is written to the product analytics dataset.",
    },
  };
}

async function verifyApiToken() {
  const result = await cloudflareFetch(getTokenVerificationUrl(API_TOKEN));
  if (result.result?.status !== "active") {
    throw new Error("Cloudflare API token is not active");
  }
}

function getTokenVerificationUrl(token, accountId = ACCOUNT_ID) {
  return String(token || "").startsWith("cfat_")
    ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`
    : "https://api.cloudflare.com/client/v4/user/tokens/verify";
}

function createUsageQueries(days) {
  const where = `timestamp >= NOW() - INTERVAL '${days}' DAY`;
  const count = "SUM(_sample_interval * double1)";
  const averageDuration =
    "SUM(_sample_interval * double2) / SUM(_sample_interval * double1)";

  return {
    coverage: `SELECT min(timestamp) AS first_event, max(timestamp) AS last_event, ${count} AS requests, ${averageDuration} AS avg_duration_ms FROM ${DATASET} WHERE ${where}`,
    daily: `SELECT toDate(timestamp) AS day, blob7 AS status_class, ${count} AS requests, ${averageDuration} AS avg_duration_ms FROM ${DATASET} WHERE ${where} GROUP BY day, status_class ORDER BY day ASC`,
    endpoints: `SELECT blob1 AS endpoint, blob7 AS status_class, ${count} AS requests, ${averageDuration} AS avg_duration_ms FROM ${DATASET} WHERE ${where} GROUP BY endpoint, status_class ORDER BY requests DESC LIMIT 100`,
    countries: `SELECT blob2 AS country, ${count} AS requests FROM ${DATASET} WHERE ${where} AND blob3 = 'extension' GROUP BY country ORDER BY requests DESC LIMIT 12`,
    versions: `SELECT blob4 AS version, ${count} AS requests FROM ${DATASET} WHERE ${where} AND blob3 = 'extension' GROUP BY version ORDER BY requests DESC LIMIT 12`,
    browsers: `SELECT blob5 AS browser, blob6 AS major, ${count} AS requests FROM ${DATASET} WHERE ${where} AND blob3 = 'extension' GROUP BY browser, major ORDER BY requests DESC LIMIT 12`,
    leagues: `SELECT blob10 AS league_code, ${count} AS requests FROM ${DATASET} WHERE ${where} AND blob10 != 'none' GROUP BY league_code ORDER BY requests DESC LIMIT 15`,
    cache: `SELECT blob8 AS cache_status, ${count} AS requests FROM ${DATASET} WHERE ${where} GROUP BY cache_status ORDER BY requests DESC LIMIT 10`,
    clients: `SELECT blob3 AS client, blob11 AS origin_policy, ${count} AS requests FROM ${DATASET} WHERE ${where} GROUP BY client, origin_policy ORDER BY requests DESC LIMIT 20`,
  };
}

async function queryAnalyticsEngine(sql) {
  const response = await cloudflareFetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: sql,
    },
  );
  return Array.isArray(response.data) ? response.data : [];
}

async function queryEstimatedDailyVisits(days) {
  const zoneId = ZONE_ID || (await resolveZoneId());
  const end = new Date();
  const firstDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  firstDay.setUTCDate(firstDay.getUTCDate() - (days - 1));
  const windows = [];
  for (let index = 0; index < days; index += 1) {
    const start = new Date(firstDay);
    start.setUTCDate(start.getUTCDate() + index);
    const nextDay = new Date(start);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    windows.push({
      day: start.toISOString().slice(0, 10),
      startTime: start.toISOString(),
      endTime: new Date(Math.min(nextDay.getTime(), end.getTime())).toISOString(),
    });
  }

  return Promise.all(
    windows.map(async ({ day, startTime, endTime }) => ({
      day,
      estimatedVisits: await queryVisitWindow(zoneId, startTime, endTime),
    })),
  );
}

async function queryVisitWindow(zoneId, startTime, endTime) {
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        groups: httpRequestsAdaptiveGroups(
          limit: 10000
          filter: {
            datetime_geq: "${startTime}"
            datetime_lt: "${endTime}"
            clientRequestHTTPHost: "${API_HOSTNAME}"
            requestSource: "eyeball"
          }
          orderBy: [datetimeHour_ASC]
        ) {
          dimensions { datetimeHour }
          sum { visits }
        }
      }
    }
  }`;

  const result = await cloudflareFetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ query }),
  });

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }

  const groups = result.data?.viewer?.zones?.[0]?.groups || [];
  return groups.reduce(
    (total, group) => total + toNumber(group.sum?.visits),
    0,
  );
}

async function resolveZoneId() {
  const query = new URLSearchParams({
    name: ZONE_NAME,
    "account.id": ACCOUNT_ID,
    per_page: "1",
  });
  const result = await cloudflareFetch(
    `https://api.cloudflare.com/client/v4/zones?${query}`,
  );
  const zoneId = result.result?.[0]?.id;
  if (!zoneId) {
    throw new Error(`Zone ${ZONE_NAME} could not be resolved`);
  }
  return zoneId;
}

async function cloudflareFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Cloudflare returned non-JSON HTTP ${response.status}`);
  }

  if (!response.ok || body.success === false) {
    const errors = body.errors || body.messages || [];
    const detail = errors.map((item) => item.message || String(item)).join("; ");
    throw new Error(detail || `Cloudflare returned HTTP ${response.status}`);
  }
  return body;
}

function shapeDashboardData(usage, estimatedVisits, days) {
  const coverage = usage.coverage?.[0] || {};
  const dailyMap = new Map();
  for (const row of usage.daily || []) {
    const day = String(row.day || "unknown").slice(0, 10);
    const current = dailyMap.get(day) || {
      day,
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      weightedDuration: 0,
    };
    const requests = toNumber(row.requests);
    current.requests += requests;
    if (row.status_class === "2xx" || row.status_class === "3xx") {
      current.successfulRequests += requests;
    } else {
      current.failedRequests += requests;
    }
    current.weightedDuration += toNumber(row.avg_duration_ms) * requests;
    dailyMap.set(day, current);
  }

  const daily = [...dailyMap.values()].map((row) => ({
    ...row,
    avgDurationMs: row.requests ? row.weightedDuration / row.requests : 0,
  }));
  const endpoints = collapseEndpointRows(usage.endpoints || []);
  const totalRequests = toNumber(coverage.requests) ||
    endpoints.reduce((sum, row) => sum + row.requests, 0);
  const successfulRequests = endpoints.reduce(
    (sum, row) => sum + row.successfulRequests,
    0,
  );
  const featureRequests = endpoints
    .filter((row) => row.endpoint !== "/live-matches" && row.endpoint !== "/other")
    .reduce((sum, row) => sum + row.requests, 0);
  const cacheRows = normalizeRankedRows(usage.cache, "cache_status");
  const cacheHits = cacheRows.find((row) => row.label === "HIT")?.value || 0;
  const latestEstimatedVisits = estimatedVisits.at(-1)?.estimatedVisits || 0;
  const averageEstimatedVisits = estimatedVisits.length
    ? estimatedVisits.reduce((sum, row) => sum + row.estimatedVisits, 0) /
      estimatedVisits.length
    : 0;

  return {
    rangeDays: days,
    coverage: {
      firstEvent: coverage.first_event || null,
      lastEvent: coverage.last_event || null,
    },
    summary: {
      latestEstimatedVisits,
      averageEstimatedVisits,
      requests: totalRequests,
      featureRequests,
      successRate: totalRequests ? successfulRequests / totalRequests : 0,
      avgDurationMs: toNumber(coverage.avg_duration_ms),
      cacheHitRate: totalRequests ? cacheHits / totalRequests : 0,
    },
    daily,
    estimatedVisits,
    endpoints,
    countries: normalizeRankedRows(usage.countries, "country"),
    versions: normalizeRankedRows(usage.versions, "version"),
    browsers: (usage.browsers || []).map((row) => ({
      label: `${row.browser || "Unknown"} ${row.major || ""}`.trim(),
      value: toNumber(row.requests),
    })),
    leagues: normalizeRankedRows(usage.leagues, "league_code"),
    cacheBreakdown: cacheRows,
    clientTraffic: (usage.clients || []).map((row) => ({
      label: `${row.client || "unknown"} · ${row.origin_policy || "unknown"}`,
      value: toNumber(row.requests),
    })),
  };
}

function collapseEndpointRows(rows) {
  const endpoints = new Map();
  for (const row of rows) {
    const endpoint = row.endpoint || "/other";
    const current = endpoints.get(endpoint) || {
      endpoint,
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      weightedDuration: 0,
    };
    const requests = toNumber(row.requests);
    current.requests += requests;
    if (row.status_class === "2xx" || row.status_class === "3xx") {
      current.successfulRequests += requests;
    } else {
      current.failedRequests += requests;
    }
    current.weightedDuration += toNumber(row.avg_duration_ms) * requests;
    endpoints.set(endpoint, current);
  }
  return [...endpoints.values()]
    .map((row) => ({
      endpoint: row.endpoint,
      requests: row.requests,
      successfulRequests: row.successfulRequests,
      failedRequests: row.failedRequests,
      successRate: row.requests ? row.successfulRequests / row.requests : 0,
      avgDurationMs: row.requests ? row.weightedDuration / row.requests : 0,
    }))
    .sort((a, b) => b.requests - a.requests);
}

function normalizeRankedRows(rows = [], labelKey) {
  return rows.map((row) => ({
    label: row[labelKey] || "unknown",
    value: toNumber(row.requests),
  }));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sendJson(response, status, body) {
  response.writeHead(
    status,
    commonHeaders({
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    }),
  );
  response.end(JSON.stringify(body));
}

function commonHeaders({ contentType, cacheControl }) {
  return {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export { createUsageQueries, getTokenVerificationUrl, shapeDashboardData };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!API_TOKEN) {
    console.error(
      "CLOUDFLARE_API_TOKEN is required. Run npm run analytics and enter a scoped token.",
    );
    process.exitCode = 1;
  } else {
    server.listen(PORT, HOST, () => {
      console.log(`Hype Analytics: http://${HOST}:${PORT}`);
      console.log("Data refreshes on demand and every five minutes while visible.");
    });
  }
}
