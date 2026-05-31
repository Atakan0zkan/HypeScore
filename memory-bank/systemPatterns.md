# System Patterns

## Architecture

```text
ESPN Scoreboard ─┐
                 ├─► Cloudflare Worker ──► Chrome MV3 Popup
TheSportsDB ─────┘          │                       │
fallback only               │                       ├─ league pick list
                            ├─ normalize matches    ├─ local league logo map
                            ├─ curated filtering    ├─ league detail view
                            ├─ group by league      ├─ lazy standings view
                            ├─ lazy standings       ├─ lazy match detail view
                            ├─ local league logos   ├─ favorites in localStorage
                            ├─ lazy match summary   ├─ live payload cache in localStorage
                            └─ Cache API            ├─ power toggle
                                                   ├─ ENG language override
                                                   └─ adaptive guarded setTimeout refresh
```

## Backend Endpoint Pattern
- `/live-matches`: hot path. Fetches ESPN scoreboard, normalizes curated matches, groups by league, returns no standings.
- `/league-standings?leagueCode=...`: lazy path. Validates `leagueCode`, fetches ESPN standings, normalizes all available table rows, caches separately.
- `/match-detail?eventId=...&leagueCode=...`: lazy path. Validates both params, fetches ESPN summary, normalizes deep match data, caches separately.
- `OPTIONS`: responds with CORS preflight headers.
- Unknown routes return JSON `404`.
- Unsupported methods return JSON `405`.

## Live Match Data Flow
1. Worker receives `GET /live-matches`.
2. Worker checks Cloudflare Cache API using versioned `LIVE_MATCHES_CACHE_KEY_VERSION`.
3. Cache hit returns cached normalized JSON and never calls ESPN.
4. Cache miss fetches `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard`.
5. Worker also best-effort fetches direct extra scoreboard feeds such as `uefa.europa.conf` when a curated league benefits from a league-code-specific ESPN endpoint.
6. `normalizeEspnMatches()` parses event `uid` to extract league ID and can fall back to `payload.leagues[0].slug` for direct league scoreboards.
7. Events outside the curated league map/codes are skipped.
8. Scheduled matches more than 24 hours away are skipped.
9. Team names, scores, state, minute, kickoff, venue, team IDs/logos, league code, league logo metadata, and league logo contrast tone are normalized.
10. Known ESPN team-logo gaps can use a tightly scoped override before the generated ESPN fallback URL. Cancún FC maps ESPN team ID `20724` to the official club HTTPS logo because the ESPN CDN fallback returns `404`.
11. `groupMatchesByLeague()` starts with every curated league keyed by league code, then attaches current matches and league logo URLs.
12. Cache TTL is `30s` if any match has `state === "live"`, otherwise `120s`.
13. Response returns `{ matches, leagues }`.

## Lazy Standings Data Flow
1. Popup opens a league detail view.
2. `createStandingsSection()` checks `leagueStandingsCache`.
3. If absent, it stores `{ status: "loading" }` and calls `loadLeagueStandings(league.code)`.
4. If the previous standings request failed, the error cache automatically expires after 60 seconds and the section can retry instead of staying broken for the whole popup session.
5. Worker validates the league code against the curated ESPN league map.
6. Worker checks Cache API using `STANDINGS_CACHE_KEY_VERSION`.
7. Cache miss fetches `https://site.api.espn.com/apis/v2/sports/soccer/{leagueCode}/standings`.
8. `normalizeEspnStandings()` preserves top-level and child standings groups, team logos, W/D/L/F/A/GD/Pts stats, and extra values such as points per game, deductions, and overall record.
9. Standings response is cached for 30 minutes and returned as `{ leagueCode, standings }`.
10. Popup re-renders the current league if the user is still on a league detail screen.

