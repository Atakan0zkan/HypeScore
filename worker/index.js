const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
const THESPORTSDB_LIVE_SCORE_URL =
  "https://www.thesportsdb.com/api/v2/json/livescore/soccer";
const ESPN_STANDINGS_BASE_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer";
const ESPN_SUMMARY_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";
const LIVE_CACHE_TTL_SECONDS = 30;
const IDLE_CACHE_TTL_SECONDS = 120;
const STANDINGS_CACHE_TTL_SECONDS = 1800;
const MATCH_DETAIL_CACHE_TTL_SECONDS = 60;
const TOURNAMENT_BRACKET_CACHE_TTL_SECONDS = 900;
const UPSTREAM_FETCH_TIMEOUT_MS = 8000;
const UPCOMING_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVENT_ID_LENGTH = 20;
const MAX_REMEMBERED_EVENT_KEYS = 1024;
const LIVE_MATCHES_CACHE_KEY_VERSION = "v14";
const STANDINGS_CACHE_KEY_VERSION = "v4";
const MATCH_DETAIL_CACHE_KEY_VERSION = "v5";
const TOURNAMENT_BRACKET_CACHE_KEY_VERSION = "v1";
const CACHE_KEY_URL = `https://live-score-extension.internal/live-matches/${LIVE_MATCHES_CACHE_KEY_VERSION}`;
let liveMatchesRefreshPromise = null;
const standingsRefreshPromises = new Map();
const matchDetailRefreshPromises = new Map();
const tournamentBracketRefreshPromises = new Map();
const rememberedEventKeys = new Set();
const ALLOWED_ORIGINS = new Set([
  "chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa",
]);

const ESPN_LEAGUE_LOGO_BASE = "https://a.espncdn.com/i/leaguelogos/soccer";
const ESPN_LINK_HOST_SUFFIXES = ["espn.com"];
const ESPN_MEDIA_HOST_SUFFIXES = ["espncdn.com"];
const TEAM_LOGO_OVERRIDE_HOST_SUFFIXES = ["cancunfc.mx"];
const EXTRA_ESPN_SCOREBOARD_LEAGUES = [
  "uefa.europa.conf",
  "fifa.world",
  "uefa.nations",
  "uefa.euro",
  "conmebol.america",
];
const FIFA_WORLD_CUP_LEAGUE_CODE = "fifa.world";
const FIFA_WORLD_CUP_KNOCKOUT_DATES = "20260628-20260719";
const DANISH_SUPERLIGA_LOGO_URL =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/Superliga_2010.svg?width=512&type=png";
const UEFA_CONFERENCE_LEAGUE_LOGO_URL =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/UEFA_Conference_League_full_logo_(2024_version).svg?width=512&type=png";
const CANCUN_FC_LOGO_URL =
  "https://www.cancunfc.mx/cdn/shop/files/LOGOS_CANUN_FC.png?v=1764009552&width=512";
const TEAM_LOGO_OVERRIDES_BY_ID = new Map([
  ["20724", CANCUN_FC_LOGO_URL],
]);
const TEAM_LOGO_OVERRIDES_BY_NAME = new Map([
  ["cancun", CANCUN_FC_LOGO_URL],
  ["cancun fc", CANCUN_FC_LOGO_URL],
]);

/*
 * ESPN uses a separate "logo ID" for league images that differs from the
 * league numeric ID in the scoreboard uid.  The logoId values below were
 * sourced from the per-league /scoreboard endpoint's `leagues[].logos[]`
 * array.  When a logoId is not known the frontend falls back to a generic
 * soccer ball SVG.
 */
const ESPN_LEAGUES_BY_ID = {
  "606": {
    code: "fifa.world",
    name: "FIFA World Cup",
    logoId: "4",
    logoTone: "light",
  },
  "775": {
    code: "uefa.champions",
    name: "UEFA Champions League",
    logoId: "2",
    logoStyle: "dark",
  },
  "780": {
    code: "conmebol.america",
    name: "Copa América",
    logoId: "83",
  },
  "781": {
    code: "uefa.euro",
    name: "UEFA European Championship",
    logoId: "74",
  },
  "700": { code: "eng.1", name: "English Premier League", logoId: "23" },
  "710": { code: "fra.1", name: "Ligue 1", logoId: "9" },
  "715": { code: "por.1", name: "Portuguese Primeira Liga", logoId: "14" },
  "720": { code: "ger.1", name: "German Bundesliga", logoId: "10" },
  "725": { code: "ned.1", name: "Dutch Eredivisie", logoId: "11" },
  "730": { code: "ita.1", name: "Italian Serie A", logoId: "12" },
  "735": { code: "sco.1", name: "Scottish Premiership", logoId: "45" },
  "740": { code: "esp.1", name: "LaLiga", logoId: "15" },
  "745": { code: "arg.1", name: "Argentine Liga Profesional", logoId: "1" },
  "760": { code: "mex.1", name: "Mexican Liga MX", logoId: "22" },
  "770": { code: "usa.1", name: "MLS", logoId: "19" },
  "2310": {
    code: "uefa.europa",
    name: "UEFA Europa League",
    logoId: "2310",
    logoStyle: "dark",
  },
  "3901": { code: "bel.1", name: "Belgian Pro League", logoId: "6" },
  "3906": {
    code: "aus.1",
    name: "Australian A-League Men",
    logoId: "1308",
    logoStyle: "dark",
  },
  "3907": { code: "aut.1", name: "Austrian Bundesliga", logoId: "5" },
  "3913": {
    code: "den.1",
    name: "Danish Superliga",
    logoId: null,
    logoUrl: DANISH_SUPERLIGA_LOGO_URL,
    logoTone: "light",
  },
  "3914": { code: "eng.2", name: "English Championship", logoId: "24" },
  "3918": { code: "eng.fa", name: "English FA Cup", logoId: "40" },
  "3927": {
    code: "ger.2",
    name: "German 2. Bundesliga",
    logoId: "97",
    logoStyle: "default",
  },
  "3932": {
    code: "mex.2",
    name: "Mexican Liga de Expansion MX",
    logoId: "2306",
  },
  "3939": { code: "rus.1", name: "Russian Premier League", logoId: "106" },
  "3945": {
    code: "swe.1",
    name: "Swedish Allsvenskan",
    logoId: "16",
    logoStyle: "default",
  },
  "3946": { code: "tur.1", name: "Turkish Super Lig", logoId: "18" },
  "3955": {
    code: "gre.1",
    name: "Greek Super League",
    logoId: "98",
    logoStyle: "default",
  },
  "8097": {
    code: "eng.w.1",
    name: "English Women's Super League",
    logoId: "2314",
  },
  "uefa.europa.conf": {
    code: "uefa.europa.conf",
    name: "UEFA Conference League",
    logoId: null,
    logoUrl: UEFA_CONFERENCE_LEAGUE_LOGO_URL,
    logoTone: "light",
  },
  "23633": {
    code: "usa.usl.1",
    name: "USL Championship",
    logoId: "2292",
    logoTone: "light",
  },
  "2395": {
    code: "uefa.nations",
    name: "UEFA Nations League",
    logoId: "2395",
  },
};

