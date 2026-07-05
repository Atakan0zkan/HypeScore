/**
 * Hype - Live Football Scores
 * Popup script — dependency-free Chrome MV3 UI.
 */

const BACKEND_URL =
  "https://api.atakanozkan.com/live-matches";
const LIVE_REFRESH_INTERVAL_MS = 60000;
const IDLE_REFRESH_INTERVAL_MS = 300000;
const QUIET_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const UPCOMING_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_VISIBLE_REFRESH_MS = 30000;
const DETAIL_RETURN_REFRESH_MIN_INTERVAL_MS = 60000;
const AUTO_PAUSE_AFTER_MS = 10 * 60 * 1000;
const INACTIVITY_PAUSE_AFTER_MS = 3 * 60 * 1000;
const ERROR_RETRY_DELAYS_MS = [120000, 300000, 600000];
const DAILY_REQUEST_LIMIT = 2000;
const CLIENT_LIVE_CACHE_VERSION = "v9";
const REQUIRED_CLIENT_CACHE_LEAGUE_CODES = ["fifa.world"];
const FIFA_WORLD_CUP_LEAGUE_CODE = "fifa.world";
const CLIENT_LIVE_CACHE_MAX_AGE_LIVE_MS = 30000;
const CLIENT_LIVE_CACHE_MAX_AGE_IDLE_MS = 120000;
const CLIENT_LIVE_CACHE_MAX_AGE_QUIET_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const LAZY_ERROR_RETRY_MS = 60000;
const STORAGE_KEY_ENABLED = "hype_enabled";
const STORAGE_KEY_FAVORITE_LEAGUES = "hype_favorite_leagues";
const STORAGE_KEY_LIVE_CACHE = "hype_live_matches_cache";
const STORAGE_KEY_DAILY_REQUEST_BUCKET = "hype_daily_request_count";
const STORAGE_KEY_ENGLISH_OVERRIDE = "hype_english_override";
const LEGACY_STORAGE_KEY_FAVORITE_TEAMS = "hype_favorite_teams";

const LOCAL_LEAGUE_LOGOS = {
  "arg.1": "icons/leagues/arg-1.png",
  "aus.1": "icons/leagues/aus-1.png",
  "aut.1": "icons/leagues/aut-1.png",
  "bel.1": "icons/leagues/bel-1.png",
  "den.1": "icons/leagues/den-1.png",
  "eng.1": "icons/leagues/eng-1.png",
  "eng.2": "icons/leagues/eng-2.png",
  "eng.fa": "icons/leagues/eng-fa.png",
  "eng.w.1": "icons/leagues/eng-w-1.png",
  "esp.1": "icons/leagues/esp-1.png",
  "fifa.world": "icons/leagues/fifa-world.png",
  "fra.1": "icons/leagues/fra-1.png",
  "ger.1": "icons/leagues/ger-1.png",
  "ger.2": "icons/leagues/ger-2.png",
  "gre.1": "icons/leagues/gre-1.png",
  "ita.1": "icons/leagues/ita-1.png",
  "mex.1": "icons/leagues/mex-1.png",
  "mex.2": "icons/leagues/mex-2.png",
  "ned.1": "icons/leagues/ned-1.png",
  "por.1": "icons/leagues/por-1.png",
  "rus.1": "icons/leagues/rus-1.png",
  "sco.1": "icons/leagues/sco-1.png",
  "swe.1": "icons/leagues/swe-1.png",
  "tur.1": "icons/leagues/tur-1.png",
  "uefa.champions": "icons/leagues/uefa-champions.png",
  "uefa.europa": "icons/leagues/uefa-europa.png",
  "uefa.europa.conf": "icons/leagues/uefa-europa-conf.png",
  "usa.1": "icons/leagues/usa-1.png",
  "usa.usl.1": "icons/leagues/usa-usl-1.png",
};

const FALLBACK_LOGO_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
  '<circle cx="16" cy="16" r="14" fill="#2a1414" stroke="#d64b45" stroke-width="1"/>',
  '<text x="16" y="20" text-anchor="middle" fill="#ef7468" ',
  'font-size="14" font-family="sans-serif">⚽</text>',
  "</svg>",
].join("");

const FALLBACK_LOGO = "data:image/svg+xml," + encodeURIComponent(FALLBACK_LOGO_SVG);

const FALLBACK_MESSAGES = {
  appTitle: "Hype Scores",
  autoPaused: "Auto refresh paused to save requests.",
  backToLeagues: "← Leagues",
  bracket: "Knockout",
  bracketUnavailable: "Knockout bracket unavailable.",
  broadcasts: "Broadcasts",
  club: "Club",
  commentary: "Commentary",
  detailsUnavailable: "Details unavailable",
  draws: "D",
  empty: "No matches found today.",
  error: "Could not load data",
  extensionRuntimeRequired:
    "Live data is blocked in file preview. Open the Chrome extension popup to load scores.",
  favorite: "Favorite",
  favoriteLeague: "Favorite league",
  forceEnglishOff: "Return to browser language",
  forceEnglishOn: "Show English labels",
  fullTime: "FT",
  goalDifference: "GD",
  goalsAgainst: "A",
  goalsFor: "F",
  halfTime: "HT",
  headToHead: "Head to head",
  highlights: "Highlights",
  idlePaused: "Paused while inactive.",
  kickoff: "Kickoff",
  lineups: "Lineups",
  links: "Links",
  live: "Live",
  loading: "Loading matches…",
  loadingDetails: "Loading match details…",
  loadingBracket: "Loading knockout bracket…",
  loadingStandings: "Loading standings…",
  losses: "L",
  matchDetails: "Match details",
  matches: "Matches",
  news: "News",
  noLinks: "No links available.",
  noNews: "No news available.",
  noBracket: "No knockout bracket available.",
  noDetails: "No extra details available for this match.",
  noSectionData: "No data available.",
  noStats: "No match stats available.",
  noStandings: "No standings available for this league.",
  notUpdated: "Not updated yet",
  other: "Other",
  paused: "Paused",
  played: "P",
  points: "Pts",
  ready: "Ready",
  refreshFailed: "Refresh failed. Showing latest data.",
  refreshing: "Refreshing",
  requestLimitReached: "Daily request limit reached. Showing cached data.",
  removeFavorite: "Remove favorite",
  results: "Results",
  scheduled: "Scheduled",
  stats: "Stats",
  standings: "Standings",
  subtitle: "Fast live scores, results and league tables.",
  team: "Team",
  tbd: "TBD",
  timeline: "Timeline",
  turnOff: "Turn extension off",
  turnOn: "Turn extension on",
  unknownLeague: "Unknown League",
  unknownTeam: "Unknown Team",
  upcoming: "Upcoming",
  venue: "Venue",
  wins: "W",
  roundOf32: "Round of 32",
  roundOf16: "Round of 16",
  quarterfinals: "Quarter-finals",
  semifinals: "Semi-finals",
  thirdPlace: "Third-place match",
  final: "Final",
};

let appShell;
let appTitle;
let subtitle;
let statusBar;
let powerToggle;
let englishToggle;
let loadingState;
let errorState;
let emptyState;
let leaguePickList;
let leagueDetailView;
let leagueDetailContent;
let backBtn;

let hasLoadedOnce = false;
let lastPayload = null;
let lastFetchCompletedAt = 0;
let refreshTimer = null;
let sessionAutoPauseTimer = null;
let inactivityTimer = null;
let sessionStartedAt = Date.now();
let lastInteractionAt = Date.now();
let autoPausedForSession = false;
let inactivePaused = false;
let dailyLimitReached = false;
let consecutiveRefreshErrors = 0;
let selectedLeagueKey = null;
let selectedMatchKey = null;
let selectedMatchSnapshot = null;
let isEnabled = true;
let isEnglishOverride = false;
let contentOverlay = null;
let detailAbortController = null;
let favoriteLeagues = new Set();
const matchDetailCache = new Map();
const leagueStandingsCache = new Map();
const tournamentBracketCache = new Map();
const openTournamentBracketLeagueCodes = new Set();