## Lazy Match Detail Data Flow
1. User clicks or keyboard-activates a match card.
2. Popup sets `selectedMatchKey`, clears the live refresh timer, and renders the match detail shell.
3. `loadMatchDetail()` fetches `/match-detail` only if the match detail is not already cached in popup memory.
4. If the previous detail request failed, the error cache automatically expires after 60 seconds and the detail screen can retry.
5. Worker validates numeric `eventId` and supported `leagueCode`.
6. Worker fetches ESPN summary: `https://site.api.espn.com/apis/site/v2/sports/soccer/{leagueCode}/summary?event={eventId}`.
7. Summary data is normalized into timeline, broadcasts, match stats, lineups, commentary, head-to-head, news, videos, and safe HTTPS links.
8. If ESPN summary links are absent, Worker returns a safe fallback `ESPN Match Center` link based on the validated event ID.
9. Detail response is cached for 60 seconds in Cloudflare Cache API and per popup session in `matchDetailCache`.

## Refresh Strategy
- Uses recursive `setTimeout`, not `setInterval`, to avoid overlapping fetches.
- `startLiveDataFlow()` hydrates from a fresh local live payload cache before calling the Worker.
- `loadMatches()` clears the previous timer before fetching.
- `AbortController` cancels live fetches after 10 seconds.
- `shouldAutoRefresh()` requires enabled state, visible document, no selected league/match detail, no 10-minute session pause, no inactivity pause, and no daily request-limit pause.
- Live matches present: next refresh in 60 seconds.
- No live matches but upcoming matches within 24 hours present: next refresh in 5 minutes.
- No live or upcoming-within-24h matches: next refresh in 30 minutes.
- Hidden popup: timer is cleared.
- Visible again: refresh once if the last successful fetch is older than 30 seconds; otherwise schedule the next timer.
- Power off: timer is cleared and detail fetch is aborted.
- League or match detail open: timer is cleared.
- Inactive for 3 minutes: timer is cleared until the user interacts again.
- Popup open for 10 minutes: timer is cleared until the popup is reopened or power is toggled off/on.
- Refresh failures retry with 2 minute, 5 minute, then 10 minute backoff.
- Returning from detail to the main list: refresh only if the last successful fetch is older than 60 seconds; otherwise reschedule.
- Returning from match detail to league detail keeps the main refresh paused because the user is still inside detail.
- Rescheduling after cache hydration, visibility return, or detail return uses the remaining delay based on `lastFetchCompletedAt`.

## UI State Pattern
- Global state: `lastPayload`, `lastFetchCompletedAt`, `selectedLeagueKey`, `selectedMatchKey`, `isEnabled`.
- Language state: `isEnglishOverride` is restored from localStorage and makes `msg()` return English fallback labels instead of Chrome locale labels.
- Server data is normalized into league groups before rendering.
- League pick list sorts favorite leagues first, then live count, then name.
- Match cards sort by state, then home team name.
- Detail views render from existing main payload first, then attach lazy data when it arrives.
- Rendering uses `textContent` and element creation; no upstream HTML is injected.
- `[hidden] { display: none !important; }` is required because view containers also use flex classes; this prevents list and detail screens from rendering together and causing double scrollbars.
- `.league-detail-scroll > * { flex: 0 0 auto; }` is required so detail sections do not shrink and clip Lineups, News, or Links.
- Match detail meta (kickoff, venue, match details) renders above the score hero.
- Match detail secondary content uses closed-by-default `<details>` accordions for Stats, Timeline, Lineups, Commentary, News, and Links, with no numeric count badges in the headers.
- Detail accordion headings use a larger uppercase title style so section labels stay readable in the compact popup: `.detail-section-title` is currently `13px`, `900` weight, `0.07em` letter spacing.
- League logos render inside a wrapper plate so dark/red plates and light contrast plates can be selected per league with `logoTone`.
- Popup league logo rendering first checks `LOCAL_LEAGUE_LOGOS`, so curated league cards use packaged PNGs from `extension/icons/leagues/` before falling back to Worker-provided logo URLs.
- Use light logo plates for black/text-heavy logos such as Danish Superliga, UEFA Conference League, and USL Championship; use dark plates for most ESPN logos and dark ESPN variants.
- League-card meta only shows upcoming/live activity; completed-only leagues do not show a fallback `X Matches` line.
- League-card action badges only show the bright live badge when live matches exist; muted grey non-live count badges were removed.
- Document/body scrolling is locked with CSS and a JS scroll guard; only `.league-pick-list` or `.league-detail-scroll` should scroll.
- Popup root sizing is fixed at 580x600 because Chrome MV3 popup runtime can collapse when root height depends on `100vh`; scroll areas include a safe bottom buffer so the final league card and final standings rows can be reached.
- Standings use a compact fixed table layout so no horizontal scrollbar is needed in the popup.
- League cards are keyboard-focusable buttons with Enter/Space activation.
- League favorites are the only favorite type; team favorite buttons and team-favorite sorting were removed.
- Visible header status text is currently removed; `setStatus()` remains defensive/no-op when no status element exists, so first-load error states that need user-visible explanation must update the error card text directly.
- The header `ENG` button is the same 40px size as the power button, persists `hype_english_override`, and re-renders the current view without triggering a backend request.
- `file://` preview is detected before live fetches and shows a dedicated extension-runtime-required message because Worker CORS intentionally rejects `Origin: null`.