const ESPN_LEAGUES_BY_CODE = new Map(
  Object.values(ESPN_LEAGUES_BY_ID).map((league) => [league.code, league]),
);

const securityHeaders = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  const originPolicy = getRequestOriginPolicy(request);

  if (!originPolicy.allowed) {
    return jsonResponse(
      {
        error: "Forbidden origin",
        reason: originPolicy.reason,
      },
      { status: 403, cache: "BYPASS", source: "none", request },
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders({ request, cacheControl: "no-store" }),
    });
  }

  if (url.pathname === "/live-matches") {
    return handleLiveMatchesRequest(request, env);
  }

  if (url.pathname === "/match-detail") {
    return handleMatchDetailRequest(request, url);
  }

  if (url.pathname === "/league-standings") {
    return handleLeagueStandingsRequest(request, url);
  }

  if (url.pathname === "/tournament-bracket") {
    return handleTournamentBracketRequest(request, url);
  }

  return jsonResponse(
    { error: "Not found" },
    { status: 404, cache: "BYPASS", source: "none", request },
  );
}

async function handleLiveMatchesRequest(request, env) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed" },
      { status: 405, cache: "BYPASS", source: "none", request },
    );
  }

  const cache = caches.default;
  const cacheKey = new Request(CACHE_KEY_URL, { method: "GET" });
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const body = await cachedResponse.text();
    return new Response(body, {
      status: cachedResponse.status,
      headers: responseHeaders({
        request,
        cache: "HIT",
        source: cachedResponse.headers.get("X-Data-Source") || "cache",
        cacheControl:
          cachedResponse.headers.get("Cache-Control") || "public, max-age=30",
      }),
    });
  }

  try {
    return await getFreshLiveMatchesResponse(env, cache, cacheKey, request);
  } catch (error) {
    console.warn(`Live match refresh failed: ${getErrorMessage(error)}`);
    return jsonResponse(
      { error: "Live match data could not be fetched" },
      { status: 502, cache: "BYPASS", source: "none", request },
    );
  }
}

async function handleMatchDetailRequest(request, url) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed" },
      { status: 405, cache: "BYPASS", source: "none", request },
    );
  }

  const eventId = url.searchParams.get("eventId") || "";
  const leagueCode = url.searchParams.get("leagueCode") || "";

  if (!isSafeEventId(eventId) || !isSupportedLeagueCode(leagueCode)) {
    return jsonResponse(
      { error: "Invalid match detail request" },
      { status: 400, cache: "BYPASS", source: "none", request },
    );
  }

  const cache = caches.default;
  const cacheKey = new Request(
    `https://live-score-extension.internal/match-detail/${MATCH_DETAIL_CACHE_KEY_VERSION}/${leagueCode}/${eventId}`,
    { method: "GET" },
  );
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const body = await cachedResponse.text();
    return new Response(body, {
      status: cachedResponse.status,
      headers: responseHeaders({
        request,
        cache: "HIT",
        source: "espn-summary",
        cacheControl: `public, max-age=${MATCH_DETAIL_CACHE_TTL_SECONDS}`,
      }),
    });
  }

  if (!(await isKnownMatchDetailEvent(cache, eventId, leagueCode))) {
    return jsonResponse(
      { error: "Match detail is not available for this event" },
      { status: 404, cache: "BYPASS", source: "none", request },
    );
  }

  try {
    return await getFreshMatchDetailResponse(
      eventId,
      leagueCode,
      cache,
      cacheKey,
      request,
    );
  } catch (error) {
    console.warn(`Match detail refresh failed: ${getErrorMessage(error)}`);
    return jsonResponse(
      { error: "Match detail could not be fetched" },
      { status: 502, cache: "BYPASS", source: "none", request },
    );
  }
}

async function handleLeagueStandingsRequest(request, url) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed" },
      { status: 405, cache: "BYPASS", source: "none", request },
    );
  }

  const leagueCode = url.searchParams.get("leagueCode") || "";

  if (!isSupportedLeagueCode(leagueCode)) {
    return jsonResponse(
      { error: "Invalid league standings request" },
      { status: 400, cache: "BYPASS", source: "none", request },
    );
  }

  const cache = caches.default;
  const cacheKey = getStandingsCacheKey(leagueCode);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const body = await cachedResponse.text();
    return new Response(body, {
      status: cachedResponse.status,
      headers: responseHeaders({
        request,
        cache: "HIT",
        source: "espn-standings",
        cacheControl:
          cachedResponse.headers.get("Cache-Control") ||
          `public, max-age=${STANDINGS_CACHE_TTL_SECONDS}`,
      }),
    });
  }

  try {
    const standings = await getFreshStandingsForLeague(leagueCode, cache, cacheKey);
    const response = jsonResponse(
      { leagueCode, standings },
      {
        request,
        cache: "MISS",
        source: "espn-standings",
        cacheControl: `public, max-age=${STANDINGS_CACHE_TTL_SECONDS}`,
      },
    );

    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn(`Standings cache put failed: ${getErrorMessage(error)}`);
    }

    return response;
  } catch (error) {
    console.warn(`League standings failed: ${getErrorMessage(error)}`);
    return jsonResponse(
      { error: "League standings could not be fetched" },
      { status: 502, cache: "BYPASS", source: "none", request },
    );
  }
}

async function handleTournamentBracketRequest(request, url) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed" },
      { status: 405, cache: "BYPASS", source: "none", request },
    );
  }

  const leagueCode = url.searchParams.get("leagueCode") || "";

  if (leagueCode !== FIFA_WORLD_CUP_LEAGUE_CODE) {
    return jsonResponse(
      { error: "Invalid tournament bracket request" },
      { status: 400, cache: "BYPASS", source: "none", request },
    );
  }

  const cache = caches.default;
  const cacheKey = getTournamentBracketCacheKey(leagueCode);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const body = await cachedResponse.text();
    return new Response(body, {
      status: cachedResponse.status,
      headers: responseHeaders({
        request,
        cache: "HIT",
        source: "espn-tournament-bracket",
        cacheControl:
          cachedResponse.headers.get("Cache-Control") ||
          `public, max-age=${TOURNAMENT_BRACKET_CACHE_TTL_SECONDS}`,
      }),
    });
  }

  try {
    return await getFreshTournamentBracketResponse(
      leagueCode,
      cache,
      cacheKey,
      request,
    );
  } catch (error) {
    console.warn(`Tournament bracket failed: ${getErrorMessage(error)}`);
    return jsonResponse(
      { error: "Tournament bracket could not be fetched" },
      { status: 502, cache: "BYPASS", source: "none", request },
    );
  }
}

async function getFreshLiveMatchesResponse(env, cache, cacheKey, request) {
  if (!liveMatchesRefreshPromise) {
    liveMatchesRefreshPromise = refreshLiveMatches(env, cache, cacheKey).finally(
      () => {
        liveMatchesRefreshPromise = null;
      },
    );
  }

  const response = await liveMatchesRefreshPromise;
  return responseForRequest(response, request);
}