document.addEventListener("DOMContentLoaded", () => {
  appShell = document.querySelector(".app-shell");
  appTitle = document.getElementById("appTitle");
  subtitle = document.getElementById("subtitle");
  statusBar = document.getElementById("statusBar");
  powerToggle = document.getElementById("powerToggle");
  englishToggle = document.getElementById("englishToggle");
  loadingState = document.getElementById("loadingState");
  errorState = document.getElementById("errorState");
  emptyState = document.getElementById("emptyState");
  leaguePickList = document.getElementById("leaguePickList");
  leagueDetailView = document.getElementById("leagueDetailView");
  leagueDetailContent = document.getElementById("leagueDetailContent");
  backBtn = document.getElementById("backBtn");

  restoreEnglishOverride();
  applyI18n();
  restoreFavorites();
  restoreEnabledState();

  englishToggle.addEventListener("click", toggleEnglishOverride);
  powerToggle.addEventListener("click", togglePower);
  backBtn.addEventListener("click", handleBack);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  installActivityListeners();
  installScrollBoundaryGuard();
  resetSessionAutoPauseTimer();
  resetInactivityTimer();

  if (isEnabled) {
    startLiveDataFlow();
  }
});

function msg(key, substitutions) {
  if (isEnglishOverride) {
    return formatMessage(FALLBACK_MESSAGES[key] || key, substitutions);
  }

  if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
    const result = chrome.i18n.getMessage(key, substitutions);
    return result || formatMessage(FALLBACK_MESSAGES[key] || key, substitutions);
  }
  return formatMessage(FALLBACK_MESSAGES[key] || key, substitutions);
}

function formatMessage(template, substitutions) {
  if (!substitutions) return template;
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return values.reduce(
    (text, value, index) => text.replaceAll("$" + (index + 1), String(value)),
    template,
  );
}

function applyI18n() {
  appTitle.textContent = msg("appTitle");
  subtitle.textContent = msg("subtitle");
  loadingState.textContent = msg("loading");
  errorState.textContent = msg("error");
  emptyState.textContent = msg("empty");
  backBtn.textContent = msg("backToLeagues");
  updateEnglishToggleLabel();
  setStatus(msg("notUpdated"));
}

function toggleEnglishOverride() {
  isEnglishOverride = !isEnglishOverride;
  safeSetStorageItem(STORAGE_KEY_ENGLISH_OVERRIDE, isEnglishOverride ? "1" : "0");
  applyLanguageState();
}

function restoreEnglishOverride() {
  isEnglishOverride = safeGetStorageItem(STORAGE_KEY_ENGLISH_OVERRIDE) === "1";
  updateEnglishToggleLabel();
}

function applyLanguageState() {
  applyI18n();
  applyEnabledState();

  if (lastPayload) {
    renderPayload(lastPayload);
  } else if (!leaguePickList.hidden || !leagueDetailView.hidden) {
    showOnly("empty");
  } else if (!errorState.hidden) {
    showError(isFilePreview() ? msg("extensionRuntimeRequired") : msg("error"));
  }
}

function updateEnglishToggleLabel() {
  if (!englishToggle) return;
  const label = isEnglishOverride ? msg("forceEnglishOff") : msg("forceEnglishOn");
  englishToggle.title = label;
  englishToggle.setAttribute("aria-label", label);
  englishToggle.setAttribute("aria-pressed", String(isEnglishOverride));
  englishToggle.classList.toggle("language-toggle--active", isEnglishOverride);
}

function togglePower() {
  isEnabled = !isEnabled;
  safeSetStorageItem(STORAGE_KEY_ENABLED, isEnabled ? "1" : "0");
  applyEnabledState();

  if (isEnabled) {
    resumeAutomaticRefreshWindow();
    startLiveDataFlow();
  } else {
    clearTimeout(refreshTimer);
    clearTimeout(sessionAutoPauseTimer);
    clearTimeout(inactivityTimer);
    abortDetailRequest();
  }
}

function restoreEnabledState() {
  isEnabled = safeGetStorageItem(STORAGE_KEY_ENABLED) !== "0";
  applyEnabledState();
}

function applyEnabledState() {
  updatePowerToggleLabel();

  if (isEnabled) {
    appShell.classList.remove("app-shell--disabled");
    powerToggle.classList.remove("power-toggle--off");
    removeOverlay();
  } else {
    appShell.classList.add("app-shell--disabled");
    powerToggle.classList.add("power-toggle--off");
    addOverlay();
    setStatus(msg("paused"));
  }
}

function updatePowerToggleLabel() {
  const label = isEnabled ? msg("turnOff") : msg("turnOn");
  powerToggle.title = label;
  powerToggle.setAttribute("aria-label", label);
  powerToggle.setAttribute("aria-pressed", String(isEnabled));
}

function addOverlay() {
  if (contentOverlay) return;
  contentOverlay = document.createElement("div");
  contentOverlay.className = "content-overlay";
  appShell.style.position = "relative";
  appShell.appendChild(contentOverlay);
}

function removeOverlay() {
  if (!contentOverlay) return;
  contentOverlay.remove();
  contentOverlay = null;
}

function startLiveDataFlow() {
  if (isFilePreview()) {
    hasLoadedOnce = true;
    showError(msg("extensionRuntimeRequired"));
    return;
  }

  refreshDailyRequestLimitState();
  const hydrated = hydrateFromClientCache();

  if (dailyLimitReached) {
    setStatus(msg("requestLimitReached"));
    if (!hydrated && !hasLoadedOnce) showError(msg("requestLimitReached"));
    return;
  }

  if (!hydrated) {
    loadMatches();
  }
}

function resumeAutomaticRefreshWindow() {
  sessionStartedAt = Date.now();
  lastInteractionAt = Date.now();
  autoPausedForSession = false;
  inactivePaused = false;
  resetSessionAutoPauseTimer();
  resetInactivityTimer();
}

function installActivityListeners() {
  for (const eventName of ["click", "keydown", "mousemove", "scroll", "touchstart"]) {
    document.addEventListener(eventName, recordActivity, { passive: true });
  }
  leaguePickList.addEventListener("scroll", recordActivity, { passive: true });
  leagueDetailContent.addEventListener("scroll", recordActivity, { passive: true });
}

function installScrollBoundaryGuard() {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  window.addEventListener("scroll", lockDocumentScroll, { passive: true });
  document.addEventListener("wheel", guardScrollBoundary, { passive: false });
}

function lockDocumentScroll() {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
}