## Cache And Coalescing Pattern
- Live matches: Cloudflare Cache API plus one in-memory `liveMatchesRefreshPromise` per isolate.
- Standings: Cloudflare Cache API plus `standingsRefreshPromises` keyed by league code.
- Match detail: Cloudflare Cache API plus `matchDetailRefreshPromises` keyed by `{leagueCode}:{eventId}`.
- Popup session cache: `leagueStandingsCache` and `matchDetailCache`.
- Popup persistent cache: `hype_live_matches_cache` stores the latest public `/live-matches` payload with version and timestamp.
- Client cache freshness: 30 seconds when live matches exist, 120 seconds when no live matches exist but upcoming matches within 24 hours do, and 30 minutes when there are no live or upcoming-within-24h matches.
- Cache key versions are used when payload shape changes to avoid stale incompatible cached data.
- Popup daily request guard: `hype_daily_request_count` stores a UTC-day bucket with `attempted` and `successful` counts.
- Popup English override: `hype_english_override` stores whether UI labels should be forced to English.
- `attempted` increments before each backend fetch starts, but the 2,000/day stop condition is based on `successful` JSON responses only.
- Aborted, timed-out, non-OK, and invalid-JSON requests do not increment `successful`, so temporary failures do not prematurely consume the user's local success budget.
- Legacy request buckets with the old `count` field are migrated safely into the new shape.
- Popup storage access uses safe get/set/remove/JSON helpers so malformed values or blocked storage do not crash the popup.

## Security Pattern
- Public read-only API; CORS is no longer wildcard.
- Published Chrome extension ID is `cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Worker CORS allows syntactically valid Chrome extension origins (`chrome-extension://[a-p]{32}`), which supports both the published Store extension and local unpacked-extension IDs.
- Worker also allows no-Origin requests only when they look like Chrome/Edge extension/browser CORS fetches, because extension fetches with `host_permissions` can omit the `Origin` header.
- Raw missing `Origin`, `Origin: null`, and normal web origins return controlled `403` JSON responses.
- Controlled `403` JSON includes a small `reason` field for debugging blocked origin cases.
- Fresh and cached Worker responses must pass the original `request` into `responseHeaders()`/`jsonResponse()` so `Access-Control-Allow-Origin` matches the caller origin on cache hits and misses.
- No API key is stored in extension code.
- TheSportsDB key, if used, must be stored as a Worker secret.
- Upstream ESPN/TheSportsDB fetches have an 8 second timeout.
- `fetchJson()` requires JSON content type before parsing.
- External ESPN links are sanitized to HTTPS before being returned.
- Clickable ESPN URLs are restricted to `espn.com` host suffixes; media URLs are restricted to `espncdn.com` host suffixes.
- Popup re-validates clickable detail/news/highlight links against HTTPS `espn.com` before rendering anchor tags.
- Worker sanitizes ESPN logo asset IDs before constructing fallback CDN image URLs.
- Worker team-logo overrides are hardcoded HTTPS URLs and checked against a narrow override host allowlist rather than widening the ESPN media allowlist.
- Extension manifest has no broad permissions; host permissions are limited to the Worker domain.
- Local `file://` previews send `Origin: null` and are intentionally blocked by Worker CORS after publication; live QA should use the installed extension origin.