async function getFreshMatchDetailResponse(
  eventId,
  leagueCode,
  cache,
  cacheKey,
  request,
) {
  const promiseKey = `${leagueCode}:${eventId}`;

  if (!matchDetailRefreshPromises.has(promiseKey)) {
    matchDetailRefreshPromises.set(
      promiseKey,
      refreshMatchDetail(eventId, leagueCode, cache, cacheKey).finally(
        () => {
          matchDetailRefreshPromises.delete(promiseKey);
        },
      ),
    );
  }

  const response = await matchDetailRefreshPromises.get(promiseKey);
  return responseForRequest(response, request);
}

async function getFreshStandingsForLeague(leagueCode, cache, cacheKey) {
  if (!standingsRefreshPromises.has(leagueCode)) {
    standingsRefreshPromises.set(
      leagueCode,
      refreshStandingsForLeague(leagueCode, cache, cacheKey).finally(() => {
        standingsRefreshPromises.delete(leagueCode);
      }),
    );
  }

  return standingsRefreshPromises.get(leagueCode);
}

async function getFreshTournamentBracketResponse(
  leagueCode,
  cache,
  cacheKey,
  request,
) {
  if (!tournamentBracketRefreshPromises.has(leagueCode)) {
    tournamentBracketRefreshPromises.set(
      leagueCode,
      refreshTournamentBracket(leagueCode, cache, cacheKey).finally(
        () => {
          tournamentBracketRefreshPromises.delete(leagueCode);
        },
      ),
    );
  }

  const response = await tournamentBracketRefreshPromises.get(leagueCode);
  return responseForRequest(response, request);
}

async function refreshLiveMatches(env, cache, cacheKey) {
  const { matches, source } = await getLiveMatches(env);
  const cacheTtl = countLiveMatches(matches) > 0
    ? LIVE_CACHE_TTL_SECONDS
    : IDLE_CACHE_TTL_SECONDS;
  const data = {
    matches,
    leagues: groupMatchesByLeague(matches),
  };
  rememberKnownMatches(matches);
  const response = jsonResponse(data, {
    cache: "MISS",
    source,
    cacheControl: `public, max-age=${cacheTtl}`,
  });

  try {
    await cache.put(cacheKey, response.clone());
  } catch (error) {
    console.warn(`Cache put failed: ${getErrorMessage(error)}`);
  }

  return response;
}

async function refreshStandingsForLeague(leagueCode) {
  const payload = await fetchJson(
    `${ESPN_STANDINGS_BASE_URL}/${leagueCode}/standings`,
  );
  return normalizeEspnStandings(payload);
}

async function refreshMatchDetail(eventId, leagueCode, cache, cacheKey) {
  const payload = await fetchJson(
    `${ESPN_SUMMARY_BASE_URL}/${leagueCode}/summary?event=${eventId}`,
  );
  const data = normalizeEspnMatchDetail(payload, { eventId, leagueCode });
  const response = jsonResponse(data, {
    cache: "MISS",
    source: "espn-summary",
    cacheControl: `public, max-age=${MATCH_DETAIL_CACHE_TTL_SECONDS}`,
  });

  try {
    await cache.put(cacheKey, response.clone());
  } catch (error) {
    console.warn(`Match detail cache put failed: ${getErrorMessage(error)}`);
  }

  return response;
}

async function refreshTournamentBracket(leagueCode, cache, cacheKey) {
  const payload = await fetchJson(
    `${ESPN_SUMMARY_BASE_URL}/${leagueCode}/scoreboard?dates=${FIFA_WORLD_CUP_KNOCKOUT_DATES}`,
  );
  const data = normalizeTournamentBracket(payload, leagueCode);
  rememberKnownBracketRounds(data.rounds);
  const response = jsonResponse(data, {
    cache: "MISS",
    source: "espn-tournament-bracket",
    cacheControl: `public, max-age=${TOURNAMENT_BRACKET_CACHE_TTL_SECONDS}`,
  });

  try {
    await cache.put(cacheKey, response.clone());
  } catch (error) {
    console.warn(`Tournament bracket cache put failed: ${getErrorMessage(error)}`);
  }

  return response;
}

async function getLiveMatches(env) {
  try {
    const espnPayloads = await fetchEspnScoreboardPayloads();
    return {
      matches: normalizeEspnMatchPayloads(espnPayloads),
      source: "espn",
    };
  } catch (espnError) {
    if (!env.THESPORTSDB_API_KEY) {
      throw new Error(
        `ESPN request failed and THESPORTSDB_API_KEY is not configured: ${getErrorMessage(
          espnError,
        )}`,
      );
    }

    const sportsDbPayload = await fetchJson(THESPORTSDB_LIVE_SCORE_URL, {
      headers: {
        "X-API-KEY": env.THESPORTSDB_API_KEY,
      },
    });

    return {
      matches: normalizeSportsDbMatches(sportsDbPayload),
      source: "thesportsdb",
    };
  }
}

async function fetchEspnScoreboardPayloads() {
  const [primaryResult, ...extraResults] = await Promise.allSettled([
    fetchJson(ESPN_SCOREBOARD_URL),
    ...EXTRA_ESPN_SCOREBOARD_LEAGUES.map((leagueCode) =>
      fetchJson(`${ESPN_SUMMARY_BASE_URL}/${leagueCode}/scoreboard`),
    ),
  ]);

  if (primaryResult.status === "rejected") {
    throw primaryResult.reason;
  }

  const payloads = [primaryResult.value];

  for (const result of extraResults) {
    if (result.status === "fulfilled") {
      payloads.push(result.value);
    } else {
      console.warn(
        `Extra ESPN scoreboard failed: ${getErrorMessage(result.reason)}`,
      );
    }
  }

  return payloads;
}