function guardScrollBoundary(event) {
  const target = event.target instanceof Element
    ? event.target.closest(".league-pick-list, .league-detail-scroll")
    : null;

  if (!target || target.hidden) {
    event.preventDefault();
    return;
  }

  const deltaY = event.deltaY || 0;
  if (deltaY === 0) return;

  const canScroll = target.scrollHeight > target.clientHeight + 1;
  const atTop = target.scrollTop <= 0;
  const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;

  if (!canScroll || (deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
    event.preventDefault();
  }
}

function recordActivity() {
  lastInteractionAt = Date.now();
  resetInactivityTimer();

  if (!inactivePaused) return;
  inactivePaused = false;
  setStatus(lastFetchCompletedAt ? `${msg("updated")} ${formatClockTime(lastFetchCompletedAt)}` : msg("ready"));
  refreshIfStaleOrSchedule({ minAgeMs: STALE_VISIBLE_REFRESH_MS });
}

function resetSessionAutoPauseTimer() {
  clearTimeout(sessionAutoPauseTimer);
  if (!isEnabled || dailyLimitReached) return;

  const remainingMs = Math.max(0, AUTO_PAUSE_AFTER_MS - (Date.now() - sessionStartedAt));
  sessionAutoPauseTimer = setTimeout(handleSessionAutoPause, remainingMs);
}

function handleSessionAutoPause() {
  if (!isEnabled || document.hidden || dailyLimitReached) return;
  autoPausedForSession = true;
  clearTimeout(refreshTimer);
  setStatus(msg("autoPaused"));
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (!isEnabled || dailyLimitReached) return;
  inactivityTimer = setTimeout(handleInactivityPause, INACTIVITY_PAUSE_AFTER_MS);
}

function handleInactivityPause() {
  if (!isEnabled || document.hidden || dailyLimitReached) return;
  inactivePaused = true;
  clearTimeout(refreshTimer);
  setStatus(msg("idlePaused"));
}

function hydrateFromClientCache() {
  const cached = readClientLiveCache();
  if (!cached || !isClientLiveCacheFresh(cached)) {
    return false;
  }

  lastPayload = cached.payload;
  lastFetchCompletedAt = cached.savedAt;
  hasLoadedOnce = true;
  renderPayload(cached.payload);
  setStatus(`${msg("updated")} ${formatClockTime(lastFetchCompletedAt)}`);
  scheduleNextRefresh(
    cached.payload,
    getRemainingRefreshDelay(cached.payload, cached.savedAt),
  );
  return true;
}

async function loadMatches({ force = false } = {}) {
  clearTimeout(refreshTimer);

  refreshDailyRequestLimitState();
  if (!(force ? canFetchLiveData() : shouldAutoRefresh())) return;

  if (!hasLoadedOnce) {
    showOnly("loading");
  }
  setStatus(hasLoadedOnce ? msg("refreshing") : msg("loading"));

  let didSucceed = false;
  let didHitDailyLimit = false;

  try {
    const payload = await fetchJsonWithTimeout(BACKEND_URL);
    if (!payload || !Array.isArray(payload.matches)) {
      throw new Error("Invalid live match payload");
    }

    lastPayload = payload;
    lastFetchCompletedAt = Date.now();
    consecutiveRefreshErrors = 0;
    writeClientLiveCache(payload, lastFetchCompletedAt);
    renderPayload(payload);
    setStatus(`${msg("updated")} ${formatClockTime(lastFetchCompletedAt)}`);
    hasLoadedOnce = true;
    didSucceed = true;
  } catch (error) {
    if (isDailyRequestLimitError(error)) {
      didHitDailyLimit = true;
      dailyLimitReached = true;
      setStatus(msg("requestLimitReached"));
    } else {
      consecutiveRefreshErrors += 1;
      console.error(error);
      if (hasLoadedOnce || lastPayload) {
        setStatus(msg("refreshFailed"));
      }
    }

    if (!hasLoadedOnce && !lastPayload) {
      showError(
        didHitDailyLimit ? msg("requestLimitReached") : msg("error"),
      );
    }
    hasLoadedOnce = true;
  } finally {
    if (didSucceed) {
      scheduleNextRefresh(lastPayload);
    } else if (!didHitDailyLimit) {
      scheduleErrorRetry();
    }
  }
}

function shouldAutoRefresh() {
  refreshDailyRequestLimitState();
  return (
    canFetchLiveData() &&
    !selectedLeagueKey &&
    !selectedMatchKey &&
    !autoPausedForSession &&
    !inactivePaused
  );
}

function canFetchLiveData() {
  return isEnabled && !document.hidden && !dailyLimitReached;
}

function scheduleNextRefresh(payload, delayMs = getRefreshInterval(payload)) {
  clearTimeout(refreshTimer);

  if (!shouldAutoRefresh()) {
    return;
  }

  const delay = Number.isFinite(delayMs)
    ? Math.max(0, delayMs)
    : getRefreshInterval(payload);
  refreshTimer = setTimeout(loadMatches, delay);
}

function getRefreshInterval(payload) {
  if (hasLiveMatches(payload)) return LIVE_REFRESH_INTERVAL_MS;
  if (hasUpcomingMatches(payload)) return IDLE_REFRESH_INTERVAL_MS;
  return QUIET_REFRESH_INTERVAL_MS;
}

function scheduleErrorRetry() {
  if (!shouldAutoRefresh()) return;
  const index = Math.max(0, Math.min(consecutiveRefreshErrors - 1, ERROR_RETRY_DELAYS_MS.length - 1));
  scheduleNextRefresh(lastPayload, ERROR_RETRY_DELAYS_MS[index]);
}

function getRemainingRefreshDelay(payload, completedAt = lastFetchCompletedAt) {
  if (!completedAt) return 0;
  const elapsed = Math.max(0, Date.now() - completedAt);
  return Math.max(0, getRefreshInterval(payload) - elapsed);
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearTimeout(refreshTimer);
    clearTimeout(inactivityTimer);
    return;
  }

  refreshDailyRequestLimitState();
  if (!isEnabled || dailyLimitReached || selectedLeagueKey || selectedMatchKey) {
    return;
  }

  lastInteractionAt = Date.now();
  inactivePaused = false;
  resetInactivityTimer();

  if (Date.now() - sessionStartedAt >= AUTO_PAUSE_AFTER_MS) {
    handleSessionAutoPause();
    return;
  }

  resetSessionAutoPauseTimer();

  const isStale = Date.now() - lastFetchCompletedAt > STALE_VISIBLE_REFRESH_MS;

  if (!lastPayload || isStale) {
    loadMatches();
  } else {
    scheduleNextRefresh(lastPayload, getRemainingRefreshDelay(lastPayload));
  }
}

function renderPayload(payload) {
  const leagues = normalizeLeagueGroups(payload);

  if (leagues.length === 0) {
    showOnly("empty");
    return;
  }

  if (selectedLeagueKey) {
    const league = leagues.find(
      (item) => getLeagueKey(item) === selectedLeagueKey,
    );

    if (!league) {
      selectedLeagueKey = null;
      selectedMatchKey = null;
      selectedMatchSnapshot = null;
      renderLeaguePickList(leagues);
      return;
    }

    if (selectedMatchKey) {
      const snapshotMatchesSelection =
        selectedMatchSnapshot &&
        getMatchKey(selectedMatchSnapshot) === selectedMatchKey;
      const match =
        league.matches.find((item) => getMatchKey(item) === selectedMatchKey) ||
        (snapshotMatchesSelection ? selectedMatchSnapshot : null);

      if (match) {
        renderMatchDetail(league, match);
        return;
      }
      selectedMatchKey = null;
      selectedMatchSnapshot = null;
    }

    renderLeagueDetail(league);
    return;
  }

  renderLeaguePickList(leagues);
}

function renderLeaguePickList(leagues) {
  leaguePickList.replaceChildren();

  for (const league of leagues) {
    const liveCount = countLiveMatches(league.matches);
    const upcomingCount = countUpcomingMatches(league.matches);
    const leagueKey = getLeagueKey(league);

    const card = document.createElement("article");
    card.className = "league-pick-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", league.name);

    const openLeague = () => {
      selectedLeagueKey = leagueKey;
      selectedMatchKey = null;
      selectedMatchSnapshot = null;
      clearTimeout(refreshTimer);
      if (lastPayload) renderPayload(lastPayload);
    };

    card.addEventListener("click", openLeague);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLeague();
      }
    });

    const logo = createLogoImage("league-pick-logo", getLeagueLogo(league), league.name, {
      tone: league.logoTone,
    });
    const info = document.createElement("div");
    info.className = "league-pick-info";

    const metaText = buildLeagueMetaText(league, liveCount, upcomingCount);

    info.appendChild(createTextElement("span", "league-pick-name", league.name));
    if (metaText) {
      info.appendChild(createTextElement("span", "league-pick-meta", metaText));
    }

    const actions = document.createElement("div");
    actions.className = "league-card-actions";
    actions.appendChild(
      createFavoriteButton({
        active: isFavoriteLeague(leagueKey),
        label: msg("favoriteLeague"),
        onClick: () => toggleFavoriteLeague(leagueKey),
      }),
    );

    if (liveCount > 0) {
      actions.appendChild(
        createTextElement(
          "span",
          "league-pick-badge",
          msg("live").toUpperCase() + " " + liveCount,
        ),
      );
    }

    card.append(logo, info, actions);
    leaguePickList.appendChild(card);
  }

  showOnly("pick");
}