## QA Automation Pattern
- `tools/smoke-test.js` is the lightweight ESPN/Worker contract check for the unofficial API risk.
- It calls the deployed Worker with the published Chrome extension origin header.
- It validates `/live-matches` shape, curated league presence, sample match fields, lazy standings shape, and lazy match-detail shape.
- The smoke test intentionally checks payload structure rather than exact scores, because scores and current fixtures are time-sensitive.
- Run it after Worker changes, endpoint normalization changes, and before store package upload when ESPN response-shape risk is a concern.

## Critical Worker Functions
| Function | Purpose |
|---|---|
| `handleLiveMatchesRequest()` | Serves cache-backed hot score endpoint |
| `refreshLiveMatches()` | Fetches live data and chooses dynamic TTL |
| `fetchEspnScoreboardPayloads()` | Fetches all-scoreboard plus curated extra direct scoreboards |
| `normalizeEspnMatchPayloads()` | Deduplicates normalized ESPN matches from multiple payloads |
| `normalizeEspnMatches()` | Converts ESPN scoreboard events to app match objects |
| `groupMatchesByLeague()` | Builds league groups and league logo URLs |
| `handleLeagueStandingsRequest()` | Validates and serves lazy standings |
| `refreshStandingsForLeague()` | Fetches ESPN standings for one league |
| `normalizeEspnStandings()` | Normalizes full standings rows |
| `handleMatchDetailRequest()` | Validates and serves lazy match detail |
| `normalizeEspnMatchDetail()` | Normalizes ESPN summary payload |
| `normalizeMatchStats()` | Converts ESPN boxscore team statistics into home/away stat rows |
| `fetchJson()` | Fetches JSON and validates content type |
| `safeHttpsUrl()` | Enforces HTTPS and optional host suffix allowlists |
| `getTeamLogoOverrideFromTeam()` | Applies tightly scoped team-logo overrides for known ESPN image gaps such as Cancún FC |

## Critical Popup Functions
| Function | Purpose |
|---|---|
| `loadMatches()` | Fetches live payload with timeout and adaptive scheduling |
| `startLiveDataFlow()` | Hydrates from local live cache or fetches from Worker |
| `toggleEnglishOverride()` | Toggles the local `ENG` language override and re-renders current UI labels without fetching |
| `resumeAutomaticRefreshWindow()` | Resets session and inactivity pause state |
| `hydrateFromClientCache()` | Renders fresh local live payload cache without a Worker request |
| `writeClientLiveCache()` | Saves successful live payloads locally with version and timestamp |
| `scheduleNextRefresh()` | Selects 60s, 5m, or 30m timer |
| `scheduleErrorRetry()` | Applies 2m/5m/10m retry backoff after refresh failures |
| `getRemainingRefreshDelay()` | Keeps refresh timing based on the real age of cached/fetched data |
| `handleVisibilityChange()` | Pauses/resumes refresh on visibility changes |
| `refreshIfStaleOrSchedule()` | Refreshes or reschedules with caller-specific stale thresholds |
| `fetchJsonWithTimeout()` | Shared popup fetch helper with timeout and JSON validation |
| `tryStartDailyRequest()` | Records an attempted backend fetch and blocks when successful responses hit the local 2,000/day UTC guard |
| `recordDailyRequestSuccess()` | Records a completed successful backend JSON response |
| `getLeagueLogo()` | Prefers packaged local league logos and falls back to Worker-provided/fallback image URLs |
| `buildLeagueMetaText()` | Builds clean upcoming/live meta without completed-only `X Matches` noise |
| `renderLeaguePickList()` | Renders league cards and badges |
| `renderLeagueDetail()` | Renders league matches and lazy standings section |
| `createStandingsSection()` | Handles standings loading/loaded/error/empty states and renders grouped detailed table rows |
| `loadLeagueStandings()` | Lazy fetches standings once per league per popup session |
| `openMatchDetail()` | Opens match detail and pauses main refresh |
| `loadMatchDetail()` | Lazy fetches ESPN summary data through Worker |
| `togglePower()` | Persists on/off state and controls timers |
| `installScrollBoundaryGuard()` | Prevents document-level scroll and scroll chaining outside the active red scrollbar |