function normalizeEspnMatchPayloads(payloads) {
  const matchesById = new Map();

  for (const payload of payloads) {
    for (const match of normalizeEspnMatches(payload)) {
      if (!matchesById.has(match.id)) {
        matchesById.set(match.id, match);
      }
    }
  }

  return [...matchesById.values()];
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    /* SEC-03: validate Content-Type before parsing */
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      throw new Error(`${url} returned unexpected Content-Type: ${contentType}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeEspnMatches(payload) {
  const events = Array.isArray(payload.events) ? payload.events : [];
  const payloadLeague = getPayloadLeagueMetadata(payload);

  return events
    .map((event) => {
      const competition = Array.isArray(event.competitions)
        ? event.competitions[0]
        : null;
      const competitors = Array.isArray(competition?.competitors)
        ? competition.competitors
        : [];
      const home = competitors.find((team) => team.homeAway === "home");
      const away = competitors.find((team) => team.homeAway === "away");

      if (!competition || !home || !away) {
        return null;
      }

      const status = competition.status || event.status || {};
      const leagueId = extractLeagueId(event.uid) || payloadLeague?.id || "";
      const league = getLeagueMetadata(leagueId, event.season?.slug, payloadLeague);

      /* Skip leagues not in our curated map */
      if (!league.code || !isSupportedLeagueCode(league.code)) {
        return null;
      }

      return {
        id: String(event.id || competition.id || ""),
        leagueId: league.id || leagueId || league.code,
        leagueCode: league.code,
        league: league.name,
        leagueLogoId: league.logoId || null,
        leagueLogoStyle: league.logoStyle || "default",
        leagueLogoUrl: league.logoUrl || null,
        leagueLogoTone: league.logoTone || "dark",
        homeTeam: getEspnTeamName(home),
        awayTeam: getEspnTeamName(away),
        homeTeamId: getEspnTeamId(home),
        awayTeamId: getEspnTeamId(away),
        homeLogo: getEspnTeamLogo(home),
        awayLogo: getEspnTeamLogo(away),
        homeScore: toNumber(home.score),
        awayScore: toNumber(away.score),
        minute: formatEspnMinute(status),
        status: formatEspnStatus(status),
        state: getEspnMatchState(status),
        kickoff: event.date || competition.date || null,
        venue: formatVenue(competition.venue),
      };
    })
    .filter(Boolean)
    .filter(isRelevantMatch);
}

function normalizeSportsDbMatches(payload) {
  const rows =
    payload?.livescores ||
    payload?.events ||
    payload?.event ||
    payload?.results ||
    payload?.livescore ||
    [];
  const events = Array.isArray(rows) ? rows : [];

  return events
    .map((event) => ({
      id: String(event.idEvent || event.idLiveScore || event.id || ""),
      leagueId: String(event.idLeague || event.leagueId || event.strLeague || ""),
      leagueCode: null,
      league: event.strLeague || event.league || "Unknown League",
      leagueLogoTone: "dark",
      homeTeam: event.strHomeTeam || event.strHomeModel || event.homeTeam || "Home",
      awayTeam: event.strAwayTeam || event.strAwayModel || event.awayTeam || "Away",
      homeScore: toNumber(event.intHomeScore || event.homeScore),
      awayScore: toNumber(event.intAwayScore || event.awayScore),
      minute: formatSportsDbMinute(event),
      status: event.strStatus || event.strProgress || event.status || "Unknown",
      state: getSportsDbMatchState(event),
      kickoff: event.dateEvent || event.strTimestamp || event.date || null,
    }))
    .filter(isRelevantMatch);
}

function normalizeTournamentBracket(payload, leagueCode) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const roundsBySlug = new Map();

  for (const event of events) {
    const match = normalizeTournamentBracketMatch(event, leagueCode);
    if (!match) {
      continue;
    }

    if (!roundsBySlug.has(match.roundSlug)) {
      roundsBySlug.set(match.roundSlug, {
        slug: match.roundSlug,
        name: formatTournamentRoundName(match.roundSlug),
        order: getTournamentRoundOrder(match.roundSlug),
        matches: [],
      });
    }

    roundsBySlug.get(match.roundSlug).matches.push(match);
  }

  const rounds = [...roundsBySlug.values()]
    .map((round) => ({
      slug: round.slug,
      name: round.name,
      matches: round.matches.sort(compareTournamentMatches),
    }))
    .sort((a, b) => getTournamentRoundOrder(a.slug) - getTournamentRoundOrder(b.slug));

  return {
    leagueCode,
    dates: FIFA_WORLD_CUP_KNOCKOUT_DATES,
    rounds,
  };
}

function normalizeTournamentBracketMatch(event, leagueCode) {
  const competition = Array.isArray(event?.competitions)
    ? event.competitions[0]
    : null;
  const competitors = Array.isArray(competition?.competitors)
    ? competition.competitors
    : [];
  const home = competitors.find((team) => team.homeAway === "home") || competitors[0];
  const away = competitors.find((team) => team.homeAway === "away") || competitors[1];

  if (!competition || !home || !away) {
    return null;
  }

  const status = competition.status || event.status || {};
  const roundSlug = normalizeTournamentRoundSlug(event?.season?.slug);

  return {
    id: String(event.id || competition.id || ""),
    leagueCode,
    roundSlug,
    roundName: formatTournamentRoundName(roundSlug),
    homeTeam: getEspnTeamName(home),
    awayTeam: getEspnTeamName(away),
    homeTeamId: getEspnTeamId(home),
    awayTeamId: getEspnTeamId(away),
    homeLogo: getEspnTeamLogo(home),
    awayLogo: getEspnTeamLogo(away),
    homeScore: toNumber(home.score),
    awayScore: toNumber(away.score),
    minute: formatEspnMinute(status),
    status: formatEspnStatus(status),
    state: getEspnMatchState(status),
    kickoff: event.date || competition.date || null,
    venue: formatVenue(competition.venue),
  };
}

function normalizeTournamentRoundSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return slug || "other";
}

function formatTournamentRoundName(slug) {
  const names = {
    "round-of-32": "Round of 32",
    "round-of-16": "Round of 16",
    quarterfinals: "Quarter-finals",
    semifinals: "Semi-finals",
    "3rd-place-match": "Third-place match",
    final: "Final",
  };

  return names[slug] || formatLeagueName(slug);
}

function getTournamentRoundOrder(slug) {
  const order = {
    "round-of-32": 10,
    "round-of-16": 20,
    quarterfinals: 30,
    semifinals: 40,
    "3rd-place-match": 50,
    final: 60,
  };

  return order[slug] || 999;
}

function compareTournamentMatches(a, b) {
  const dateDiff = Date.parse(a.kickoff || "") - Date.parse(b.kickoff || "");
  if (Number.isFinite(dateDiff) && dateDiff !== 0) {
    return dateDiff;
  }

  return a.homeTeam.localeCompare(b.homeTeam);
}

function getEspnTeamName(competitor) {
  return (
    competitor.team?.displayName ||
    competitor.team?.shortDisplayName ||
    competitor.team?.name ||
    "Unknown Team"
  );
}

function getEspnTeamId(competitor) {
  return competitor.team?.id ? String(competitor.team.id) : "";
}

function getEspnTeamLogo(competitor) {
  return getTeamLogoFromTeam(competitor.team);
}

function getTeamLogoFromTeam(team) {
  if (!team) {
    return null;
  }

  if (Array.isArray(team.logos) && team.logos[0]?.href) {
    return safeHttpsUrl(team.logos[0].href, ESPN_MEDIA_HOST_SUFFIXES);
  }

  if (team.logo) {
    return safeHttpsUrl(team.logo, ESPN_MEDIA_HOST_SUFFIXES);
  }

  const overrideLogo = getTeamLogoOverrideFromTeam(team);
  if (overrideLogo) {
    return overrideLogo;
  }

  if (team.id) {
    const teamId = sanitizeEspnAssetId(team.id);
    return teamId
      ? `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`
      : null;
  }

  return null;
}

function getTeamLogoOverrideFromTeam(team) {
  const teamId = sanitizeEspnAssetId(team?.id);
  const idOverride = TEAM_LOGO_OVERRIDES_BY_ID.get(teamId);
  if (idOverride) {
    return safeHttpsUrl(idOverride, TEAM_LOGO_OVERRIDE_HOST_SUFFIXES);
  }

  const names = [
    team?.displayName,
    team?.shortDisplayName,
    team?.name,
    team?.location,
  ];

  for (const name of names) {
    const override = TEAM_LOGO_OVERRIDES_BY_NAME.get(normalizeLookupName(name));
    if (override) {
      return safeHttpsUrl(override, TEAM_LOGO_OVERRIDE_HOST_SUFFIXES);
    }
  }

  return null;
}

function normalizeLookupName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeEspnMatchDetail(payload, context) {
  const header = payload?.header || {};
  const competition = Array.isArray(header.competitions)
    ? header.competitions[0]
    : {};
  const competitors = Array.isArray(competition?.competitors)
    ? competition.competitors
    : [];
  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");
  const status = competition?.status || header?.status || {};

  return {
    id: String(header.id || context.eventId),
    leagueCode: context.leagueCode,
    title: buildMatchTitle(home, away),
    minute: formatEspnMinute(status),
    status: formatEspnStatus(status),
    state: getEspnMatchState(status),
    kickoff: header.date || competition?.date || null,
    venue: formatVenue(payload?.gameInfo?.venue || competition?.venue),
    broadcasts: normalizeBroadcasts(payload?.broadcasts || competition?.broadcasts),
    teams: {
      home: normalizeDetailTeam(home),
      away: normalizeDetailTeam(away),
    },
    timeline: normalizeTimeline(
      payload?.keyEvents,
      competition?.details || payload?.details,
    ),
    commentary: normalizeCommentary(payload?.commentary),
    stats: normalizeMatchStats(payload, home, away),
    lineups: normalizeLineups(payload),
    headToHead: normalizeHeadToHead(payload?.headToHeadGames),
    news: normalizeNews(payload?.news),
    videos: normalizeVideos(payload?.videos),
    links: normalizeLinks(
      [
        ...(Array.isArray(header?.links) ? header.links : []),
        ...(Array.isArray(competition?.links) ? competition.links : []),
      ],
      context.eventId,
    ),
  };
}

function normalizeDetailTeam(competitor) {
  return {
    id: getEspnTeamId(competitor || {}),
    name: getEspnTeamName(competitor || {}),
    shortName:
      competitor?.team?.shortDisplayName ||
      competitor?.team?.abbreviation ||
      getEspnTeamName(competitor || {}),
    logo: getEspnTeamLogo(competitor || {}),
    score: toNumber(competitor?.score),
    record: getTeamRecord(competitor),
  };
}

function buildMatchTitle(home, away) {
  const homeName = home ? getEspnTeamName(home) : "Home";
  const awayName = away ? getEspnTeamName(away) : "Away";
  return `${homeName} vs ${awayName}`;
}

function getTeamRecord(competitor) {
  if (!Array.isArray(competitor?.records)) {
    return "";
  }

  const record = competitor.records.find((row) => row.summary) || competitor.records[0];
  return record?.summary || "";
}

function normalizeBroadcasts(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => row?.names?.join(", ") || row?.name || row?.shortName || "")
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeTimeline(keyEvents, detailEvents) {
  const rows = Array.isArray(keyEvents) && keyEvents.length > 0
    ? keyEvents
    : Array.isArray(detailEvents)
      ? detailEvents
      : [];

  return rows
    .map((event, index) => ({
      id: String(event.id || event.sequenceNumber || index),
      minute: getEventMinute(event),
      type: getEventType(event),
      text: getEventText(event),
      team: getEventTeam(event),
      players: getEventPlayers(event),
    }))
    .filter((event) => event.text || event.type || event.players.length > 0)
    .slice(0, 24);
}

function getEventMinute(event) {
  const candidates = [
    event?.clock?.displayValue,
    event?.time?.displayValue,
    event?.displayTime,
    event?.shortDisplayTime,
    event?.minute,
  ];
  const value = candidates.find((item) => item !== undefined && item !== null && item !== "");

  if (typeof value === "number") {
    return `${Math.floor(value)}'`;
  }

  return value ? String(value) : "";
}