function renderLeagueDetail(league) {
  const scrollTop = leagueDetailContent.scrollTop;
  leagueDetailContent.replaceChildren();

  const header = document.createElement("div");
  header.className = "league-detail-header";

  const logo = createLogoImage("league-detail-logo", getLeagueLogo(league), league.name, {
    tone: league.logoTone,
  });
  const copy = document.createElement("div");
  copy.className = "league-detail-copy";
  const liveCount = countLiveMatches(league.matches);
  const upcomingCount = countUpcomingMatches(league.matches);

  const metaText = buildLeagueMetaText(league, liveCount, upcomingCount);

  copy.appendChild(createTextElement("h2", "league-detail-title", league.name));
  if (metaText) {
    copy.appendChild(createTextElement("p", "league-detail-meta", metaText));
  }

  header.append(
    logo,
    copy,
    createFavoriteButton({
      active: isFavoriteLeague(getLeagueKey(league)),
      label: msg("favoriteLeague"),
      onClick: () => toggleFavoriteLeague(getLeagueKey(league)),
    }),
  );
  leagueDetailContent.appendChild(header);

  const card = document.createElement("article");
  card.className = "league-card";

  const liveMatches = league.matches.filter((match) => match.state === "live");
  const finishedMatches = league.matches.filter((match) => match.state === "finished");
  const upcomingMatches = league.matches.filter((match) => match.state === "scheduled");
  const otherMatches = league.matches.filter(
    (match) => !["live", "finished", "scheduled"].includes(match.state),
  );

  appendMatchSection(card, "● " + msg("live"), liveMatches, league);
  appendMatchSection(card, msg("results"), finishedMatches, league);
  appendMatchSection(card, msg("upcoming"), upcomingMatches, league);
  if (otherMatches.length > 0) appendMatchSection(card, msg("other"), otherMatches, league);
  const bracketSection = createTournamentBracketSection(league);
  if (bracketSection) card.appendChild(bracketSection);
  card.appendChild(createStandingsSection(league));

  leagueDetailContent.appendChild(card);
  leagueDetailContent.scrollTop = scrollTop;
  backBtn.textContent = msg("backToLeagues");
  showOnly("detail");
}

function buildLeagueMetaText(league, liveCount, upcomingCount) {
  const metaParts = [];

  if (upcomingCount > 0) metaParts.push(upcomingCount + " " + msg("upcoming"));
  if (liveCount > 0) metaParts.push(liveCount + " " + msg("live"));

  return metaParts.join(" · ");
}

function appendMatchSection(card, title, matches, league) {
  if (matches.length === 0) return;

  const section = document.createElement("section");
  section.className = "match-section";
  const sectionTitle = createTextElement("h3", "section-title", title);
  const stack = document.createElement("div");
  stack.className = "match-stack";

  for (const match of sortMatchesForDisplay(matches)) {
    stack.appendChild(createMatchCard(match, league));
  }

  section.append(sectionTitle, stack);
  card.appendChild(section);
}

function createMatchCard(match, league) {
  const card = document.createElement("article");
  card.className = "match-card match-card--clickable";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", match.homeTeam + " vs " + match.awayTeam);
  card.addEventListener("click", () => openMatchDetail(league, match));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMatchDetail(league, match);
    }
  });

  const statusText = match.state === "scheduled" ? "" : translateStatus(match.status);
  card.append(
    createTextElement("span", "time-badge", getMatchTimeLabel(match)),
    createTeamsBlock(match),
    createTextElement(
      "span",
      statusText ? "status-pill" : "status-pill status-pill--empty",
      statusText,
    ),
  );

  return card;
}

function createTeamsBlock(match) {
  const teams = document.createElement("div");
  teams.className = "match-teams";
  teams.append(
    createTeamRow({
      name: match.homeTeam,
      score: match.homeScore,
      logo: match.homeLogo,
    }),
    createTeamRow({
      name: match.awayTeam,
      score: match.awayScore,
      logo: match.awayLogo,
    }),
  );
  return teams;
}

function createTeamRow(team) {
  const row = document.createElement("div");
  row.className = "team-row";

  row.append(
    createLogoImage("team-logo", team.logo, team.name),
    createTextElement("span", "team-name", team.name || msg("unknownTeam")),
    createTextElement("span", "team-score", String(Number(team.score) || 0)),
  );
  return row;
}

function openMatchDetail(league, match) {
  selectedLeagueKey = getLeagueKey(league);
  selectedMatchKey = getMatchKey(match);
  selectedMatchSnapshot = { ...match };
  clearTimeout(refreshTimer);
  renderMatchDetail(league, selectedMatchSnapshot);
}

function renderMatchDetail(league, match) {
  leagueDetailContent.replaceChildren();
  backBtn.textContent = "← " + league.name;

  const meta = document.createElement("section");
  meta.className = "detail-meta-grid";
  appendMetaItem(meta, msg("kickoff"), formatDateTime(match.kickoff));
  appendMetaItem(meta, msg("venue"), match.venue || "-");
  appendMetaItem(meta, msg("matchDetails"), translateStatus(match.status));
  leagueDetailContent.appendChild(meta);

  const header = document.createElement("article");
  header.className = "match-detail-hero";
  header.append(
    createDetailTeam(match.homeLogo, match.homeTeam, match.homeScore),
    createScoreBlock(match),
    createDetailTeam(match.awayLogo, match.awayTeam, match.awayScore),
  );
  leagueDetailContent.appendChild(header);

  const key = getDetailCacheKey(match);
  let cacheEntry = matchDetailCache.get(key);
  if (isExpiredLazyError(cacheEntry)) {
    matchDetailCache.delete(key);
    cacheEntry = null;
  }

  if (!match.leagueCode) {
    leagueDetailContent.appendChild(createStatePanel(msg("detailsUnavailable")));
  } else if (!cacheEntry) {
    matchDetailCache.set(key, { status: "loading" });
    leagueDetailContent.appendChild(createStatePanel(msg("loadingDetails")));
    loadMatchDetail(match);
  } else if (cacheEntry.status === "loading") {
    leagueDetailContent.appendChild(createStatePanel(msg("loadingDetails")));
  } else if (cacheEntry.status === "error") {
    leagueDetailContent.appendChild(createStatePanel(msg("detailsUnavailable"), true));
  } else {
    renderLoadedMatchDetail(cacheEntry.data);
  }

  showOnly("detail");
}

function createDetailTeam(logoUrl, name, score) {
  const team = document.createElement("div");
  team.className = "detail-team";
  team.append(
    createLogoImage("detail-team-logo", logoUrl, name),
    createTextElement("strong", "detail-team-name", name || msg("team")),
    createTextElement("span", "detail-team-score", String(Number(score) || 0)),
  );
  return team;
}

function createScoreBlock(match) {
  const block = document.createElement("div");
  block.className = "detail-score-block";
  block.append(
    createTextElement("span", "detail-score", `${Number(match.homeScore) || 0} - ${Number(match.awayScore) || 0}`),
    createTextElement("span", "detail-minute", getMatchTimeLabel(match)),
  );
  return block;
}

async function loadMatchDetail(match) {
  abortDetailRequest();
  const controller = new AbortController();
  detailAbortController = controller;
  const key = getDetailCacheKey(match);
  let shouldRender = true;

  try {
    const data = await fetchJsonWithTimeout(buildMatchDetailUrl(match), {
      signal: controller.signal,
    });
    matchDetailCache.set(key, { status: "loaded", data });
  } catch (error) {
    if (error.name === "AbortError") {
      matchDetailCache.delete(key);
      shouldRender = false;
    } else {
      if (isDailyRequestLimitError(error)) {
        dailyLimitReached = true;
        setStatus(msg("requestLimitReached"));
      }
      console.error(error);
      matchDetailCache.set(key, { status: "error", failedAt: Date.now() });
    }
  } finally {
    if (detailAbortController === controller) {
      detailAbortController = null;
    }
    if (shouldRender && lastPayload && selectedMatchKey === getMatchKey(match)) {
      renderPayload(lastPayload);
    }
  }
}