function getEventType(event) {
  return (
    event?.type?.text ||
    event?.type?.displayName ||
    event?.type?.name ||
    event?.type?.abbreviation ||
    event?.scoringType?.displayName ||
    ""
  );
}

function getEventText(event) {
  return (
    event?.text ||
    event?.displayName ||
    event?.description ||
    event?.headline ||
    getEventType(event)
  );
}

function getEventTeam(event) {
  return (
    event?.team?.shortDisplayName ||
    event?.team?.displayName ||
    event?.team?.name ||
    event?.competitor?.team?.shortDisplayName ||
    event?.competitor?.team?.displayName ||
    ""
  );
}

function getEventPlayers(event) {
  const rows = [
    ...(Array.isArray(event?.participants) ? event.participants : []),
    ...(Array.isArray(event?.athletes) ? event.athletes : []),
  ];
  const names = new Set();

  for (const row of rows) {
    const name =
      row?.athlete?.displayName ||
      row?.athlete?.shortName ||
      row?.displayName ||
      row?.shortName ||
      row?.name;
    if (name) {
      names.add(name);
    }
  }

  return [...names].slice(0, 4);
}

function normalizeCommentary(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row, index) => ({
      id: String(row.id || row.sequenceNumber || index),
      minute: getEventMinute(row),
      text: row.text || row.shortText || row.description || "",
    }))
    .filter((row) => row.text)
    .slice(0, 12);
}

function normalizeMatchStats(payload, homeCompetitor, awayCompetitor) {
  const teams = Array.isArray(payload?.boxscore?.teams)
    ? payload.boxscore.teams
    : [];

  if (teams.length === 0) {
    return [];
  }

  const homeTeam = findBoxscoreTeam(teams, homeCompetitor, "home", 0);
  const awayTeam = findBoxscoreTeam(teams, awayCompetitor, "away", 1);
  const homeStats = buildBoxscoreStatMap(homeTeam?.statistics);
  const awayStats = buildBoxscoreStatMap(awayTeam?.statistics);
  const names = getOrderedStatNames(homeStats, awayStats);

  return names
    .map((name) => {
      const homeStat = homeStats.get(name);
      const awayStat = awayStats.get(name);
      return {
        name,
        label: getStatLabel(homeStat || awayStat, name),
        homeValue: formatStatValue(homeStat, name),
        awayValue: formatStatValue(awayStat, name),
        homeNumeric: parseStatNumeric(homeStat),
        awayNumeric: parseStatNumeric(awayStat),
      };
    })
    .filter((stat) => stat.homeValue || stat.awayValue)
    .slice(0, 18);
}

function findBoxscoreTeam(teams, competitor, homeAway, fallbackIndex) {
  const competitorId = getEspnTeamId(competitor || {});
  return (
    teams.find((team) => team?.homeAway === homeAway) ||
    teams.find((team) => competitorId && String(team?.team?.id) === competitorId) ||
    teams[fallbackIndex] ||
    null
  );
}

function buildBoxscoreStatMap(rows) {
  const map = new Map();

  if (!Array.isArray(rows)) {
    return map;
  }

  for (const row of rows) {
    if (row?.name) {
      map.set(row.name, row);
    }
  }

  return map;
}

function getOrderedStatNames(homeStats, awayStats) {
  const preferred = [
    "possessionPct",
    "totalShots",
    "shotsOnTarget",
    "wonCorners",
    "foulsCommitted",
    "yellowCards",
    "redCards",
    "offsides",
    "saves",
    "totalPasses",
    "accuratePasses",
    "passPct",
    "blockedShots",
    "totalTackles",
    "interceptions",
    "totalClearance",
  ];
  const names = new Set([...homeStats.keys(), ...awayStats.keys()]);
  const ordered = preferred.filter((name) => names.has(name));

  for (const name of names) {
    if (!ordered.includes(name)) {
      ordered.push(name);
    }
  }

  return ordered;
}

function getStatLabel(stat, name) {
  const labels = {
    accuratePasses: "Accurate Passes",
    blockedShots: "Blocked Shots",
    foulsCommitted: "Fouls",
    interceptions: "Interceptions",
    offsides: "Offsides",
    passPct: "Pass Completion",
    possessionPct: "Possession",
    redCards: "Red Cards",
    saves: "Saves",
    shotsOnTarget: "Shots On Target",
    totalClearance: "Clearances",
    totalPasses: "Passes",
    totalShots: "Shots",
    totalTackles: "Tackles",
    wonCorners: "Corners",
    yellowCards: "Yellow Cards",
  };

  return labels[name] || titleCaseStatLabel(stat?.label || name);
}

function titleCaseStatLabel(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Pct\b/i, "%")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatValue(stat, name) {
  if (!stat) {
    return "";
  }

  const raw = stat.displayValue ?? stat.value ?? "";
  const number = Number(raw);

  if (/Pct$/.test(name) && Number.isFinite(number)) {
    const percent = number <= 1 ? number * 100 : number;
    return `${roundStatNumber(percent)}%`;
  }

  return String(raw);
}

function parseStatNumeric(stat) {
  if (!stat) {
    return null;
  }

  const raw = stat.value ?? stat.displayValue;
  const number = Number(String(raw).replace("%", ""));
  return Number.isFinite(number) ? number : null;
}

function roundStatNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Math.round(value * 10) / 10);
}

function normalizeLineups(payload) {
  const rosterGroups = Array.isArray(payload?.rosters)
    ? payload.rosters
    : Array.isArray(payload?.boxscore?.players)
      ? payload.boxscore.players
      : [];

  return rosterGroups
    .map((group) => {
      const players = getRosterPlayers(group)
        .map(normalizeRosterPlayer)
        .filter((player) => player.name)
        .sort(compareRosterPlayers)
        .slice(0, 24);

      return {
        team:
          group?.team?.shortDisplayName ||
          group?.team?.displayName ||
          group?.team?.name ||
          "Team",
        logo: getTeamLogoFromTeam(group?.team),
        players,
      };
    })
    .filter((group) => group.players.length > 0)
    .slice(0, 2);
}

function getRosterPlayers(group) {
  if (Array.isArray(group?.roster)) {
    return group.roster;
  }

  if (Array.isArray(group?.players)) {
    return group.players;
  }

  if (Array.isArray(group?.statistics)) {
    return group.statistics.flatMap((stat) =>
      Array.isArray(stat?.athletes) ? stat.athletes : [],
    );
  }

  return [];
}

function normalizeRosterPlayer(row) {
  const athlete = row?.athlete || row;
  const position = athlete?.position || row?.position || {};

  return {
    id: athlete?.id ? String(athlete.id) : "",
    name: athlete?.displayName || athlete?.shortName || athlete?.name || "",
    position:
      position?.abbreviation ||
      position?.displayName ||
      position?.name ||
      (typeof position === "string" ? position : ""),
    jersey: athlete?.jersey || row?.jersey || "",
    starter: Boolean(row?.starter || row?.didStart),
  };
}