function renderLoadedMatchDetail(detail) {
  if (Array.isArray(detail.broadcasts) && detail.broadcasts.length > 0) {
    const meta = document.createElement("section");
    meta.className = "detail-meta-grid detail-meta-grid--secondary detail-meta-grid--single";
    appendMetaItem(meta, msg("broadcasts"), formatList(detail.broadcasts));
    leagueDetailContent.appendChild(meta);
  }

  appendStatsSection(detail.stats);
  appendDetailListSection(msg("timeline"), detail.timeline, createTimelineItem, msg("noSectionData"), true);
  appendLineupsSection(detail.lineups);
  appendDetailListSection(msg("commentary"), detail.commentary, createCommentaryItem, msg("noSectionData"), true);
  appendDetailListSection(msg("headToHead"), detail.headToHead, createHeadToHeadItem);
  appendLinkSection(msg("news"), detail.news, msg("noNews"), true);
  appendVideoSection(detail.videos);
  appendLinkSection(msg("links"), detail.links, msg("noLinks"), true);

}

function appendDetailListSection(title, rows, renderer, emptyText = "", alwaysRender = false) {
  const items = Array.isArray(rows) ? rows : [];
  if (!alwaysRender && items.length === 0) return;
  const section = createDetailSection(title, items.length);
  const list = document.createElement("div");
  list.className = "detail-list";

  for (const row of items) {
    list.appendChild(renderer(row));
  }

  section.appendChild(
    list.childElementCount > 0
      ? list
      : createTextElement("p", "detail-empty", emptyText || msg("noSectionData")),
  );
  leagueDetailContent.appendChild(section);
}

function appendLineupsSection(lineups) {
  const rows = Array.isArray(lineups) ? lineups : [];
  const section = createDetailSection(msg("lineups"), rows.length);
  const grid = document.createElement("div");
  grid.className = "lineup-grid";

  for (const lineup of rows) {
    const column = document.createElement("div");
    column.className = "lineup-team";
    const title = document.createElement("div");
    title.className = "lineup-title";
    title.append(
      createLogoImage("lineup-logo", lineup.logo, lineup.team),
      createTextElement("strong", "", lineup.team),
    );
    const players = document.createElement("div");
    players.className = "lineup-players";
    for (const player of lineup.players || []) {
      players.appendChild(
        createTextElement(
          "span",
          player.starter ? "lineup-player lineup-player--starter" : "lineup-player",
          [player.jersey, player.name, player.position].filter(Boolean).join(" · "),
        ),
      );
    }
    column.append(title, players);
    grid.appendChild(column);
  }

  section.appendChild(
    grid.childElementCount > 0
      ? grid
      : createTextElement("p", "detail-empty", msg("noSectionData")),
  );
  leagueDetailContent.appendChild(section);
}

function appendStatsSection(stats) {
  const rows = Array.isArray(stats) ? stats : [];
  const section = createDetailSection(msg("stats"), rows.length);
  const list = document.createElement("div");
  list.className = "stats-list";

  for (const stat of rows) {
    list.appendChild(createStatItem(stat));
  }

  section.appendChild(
    list.childElementCount > 0
      ? list
      : createTextElement("p", "detail-empty", msg("noStats")),
  );
  leagueDetailContent.appendChild(section);
}

function appendLinkSection(title, rows, emptyText = "", alwaysRender = false) {
  const section = createDetailSection(title, Array.isArray(rows) ? rows.length : 0);
  const list = document.createElement("div");
  list.className = "link-list";
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.url) list.appendChild(createExternalLink(row.title || row.label, row.url));
  }
  if (list.childElementCount > 0) {
    section.appendChild(list);
    leagueDetailContent.appendChild(section);
    return;
  }

  if (emptyText) {
    section.appendChild(createTextElement("p", "detail-empty", emptyText));
    leagueDetailContent.appendChild(section);
  } else if (alwaysRender) {
    section.appendChild(createTextElement("p", "detail-empty", msg("noSectionData")));
    leagueDetailContent.appendChild(section);
  }
}

function appendVideoSection(videos) {
  if (!Array.isArray(videos) || videos.length === 0) return;
  const section = createDetailSection(msg("highlights"), videos.length);
  const list = document.createElement("div");
  list.className = "video-list";

  for (const video of videos) {
    const safeUrl = sanitizeExternalUrl(video.url, ["espn.com"]);
    const card = document.createElement(safeUrl ? "a" : "div");
    card.className = "video-card";
    if (safeUrl) {
      card.href = safeUrl;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
    if (video.thumbnail) {
      card.appendChild(createLogoImage("video-thumb", video.thumbnail, video.title));
    }
    card.appendChild(createTextElement("span", "", video.title));
    list.appendChild(card);
  }

  section.appendChild(list);
  leagueDetailContent.appendChild(section);
}

function createTimelineItem(item) {
  const row = document.createElement("div");
  row.className = "timeline-item";
  row.append(
    createTextElement("span", "timeline-minute", item.minute || "-"),
    createTextElement("strong", "timeline-type", item.type || item.team || msg("matchDetails")),
    createTextElement("span", "timeline-text", [item.text, formatList(item.players)].filter(Boolean).join(" · ")),
  );
  return row;
}

function createCommentaryItem(item) {
  const row = document.createElement("div");
  row.className = "commentary-item";
  row.append(
    createTextElement("span", "timeline-minute", item.minute || "-"),
    createTextElement("span", "timeline-text", item.text),
  );
  return row;
}

function createHeadToHeadItem(item) {
  const row = document.createElement("div");
  row.className = "h2h-item";
  row.append(
    createTextElement("span", "h2h-date", formatShortDate(item.date)),
    createTextElement("span", "h2h-match", `${item.homeTeam} ${item.homeScore} - ${item.awayScore} ${item.awayTeam}`),
  );
  return row;
}

function createStatItem(stat) {
  const row = document.createElement("div");
  row.className = "stat-item";
  row.append(
    createTextElement("strong", "stat-value stat-value--home", stat.homeValue || "-"),
    createTextElement("span", "stat-label", stat.label || msg("stats")),
    createTextElement("strong", "stat-value stat-value--away", stat.awayValue || "-"),
  );
  return row;
}

function createDetailSection(title) {
  const section = document.createElement("details");
  section.className = "detail-section detail-section--accordion";

  const summary = document.createElement("summary");
  summary.className = "detail-section-summary";
  summary.appendChild(createTextElement("span", "detail-section-title", title));

  section.appendChild(summary);
  return section;
}

function createStatePanel(text, isError = false) {
  const panel = createTextElement("section", "state-card detail-state", text);
  if (isError) panel.classList.add("state-card--error");
  return panel;
}

function createTournamentBracketSection(league) {
  if (league.code !== FIFA_WORLD_CUP_LEAGUE_CODE) {
    return null;
  }

  const leagueCode = league.code;
  const section = document.createElement("details");
  section.className = "tournament-bracket detail-section detail-section--accordion";
  section.open = openTournamentBracketLeagueCodes.has(leagueCode);

  const summary = document.createElement("summary");
  summary.className = "detail-section-summary";
  summary.appendChild(
    createTextElement("span", "detail-section-title", msg("bracket")),
  );

  section.appendChild(summary);
  const body = document.createElement("div");
  body.className = "tournament-bracket-body";
  body.dataset.leagueCode = leagueCode;
  section.appendChild(body);

  section.addEventListener("toggle", () => {
    if (section.open) {
      openTournamentBracketLeagueCodes.add(leagueCode);
      renderTournamentBracketBody(body, league);
    } else {
      openTournamentBracketLeagueCodes.delete(leagueCode);
    }
  });

  if (section.open) {
    renderTournamentBracketBody(body, league);
  }

  return section;
}

function renderTournamentBracketBody(container, league) {
  container.replaceChildren();
  const leagueCode = league.code;
  let cached = tournamentBracketCache.get(leagueCode);

  if (isExpiredLazyError(cached)) {
    tournamentBracketCache.delete(leagueCode);
    cached = null;
  }

  if (!cached) {
    tournamentBracketCache.set(leagueCode, { status: "loading" });
    container.appendChild(
      createTextElement("p", "bracket-message", msg("loadingBracket")),
    );
    loadTournamentBracket(leagueCode);
    return;
  }

  if (cached.status === "loading") {
    container.appendChild(
      createTextElement("p", "bracket-message", msg("loadingBracket")),
    );
    return;
  }

  if (cached.status === "error") {
    container.appendChild(
      createTextElement("p", "bracket-message bracket-message--error", msg("bracketUnavailable")),
    );
    return;
  }

  const rounds = Array.isArray(cached.rounds) ? cached.rounds : [];

  if (rounds.length === 0) {
    container.appendChild(createTextElement("p", "bracket-message", msg("noBracket")));
    return;
  }

  const roundsWrap = document.createElement("div");
  roundsWrap.className = "bracket-rounds";

  for (const round of rounds) {
    roundsWrap.appendChild(createBracketRound(round, league));
  }

  container.appendChild(roundsWrap);
}

function createBracketRound(round, league) {
  const wrapper = document.createElement("section");
  wrapper.className = "bracket-round";
  wrapper.appendChild(
    createTextElement(
      "h4",
      "bracket-round-title",
      getTournamentRoundLabel(round.slug, round.name),
    ),
  );

  const list = document.createElement("div");
  list.className = "bracket-match-list";

  for (const match of Array.isArray(round.matches) ? round.matches : []) {
    list.appendChild(createBracketMatchCard(match, league));
  }

  wrapper.appendChild(list);
  return wrapper;
}

function createBracketMatchCard(match, league) {
  const card = document.createElement("article");
  card.className = "bracket-match-card";

  if (match.id && match.leagueCode) {
    card.classList.add("bracket-match-card--clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", match.homeTeam + " vs " + match.awayTeam);
    const openDetail = () => openMatchDetail(league, normalizeBracketMatchForDetail(match));
    card.addEventListener("click", openDetail);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail();
      }
    });
  }

  const meta = document.createElement("div");
  meta.className = "bracket-match-meta";
  meta.append(
    createTextElement("span", "bracket-match-date", formatDateTime(match.kickoff)),
    createTextElement("span", "bracket-match-status", translateStatus(match.status)),
  );

  const teams = document.createElement("div");
  teams.className = "bracket-teams";
  teams.append(
    createBracketTeamRow(match.homeTeam, match.homeLogo, getBracketScore(match, "home")),
    createBracketTeamRow(match.awayTeam, match.awayLogo, getBracketScore(match, "away")),
  );

  card.append(meta, teams);
  return card;
}