function compareRosterPlayers(a, b) {
  if (a.starter !== b.starter) {
    return a.starter ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function normalizeHeadToHead(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((event) => {
      const competition = Array.isArray(event?.competitions)
        ? event.competitions[0]
        : {};
      const competitors = Array.isArray(competition?.competitors)
        ? competition.competitors
        : [];
      const home = competitors.find((team) => team.homeAway === "home");
      const away = competitors.find((team) => team.homeAway === "away");

      return {
        id: String(event?.id || competition?.id || ""),
        date: event?.date || competition?.date || null,
        homeTeam: home ? getEspnTeamName(home) : "",
        awayTeam: away ? getEspnTeamName(away) : "",
        homeScore: toNumber(home?.score),
        awayScore: toNumber(away?.score),
        status: formatEspnStatus(competition?.status || event?.status || {}),
      };
    })
    .filter((event) => event.homeTeam && event.awayTeam)
    .slice(0, 5);
}

function normalizeNews(news) {
  const articles = Array.isArray(news?.articles)
    ? news.articles
    : Array.isArray(news)
      ? news
      : [];

  return articles
    .map((article) => ({
      title: article?.headline || article?.title || "",
      description: article?.description || "",
      url: safeHttpsUrl(
        article?.links?.web?.href || article?.link || article?.url,
        ESPN_LINK_HOST_SUFFIXES,
      ),
    }))
    .filter((article) => article.title)
    .slice(0, 4);
}

function normalizeVideos(videos) {
  if (!Array.isArray(videos)) {
    return [];
  }

  return videos
    .map((video) => ({
      title: video?.headline || video?.title || "",
      duration: video?.duration || "",
      thumbnail: safeHttpsUrl(
        video?.thumbnail ||
          video?.images?.[0]?.url ||
          video?.links?.thumbnail?.href,
        ESPN_MEDIA_HOST_SUFFIXES,
      ),
      url: safeHttpsUrl(
        video?.links?.web?.href || video?.link || video?.url,
        ESPN_LINK_HOST_SUFFIXES,
      ),
    }))
    .filter((video) => video.title)
    .slice(0, 4);
}

function normalizeLinks(links, eventId = "") {
  const seen = new Set();
  const normalized = links
    .map((link) => ({
      label: link?.text || link?.shortText || link?.rel?.[0] || "Open",
      url: safeHttpsUrl(link?.href, ESPN_LINK_HOST_SUFFIXES),
    }))
    .filter((link) => {
      if (!link.url || seen.has(link.url)) {
        return false;
      }
      seen.add(link.url);
      return true;
    })
    .slice(0, 6);

  if (normalized.length > 0) {
    return normalized;
  }

  if (!isSafeEventId(String(eventId))) {
    return [];
  }

  return [
    {
      label: "ESPN Match Center",
      url: `https://www.espn.com/soccer/match/_/gameId/${eventId}`,
    },
  ];
}

function normalizeEspnStandings(payload) {
  const rows = getEspnStandingRows(payload);

  if (!Array.isArray(rows)) {
    return [];
  }

  /* OPT-04: build stat Map once per entry instead of repeated Array.find */
  return rows.map(({ entry, group, groupOrder, fallbackPosition }) => {
    const statMap = new Map();
    if (Array.isArray(entry.stats)) {
      for (const stat of entry.stats) {
        statMap.set(stat.name, stat);
      }
    }

    const getStat = (names, preferDisplay = false) => {
      for (const name of Array.isArray(names) ? names : [names]) {
        const stat = statMap.get(name);
        if (stat) {
          return preferDisplay ? stat.displayValue : stat.value ?? stat.displayValue;
        }
      }
      return "";
    };

    return {
      position: toNumber(getStat("rank")) || fallbackPosition,
      group,
      groupOrder,
      abbreviation: entry.team?.abbreviation || "",
      logo: getTeamLogoFromTeam(entry.team),
      team:
        entry.team?.shortDisplayName ||
        entry.team?.displayName ||
        entry.team?.name ||
        "Unknown Team",
      played: toNumber(getStat("gamesPlayed")),
      wins: toNumber(getStat("wins")),
      draws: toNumber(getStat("ties")),
      losses: toNumber(getStat("losses")),
      goalsFor: toNumber(getStat(["pointsFor", "goalsFor"])),
      goalsAgainst: toNumber(getStat(["pointsAgainst", "goalsAgainst"])),
      goalDifference: String(getStat("pointDifferential", true) || "0"),
      points: toNumber(getStat("points")),
      pointsPerGame: String(getStat("ppg", true) || ""),
      deductions: toNumber(getStat("deductions")),
      overall: String(getStat("overall", true) || ""),
    };
  }).sort(compareStandingRows);
}

function getEspnStandingRows(payload) {
  const rows = [];
  const appendEntries = (entries, group, groupOrder) => {
    entries.forEach((entry, index) => {
      rows.push({
        entry,
        group,
        groupOrder,
        fallbackPosition: index + 1,
      });
    });
  };

  if (Array.isArray(payload?.standings?.entries)) {
    appendEntries(payload.standings.entries, payload.standings.name || "", 0);
  }

  if (Array.isArray(payload?.children)) {
    payload.children.forEach((child, index) => {
      if (Array.isArray(child?.standings?.entries)) {
        appendEntries(
          child.standings.entries,
          child.displayName || child.name || child.abbreviation || "",
          index,
        );
      }
    });
  }

  return rows;
}

function compareStandingRows(a, b) {
  const groupDiff = a.groupOrder - b.groupOrder;

  if (groupDiff !== 0) {
    return groupDiff;
  }

  const positionDiff = a.position - b.position;

  if (positionDiff !== 0) {
    return positionDiff;
  }

  const pointsDiff = b.points - a.points;

  if (pointsDiff !== 0) {
    return pointsDiff;
  }

  return a.team.localeCompare(b.team);
}




function compareLeagues(a, b) {
  const liveDiff = countLiveMatches(b.matches) - countLiveMatches(a.matches);

  if (liveDiff !== 0) {
    return liveDiff;
  }

  return a.name.localeCompare(b.name);
}

function compareMatches(a, b) {
  return getMatchStateRank(a.state) - getMatchStateRank(b.state);
}

function countLiveMatches(matches) {
  return matches.filter((match) => match.state === "live").length;
}

function isRelevantMatch(match) {
  if (!match || match.state !== "scheduled") {
    return Boolean(match);
  }

  const kickoffTime = Date.parse(match.kickoff || "");
  if (!Number.isFinite(kickoffTime)) {
    return false;
  }

  const now = Date.now();
  return (
    kickoffTime >= now - 60 * 60 * 1000 &&
    kickoffTime <= now + UPCOMING_MATCH_WINDOW_MS
  );
}

function getMatchStateRank(state) {
  if (state === "live") {
    return 0;
  }

  if (state === "scheduled") {
    return 1;
  }

  if (state === "finished") {
    return 2;
  }

  return 3;
}

function extractLeagueId(uid) {
  return String(uid || "").match(/~l:(\d+)/)?.[1] || "";
}

function getPayloadLeagueMetadata(payload) {
  const league = Array.isArray(payload?.leagues) ? payload.leagues[0] : null;

  if (!league) {
    return null;
  }

  return {
    id: league.id ? String(league.id) : "",
    code: league.slug || "",
    name: league.name || league.displayName || formatLeagueName(league.slug),
    logoUrl: getLeagueLogoFromPayload(league),
  };
}

function getLeagueLogoFromPayload(league) {
  if (!Array.isArray(league?.logos)) {
    return null;
  }

  const logo =
    league.logos.find((item) => Array.isArray(item.rel) && item.rel.includes("default")) ||
    league.logos[0];

  return safeHttpsUrl(logo?.href, ESPN_MEDIA_HOST_SUFFIXES);
}

function getLeagueMetadata(leagueId, seasonSlug, payloadLeague = null) {
  const metadata = ESPN_LEAGUES_BY_ID[leagueId] ||
    getLeagueMetadataByCode(payloadLeague?.code);

  if (metadata) {
    return {
      ...metadata,
      id: leagueId || metadata.id || metadata.code || "",
      logoStyle: metadata.logoStyle || "default",
      logoUrl: metadata.logoUrl || payloadLeague?.logoUrl || null,
    };
  }

  return {
    id: leagueId || "",
    code: null,
    name: payloadLeague?.name || formatLeagueName(seasonSlug),
    logoId: null,
    logoStyle: "default",
    logoUrl: payloadLeague?.logoUrl || null,
  };
}

function getLeagueMetadataByCode(leagueCode) {
  if (!leagueCode) {
    return null;
  }

  return ESPN_LEAGUES_BY_CODE.get(leagueCode) || null;
}

function buildLeagueLogoUrl(logoId, logoStyle = "default") {
  const safeLogoId = sanitizeEspnAssetId(logoId);
  if (!safeLogoId) return null;
  const directory = logoStyle === "default" ? "500" : "500-dark";
  return `${ESPN_LEAGUE_LOGO_BASE}/${directory}/${safeLogoId}.png`;
}

function sanitizeEspnAssetId(value) {
  const id = String(value || "").trim();
  return /^[a-z0-9._-]{1,64}$/i.test(id) ? id : "";
}

function isSafeEventId(eventId) {
  return new RegExp(`^\\d{3,${MAX_EVENT_ID_LENGTH}}$`).test(eventId);
}

function isSupportedLeagueCode(leagueCode) {
  return ESPN_LEAGUES_BY_CODE.has(leagueCode);
}

async function isKnownMatchDetailEvent(cache, eventId, leagueCode) {
  const eventKey = getEventKey(eventId, leagueCode);
  if (rememberedEventKeys.has(eventKey)) {
    return true;
  }

  const liveResponse = await cache.match(
    new Request(CACHE_KEY_URL, { method: "GET" }),
  );
  if (liveResponse) {
    const livePayload = await safeReadJsonResponse(liveResponse);
    rememberKnownMatches(livePayload?.matches);
    if (rememberedEventKeys.has(eventKey)) {
      return true;
    }
  }

  if (leagueCode === FIFA_WORLD_CUP_LEAGUE_CODE) {
    const bracketResponse = await cache.match(
      getTournamentBracketCacheKey(leagueCode),
    );
    if (bracketResponse) {
      const bracketPayload = await safeReadJsonResponse(bracketResponse);
      rememberKnownBracketRounds(bracketPayload?.rounds);
    }
  }

  return rememberedEventKeys.has(eventKey);
}

function rememberKnownMatches(matches) {
  if (!Array.isArray(matches)) {
    return;
  }

  for (const match of matches) {
    rememberEventKey(match?.id, match?.leagueCode);
  }
}

function rememberKnownBracketRounds(rounds) {
  if (!Array.isArray(rounds)) {
    return;
  }

  for (const round of rounds) {
    rememberKnownMatches(round?.matches);
  }
}

function rememberEventKey(eventId, leagueCode) {
  if (
    !isSafeEventId(String(eventId || "")) ||
    !isSupportedLeagueCode(leagueCode)
  ) {
    return;
  }

  const eventKey = getEventKey(eventId, leagueCode);
  rememberedEventKeys.delete(eventKey);
  rememberedEventKeys.add(eventKey);

  while (rememberedEventKeys.size > MAX_REMEMBERED_EVENT_KEYS) {
    rememberedEventKeys.delete(rememberedEventKeys.values().next().value);
  }
}

function getEventKey(eventId, leagueCode) {
  return `${leagueCode}:${eventId}`;
}

async function safeReadJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getStandingsCacheKey(leagueCode) {
  return new Request(
    `https://live-score-extension.internal/standings/${STANDINGS_CACHE_KEY_VERSION}/${leagueCode}`,
    { method: "GET" },
  );
}

function getTournamentBracketCacheKey(leagueCode) {
  const cacheKeyUrl = [
    "https://live-score-extension.internal/tournament-bracket",
    TOURNAMENT_BRACKET_CACHE_KEY_VERSION,
    leagueCode,
    FIFA_WORLD_CUP_KNOCKOUT_DATES,
  ].join("/");

  return new Request(cacheKeyUrl, { method: "GET" });
}

function formatVenue(venue) {
  if (!venue) {
    return "";
  }

  const name = venue.fullName || venue.name || "";
  const address = venue.address || {};
  const location = [
    address.city,
    address.state,
    address.country,
  ].filter(Boolean).join(", ");

  if (name && location) {
    return `${name} · ${location}`;
  }

  return name || location;
}

function groupMatchesByLeague(matches) {
  const groups = new Map(
    Object.entries(ESPN_LEAGUES_BY_ID).map(([id, league]) => [
      league.code || id,
      {
        id,
        code: league.code || null,
        name: league.name,
        logo:
          league.logoUrl ||
          buildLeagueLogoUrl(league.logoId, league.logoStyle || "default"),
        logoTone: league.logoTone || "dark",
        matches: [],
      },
    ]),
  );

  for (const match of matches) {
    const key = match.leagueCode || match.leagueId || match.league || "unknown";

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        code: match.leagueCode || null,
        name: match.league || "Unknown League",
        logo:
          match.leagueLogoUrl ||
          buildLeagueLogoUrl(match.leagueLogoId, match.leagueLogoStyle),
        logoTone: match.leagueLogoTone || "dark",
        matches: [],
      });
    }

    groups.get(key).matches.push(match);
  }

  /* Sort: leagues with live matches first, then alphabetically */
  return [...groups.values()]
    .map((league) => ({
      ...league,
      matches: league.matches.sort(compareMatches),
    }))
    .sort(compareLeagues);
}