function createBracketTeamRow(name, logo, score) {
  const row = document.createElement("div");
  row.className = "bracket-team-row";
  row.append(
    createLogoImage("bracket-team-logo", logo, name),
    createTextElement("span", "bracket-team-name", name || msg("tbd")),
    createTextElement("strong", "bracket-team-score", score),
  );
  return row;
}

function normalizeBracketMatchForDetail(match) {
  return {
    ...match,
    minute: match.minute || "-",
    status: match.status || "",
    state: match.state || "scheduled",
    venue: match.venue || "",
  };
}

function getBracketScore(match, side) {
  if (match.state === "scheduled") {
    return "-";
  }

  return String(Number(side === "home" ? match.homeScore : match.awayScore) || 0);
}

function getTournamentRoundLabel(slug, fallbackName) {
  const labels = {
    "round-of-32": msg("roundOf32"),
    "round-of-16": msg("roundOf16"),
    quarterfinals: msg("quarterfinals"),
    semifinals: msg("semifinals"),
    "3rd-place-match": msg("thirdPlace"),
    final: msg("final"),
  };

  return labels[slug] || fallbackName || msg("bracket");
}

async function loadTournamentBracket(leagueCode) {
  try {
    const data = await fetchJsonWithTimeout(buildTournamentBracketUrl(leagueCode));
    tournamentBracketCache.set(leagueCode, {
      status: "loaded",
      rounds: Array.isArray(data.rounds) ? data.rounds : [],
    });
  } catch (error) {
    if (isDailyRequestLimitError(error)) {
      dailyLimitReached = true;
      setStatus(msg("requestLimitReached"));
    }
    console.error(error);
    tournamentBracketCache.set(leagueCode, { status: "error", failedAt: Date.now() });
  } finally {
    updateVisibleTournamentBracket(leagueCode);
  }
}

function updateVisibleTournamentBracket(leagueCode) {
  if (!lastPayload || !selectedLeagueKey || selectedMatchKey || !leagueDetailContent) return;

  const body = leagueDetailContent.querySelector(".tournament-bracket-body");
  if (!body || body.dataset.leagueCode !== leagueCode) {
    renderPayload(lastPayload);
    return;
  }

  const league = normalizeLeagueGroups(lastPayload).find(
    (item) => getLeagueKey(item) === selectedLeagueKey,
  );

  if (league) {
    renderTournamentBracketBody(body, league);
  } else {
    renderPayload(lastPayload);
  }
}

function appendMetaItem(parent, label, value) {
  const item = document.createElement("div");
  item.className = "detail-meta-item";
  item.append(
    createTextElement("span", "detail-meta-label", label),
    createTextElement("strong", "detail-meta-value", value || "-"),
  );
  parent.appendChild(item);
}

function createStandingsSection(league) {
  const wrapper = document.createElement("section");
  wrapper.className = "standings";
  wrapper.appendChild(createTextElement("h3", "standings-title", msg("standings")));

  if (!league.code) {
    wrapper.appendChild(createTextElement("p", "standings-message", msg("noStandings")));
    return wrapper;
  }

  const cached = leagueStandingsCache.get(league.code);

  if (isExpiredLazyError(cached)) {
    leagueStandingsCache.delete(league.code);
  }

  const activeCached = leagueStandingsCache.get(league.code);

  if (!activeCached) {
    leagueStandingsCache.set(league.code, { status: "loading" });
    wrapper.appendChild(createTextElement("p", "standings-message", msg("loadingStandings")));
    loadLeagueStandings(league.code);
    return wrapper;
  }

  if (activeCached.status === "loading") {
    wrapper.appendChild(createTextElement("p", "standings-message", msg("loadingStandings")));
    return wrapper;
  }

  if (activeCached.status === "error") {
    wrapper.appendChild(
      createTextElement("p", "standings-message standings-message--error", msg("detailsUnavailable")),
    );
    return wrapper;
  }

  const standings = Array.isArray(activeCached.standings) ? activeCached.standings : [];

  if (standings.length === 0) {
    wrapper.appendChild(createTextElement("p", "standings-message", msg("noStandings")));
    return wrapper;
  }

  const table = document.createElement("table");
  table.className = "standings-table";
  table.append(createStandingsHead(), createStandingsBody(standings));

  const tableWrap = document.createElement("div");
  tableWrap.className = "standings-table-wrap";
  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);

  return wrapper;
}

async function loadLeagueStandings(leagueCode) {
  try {
    const data = await fetchJsonWithTimeout(buildLeagueStandingsUrl(leagueCode));
    leagueStandingsCache.set(leagueCode, {
      status: "loaded",
      standings: Array.isArray(data.standings) ? data.standings : [],
    });
  } catch (error) {
    if (isDailyRequestLimitError(error)) {
      dailyLimitReached = true;
      setStatus(msg("requestLimitReached"));
    }
    console.error(error);
    leagueStandingsCache.set(leagueCode, { status: "error", failedAt: Date.now() });
  } finally {
    if (lastPayload && selectedLeagueKey && !selectedMatchKey) {
      renderPayload(lastPayload);
    }
  }
}

function createStandingsHead() {
  const head = document.createElement("thead");
  const row = document.createElement("tr");

  for (const label of [
    "#",
    msg("club"),
    msg("played"),
    msg("wins"),
    msg("draws"),
    msg("losses"),
    msg("goalsFor"),
    msg("goalsAgainst"),
    msg("goalDifference"),
    msg("points"),
  ]) {
    row.appendChild(createTextElement("th", "", label));
  }

  head.appendChild(row);
  return head;
}

function createStandingsBody(standings) {
  const body = document.createElement("tbody");
  const groups = new Set(standings.map((team) => team.group).filter(Boolean));
  const shouldShowGroups = groups.size > 1;
  let currentGroup = "";

  for (const team of standings) {
    if (shouldShowGroups && team.group && team.group !== currentGroup) {
      currentGroup = team.group;
      const groupRow = document.createElement("tr");
      const groupCell = createTextElement("td", "standings-group-cell", currentGroup);
      groupCell.colSpan = 10;
      groupRow.className = "standings-group-row";
      groupRow.appendChild(groupCell);
      body.appendChild(groupRow);
    }

    const row = document.createElement("tr");
    row.append(
      createTextElement("td", "", String(team.position)),
      createStandingTeamCell(team),
      createTextElement("td", "", String(team.played)),
      createTextElement("td", "", String(team.wins)),
      createTextElement("td", "", String(team.draws)),
      createTextElement("td", "", String(team.losses)),
      createTextElement("td", "", String(team.goalsFor)),
      createTextElement("td", "", String(team.goalsAgainst)),
      createTextElement("td", "", team.goalDifference),
      createTextElement("td", "", String(team.points)),
    );
    body.appendChild(row);
  }

  return body;
}

function createStandingTeamCell(team) {
  const cell = document.createElement("td");
  const content = document.createElement("span");
  content.className = "standings-team";
  content.append(
    createLogoImage("standings-team-logo", team.logo, team.team),
    createTextElement("span", "standings-team-name", team.team),
  );
  cell.appendChild(content);
  return cell;
}

function handleBack() {
  if (selectedMatchKey) {
    selectedMatchKey = null;
    selectedMatchSnapshot = null;
    if (lastPayload) renderPayload(lastPayload);
    refreshIfStaleOrSchedule();
    return;
  }

  selectedLeagueKey = null;
  selectedMatchSnapshot = null;
  if (lastPayload) renderPayload(lastPayload);
  refreshIfStaleOrSchedule({ minAgeMs: DETAIL_RETURN_REFRESH_MIN_INTERVAL_MS });
}

function refreshIfStaleOrSchedule({ minAgeMs = STALE_VISIBLE_REFRESH_MS } = {}) {
  if (!shouldAutoRefresh()) {
    return;
  }

  if (!lastPayload || Date.now() - lastFetchCompletedAt > minAgeMs) {
    loadMatches();
  } else {
    scheduleNextRefresh(lastPayload, getRemainingRefreshDelay(lastPayload));
  }
}

function restoreFavorites() {
  favoriteLeagues = readSet(STORAGE_KEY_FAVORITE_LEAGUES);
  safeRemoveStorageItem(LEGACY_STORAGE_KEY_FAVORITE_TEAMS);
}

function readClientLiveCache() {
  const cached = safeReadStorageJson(STORAGE_KEY_LIVE_CACHE, null);
  if (!cached || cached.version !== CLIENT_LIVE_CACHE_VERSION) return null;
  if (!cached.payload || !Array.isArray(cached.payload.matches)) return null;
  if (!hasRequiredClientCacheLeagues(cached.payload)) return null;
  if (!Number.isFinite(cached.savedAt)) return null;
  return cached;
}

function hasRequiredClientCacheLeagues(payload) {
  const leagueCodes = new Set(
    (payload.leagues || [])
      .map((league) => league?.code)
      .filter(Boolean),
  );

  return REQUIRED_CLIENT_CACHE_LEAGUE_CODES.every((code) => leagueCodes.has(code));
}

function writeClientLiveCache(payload, savedAt) {
  safeWriteStorageJson(STORAGE_KEY_LIVE_CACHE, {
    payload,
    savedAt,
    version: CLIENT_LIVE_CACHE_VERSION,
  });
}

function isClientLiveCacheFresh(cached) {
  return Date.now() - cached.savedAt <= getClientLiveCacheMaxAge(cached.payload);
}

function getClientLiveCacheMaxAge(payload) {
  if (hasLiveMatches(payload)) return CLIENT_LIVE_CACHE_MAX_AGE_LIVE_MS;
  if (hasUpcomingMatches(payload)) return CLIENT_LIVE_CACHE_MAX_AGE_IDLE_MS;
  return CLIENT_LIVE_CACHE_MAX_AGE_QUIET_MS;
}

function readSet(key) {
  const value = safeReadStorageJson(key, []);
  return new Set(Array.isArray(value) ? value : []);
}

function writeSet(key, values) {
  safeWriteStorageJson(key, [...values]);
}

function toggleFavoriteLeague(leagueKey) {
  if (favoriteLeagues.has(leagueKey)) favoriteLeagues.delete(leagueKey);
  else favoriteLeagues.add(leagueKey);
  writeSet(STORAGE_KEY_FAVORITE_LEAGUES, favoriteLeagues);
  if (lastPayload) renderPayload(lastPayload);
}

function createFavoriteButton({ active, label, onClick }) {
  const button = document.createElement("button");
  button.className = "favorite-btn";
  if (active) button.classList.add("favorite-btn--active");
  button.type = "button";
  button.title = active ? msg("removeFavorite") : label || msg("favorite");
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(active));
  button.textContent = active ? "★" : "☆";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function normalizeLeagueGroups(payload) {
  const leagues = Array.isArray(payload.leagues) && payload.leagues.length > 0
    ? payload.leagues.filter((league) => Array.isArray(league.matches))
    : buildLeagueGroupsFromMatches(payload.matches || []);

  return leagues
    .map((league) => ({
      ...league,
      matches: sortMatchesForDisplay((league.matches || []).filter(isVisibleMatch)),
    }))
    .filter((league) => league.matches.length > 0 || league.code || league.id)
    .sort(compareLeagues);
}

function buildLeagueGroupsFromMatches(matches) {
  const groups = new Map();

  for (const match of matches) {
    if (!isVisibleMatch(match)) continue;

    const key = match.leagueId || match.leagueCode || match.league || "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        code: match.leagueCode || null,
        name: match.league || msg("unknownLeague"),
        logo: null,
        logoTone: match.leagueLogoTone || "dark",
        matches: [],
      });
    }
    groups.get(key).matches.push(match);
  }

  return [...groups.values()];
}

function getLeagueLogo(league) {
  return LOCAL_LEAGUE_LOGOS[league?.code] || league?.logo || FALLBACK_LOGO;
}

function compareLeagues(a, b) {
  const favoriteDiff = Number(isFavoriteLeague(getLeagueKey(b))) - Number(isFavoriteLeague(getLeagueKey(a)));
  if (favoriteDiff !== 0) return favoriteDiff;

  const liveDiff = countLiveMatches(b.matches) - countLiveMatches(a.matches);
  return liveDiff !== 0 ? liveDiff : a.name.localeCompare(b.name);
}

function sortMatchesForDisplay(matches) {
  return [...matches].sort(compareMatches);
}

function compareMatches(a, b) {
  const stateDiff = getMatchStateRank(a.state) - getMatchStateRank(b.state);
  if (stateDiff !== 0) return stateDiff;

  return (a.homeTeam || "").localeCompare(b.homeTeam || "");
}

function countLiveMatches(matches) {
  return matches.filter((match) => match.state === "live").length;
}

function hasLiveMatches(payload) {
  return Boolean(
    payload &&
      Array.isArray(payload.matches) &&
      payload.matches.some((match) => match.state === "live"),
  );
}

function hasUpcomingMatches(payload) {
  return Boolean(
    payload &&
      Array.isArray(payload.matches) &&
      payload.matches.some((match) => isUpcomingWithinWindow(match)),
  );
}

function countUpcomingMatches(matches) {
  return matches.filter(isUpcomingWithinWindow).length;
}

function isVisibleMatch(match) {
  if (!match) return false;
  if (match.state !== "scheduled") return true;
  return isUpcomingWithinWindow(match);
}

function isUpcomingWithinWindow(match) {
  if (!match || match.state !== "scheduled") return false;
  const kickoffTime = Date.parse(match.kickoff || "");
  if (!Number.isFinite(kickoffTime)) return false;
  const now = Date.now();
  return (
    kickoffTime >= now - 60 * 60 * 1000 &&
    kickoffTime <= now + UPCOMING_MATCH_WINDOW_MS
  );
}