function formatEspnMinute(status) {
  const type = status.type || {};
  const state = type.state;
  const completed = type.completed;
  const description = type.description || "";
  const displayClock = status.displayClock || "";
  const shortDetail = type.shortDetail || "";

  if (completed) {
    return "FT";
  }

  if (state === "pre") {
    return "Scheduled";
  }

  if (/^\d/.test(shortDetail)) {
    return shortDetail;
  }

  if (displayClock && displayClock !== "0'") {
    return displayClock;
  }

  if (/half\s*time/i.test(description)) {
    return "HT";
  }

  if (typeof status.clock === "number" && status.clock > 0) {
    return `${Math.floor(status.clock)}'`;
  }

  return "Live";
}

function formatEspnStatus(status) {
  const type = status.type || {};
  const state = type.state;
  const description = type.description || "";

  if (type.completed || state === "post") {
    return "Full Time";
  }

  if (/half\s*time/i.test(description)) {
    return "Half Time";
  }

  if (state === "pre") {
    return "Scheduled";
  }

  if (state === "in") {
    return "Live";
  }

  return description || type.name || "Unknown";
}

function getEspnMatchState(status) {
  const type = status.type || {};

  if (type.completed || type.state === "post") {
    return "finished";
  }

  if (type.state === "pre") {
    return "scheduled";
  }

  if (type.state === "in") {
    return "live";
  }

  return "unknown";
}

function formatSportsDbMinute(event) {
  const progress = event.strProgress || event.strStatus || "";

  if (/final|finished|full time/i.test(progress)) {
    return "FT";
  }

  if (/half/i.test(progress)) {
    return "HT";
  }

  return progress || "Live";
}

function getSportsDbMatchState(event) {
  const progress = event.strProgress || event.strStatus || event.status || "";

  if (/final|finished|full time/i.test(progress)) {
    return "finished";
  }

  if (/not started|scheduled|fixture/i.test(progress)) {
    return "scheduled";
  }

  return "live";
}

function formatLeagueName(slugOrName) {
  if (!slugOrName) {
    return "Unknown League";
  }

  return String(slugOrName)
    .replace(/^\d{4}(-\d{2,4})?-/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function safeHttpsUrl(value, allowedHostSuffixes = null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") {
      return null;
    }

    if (!isAllowedHostname(url.hostname, allowedHostSuffixes)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getRequestOriginPolicy(request) {
  const origin = request.headers.get("Origin");
  if (origin) {
    const allowed = isAllowedCorsOrigin(origin);
    return {
      allowed,
      reason: allowed ? "allowed-origin" : "blocked-origin",
    };
  }

  if (isLikelyExtensionFetchWithoutOrigin(request)) {
    return { allowed: true, reason: "allowed-extension-fetch-without-origin" };
  }

  return { allowed: false, reason: "missing-origin" };
}

function isLikelyExtensionFetchWithoutOrigin(request) {
  const userAgent = request.headers.get("User-Agent") || "";
  if (!/\b(Chrome|Chromium|Edg)\//.test(userAgent)) {
    return false;
  }

  const fetchMode = request.headers.get("Sec-Fetch-Mode");
  const fetchDest = request.headers.get("Sec-Fetch-Dest");
  const fetchSite = request.headers.get("Sec-Fetch-Site");

  const hasBrowserFetchShape =
    (!fetchMode || fetchMode === "cors") &&
    (!fetchDest || fetchDest === "empty") &&
    (!fetchSite || fetchSite === "none" || fetchSite === "cross-site");

  return hasBrowserFetchShape;
}

function corsHeadersForRequest(request) {
  const origin = request?.headers?.get("Origin") || "";
  const allowedOrigin = isAllowedCorsOrigin(origin)
    ? origin
    : ALLOWED_ORIGINS.values().next().value;

  return {
    ...securityHeaders,
    "Access-Control-Allow-Origin": allowedOrigin,
    Vary: "Origin",
  };
}

function isAllowedCorsOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin) || isChromeExtensionOrigin(origin);
}

function isChromeExtensionOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "chrome-extension:" &&
      /^[a-p]{32}$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function isAllowedHostname(hostname, allowedHostSuffixes) {
  if (!allowedHostSuffixes) {
    return true;
  }

  return allowedHostSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: responseHeaders(options),
  });
}

function responseHeaders(options = {}) {
  return {
    ...corsHeadersForRequest(options.request),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": options.cacheControl || "no-store",
    "X-Cache": options.cache || "BYPASS",
    "X-Data-Source": options.source || "none",
  };
}

async function responseForRequest(response, request) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeadersForRequest(request))) {
    headers.set(name, value);
  }

  return new Response(await response.clone().text(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