function getMatchStateRank(state) {
  if (state === "live") return 0;
  if (state === "finished") return 1;
  if (state === "scheduled") return 2;
  return 3;
}

function isFavoriteLeague(leagueKey) {
  return favoriteLeagues.has(leagueKey);
}

function getLeagueKey(league) {
  return String(league.id || league.code || league.name || "unknown");
}

function getMatchKey(match) {
  return String(match.id || `${match.leagueCode}:${match.homeTeam}:${match.awayTeam}`);
}

function getDetailCacheKey(match) {
  return `${match.leagueCode || "unknown"}:${getMatchKey(match)}`;
}

function buildMatchDetailUrl(match) {
  const url = new URL(BACKEND_URL);
  url.pathname = "/match-detail";
  url.searchParams.set("eventId", match.id);
  url.searchParams.set("leagueCode", match.leagueCode);
  return url.href;
}

function buildLeagueStandingsUrl(leagueCode) {
  const url = new URL(BACKEND_URL);
  url.pathname = "/league-standings";
  url.searchParams.set("leagueCode", leagueCode);
  return url.href;
}

function buildTournamentBracketUrl(leagueCode) {
  const url = new URL(BACKEND_URL);
  url.pathname = "/tournament-bracket";
  url.searchParams.set("leagueCode", leagueCode);
  return url.href;
}

function refreshDailyRequestLimitState() {
  const bucket = readDailyRequestBucket();
  dailyLimitReached = bucket.successful >= DAILY_REQUEST_LIMIT;
  return dailyLimitReached;
}

function tryStartDailyRequest() {
  const bucket = readDailyRequestBucket();
  if (bucket.successful >= DAILY_REQUEST_LIMIT) {
    dailyLimitReached = true;
    return false;
  }

  bucket.attempted += 1;
  writeDailyRequestBucket(bucket);
  dailyLimitReached = false;
  return true;
}

function recordDailyRequestSuccess() {
  const bucket = readDailyRequestBucket();
  bucket.successful += 1;
  writeDailyRequestBucket(bucket);
  dailyLimitReached = bucket.successful >= DAILY_REQUEST_LIMIT;
}

function readDailyRequestBucket() {
  const today = getUtcDateKey();
  const bucket = safeReadStorageJson(STORAGE_KEY_DAILY_REQUEST_BUCKET, null);
  if (!bucket || bucket.date !== today) {
    return { date: today, attempted: 0, successful: 0 };
  }

  const legacyCount = Number.isFinite(bucket.count)
    ? Math.max(0, Math.floor(bucket.count))
    : 0;
  const attempted = Number.isFinite(bucket.attempted)
    ? Math.max(0, Math.floor(bucket.attempted))
    : legacyCount;
  const successful = Number.isFinite(bucket.successful)
    ? Math.max(0, Math.floor(bucket.successful))
    : legacyCount;

  return { date: today, attempted, successful };
}

function writeDailyRequestBucket(bucket) {
  safeWriteStorageJson(STORAGE_KEY_DAILY_REQUEST_BUCKET, bucket);
}

function safeGetStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Could not read local storage", error);
    return null;
  }
}

function safeSetStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("Could not write local storage", error);
    return false;
  }
}

function safeRemoveStorageItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn("Could not remove local storage item", error);
    return false;
  }
}

function safeReadStorageJson(key, fallbackValue) {
  try {
    const rawValue = safeGetStorageItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.warn("Could not parse local storage JSON", error);
    return fallbackValue;
  }
}

function safeWriteStorageJson(key, value) {
  try {
    return safeSetStorageItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Could not serialize local storage JSON", error);
    return false;
  }
}

function isExpiredLazyError(entry) {
  return Boolean(
    entry &&
      entry.status === "error" &&
      Number.isFinite(entry.failedAt) &&
      Date.now() - entry.failedAt >= LAZY_ERROR_RETRY_MS,
  );
}

function getUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDailyRequestLimitError() {
  const error = new Error("Daily request limit reached");
  error.code = "DAILY_REQUEST_LIMIT";
  return error;
}

function isDailyRequestLimitError(error) {
  return Boolean(error && error.code === "DAILY_REQUEST_LIMIT");
}

function isFilePreview() {
  return window.location.protocol === "file:";
}

function createAbortError() {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}

async function fetchJsonWithTimeout(url, options = {}) {
  const { headers = {}, signal: externalSignal, ...rest } = options;
  if (externalSignal && externalSignal.aborted) {
    throw createAbortError();
  }

  if (!tryStartDailyRequest()) {
    throw createDailyRequestLimitError();
  }

  const controller = new AbortController();
  let timedOut = false;
  let removeAbortListener = () => {};

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const handleAbort = () => controller.abort();
      externalSignal.addEventListener("abort", handleAbort, { once: true });
      removeAbortListener = () =>
        externalSignal.removeEventListener("abort", handleAbort);
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Backend returned " + response.status);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("json")) {
      throw new Error("Invalid response content type");
    }

    const data = await response.json();
    recordDailyRequestSuccess();
    return data;
  } catch (error) {
    if (timedOut && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    removeAbortListener();
  }
}

function getMatchTimeLabel(match) {
  if (match?.state === "scheduled") {
    return formatUpcomingKickoff(match.kickoff);
  }

  return translateMinute(match?.minute);
}

function formatUpcomingKickoff(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function translateMinute(minute) {
  if (minute === "Scheduled") return msg("scheduled");
  return minute || "-";
}

function translateStatus(status) {
  const map = {
    "Full Time": msg("fullTime"),
    "Half Time": msg("halfTime"),
    Scheduled: msg("scheduled"),
    Live: msg("live"),
  };
  return map[status] || status || "";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatClockTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatList(values) {
  return Array.isArray(values) ? values.filter(Boolean).join(", ") : "";
}

function hasAnyDetail(detail) {
  return [
    detail.stats,
    detail.timeline,
    detail.commentary,
    detail.lineups,
    detail.headToHead,
    detail.news,
    detail.videos,
    detail.links,
  ].some((value) => Array.isArray(value) && value.length > 0);
}

function createLogoImage(className, src, alt, options = {}) {
  if (className === "league-pick-logo" || className === "league-detail-logo") {
    const wrapper = document.createElement("span");
    wrapper.className = className;
    if (options.tone === "light") {
      wrapper.classList.add("league-logo--light");
    }
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute("aria-label", alt || "");

    const img = document.createElement("img");
    img.className = "league-logo-image";
    img.alt = "";
    img.src = src || FALLBACK_LOGO;
    img.onerror = function () {
      this.src = FALLBACK_LOGO;
      this.onerror = null;
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  const img = document.createElement("img");
  img.className = className;
  img.alt = alt || "";
  img.src = src || FALLBACK_LOGO;
  img.onerror = function () {
    this.src = FALLBACK_LOGO;
    this.onerror = null;
  };
  return img;
}

function createExternalLink(text, href) {
  const safeHref = sanitizeExternalUrl(href, ["espn.com"]);
  if (!safeHref) {
    return createTextElement("span", "detail-link detail-link--disabled", text || msg("links"));
  }

  const link = document.createElement("a");
  link.className = "detail-link";
  link.href = safeHref;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text || safeHref;
  return link;
}

function sanitizeExternalUrl(value, allowedHostSuffixes) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isAllowedHost = allowedHostSuffixes.some(
      (suffix) => host === suffix || host.endsWith("." + suffix),
    );
    if (url.protocol !== "https:" || !isAllowedHost) return "";
    return url.href;
  } catch (error) {
    return "";
  }
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setStatus(text) {
  if (statusBar) {
    statusBar.textContent = text || "";
  }
}

function abortDetailRequest() {
  if (detailAbortController) {
    detailAbortController.abort();
    detailAbortController = null;
  }
}

function showError(message = msg("error")) {
  errorState.textContent = message;
  showOnly("error");
}

function showOnly(state) {
  loadingState.hidden = state !== "loading";
  errorState.hidden = state !== "error";
  emptyState.hidden = state !== "empty";
  leaguePickList.hidden = state !== "pick";
  leagueDetailView.hidden = state !== "detail";
}
