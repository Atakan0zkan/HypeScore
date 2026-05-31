# Project Brief

## Product
Hype - Live Football Scores is a dependency-free Chrome Manifest V3 popup extension backed by a Cloudflare Worker. It shows curated football scores, match state, minute/status, packaged local league logos, remote team logos, league grouping, lazy league standings, and lazy match detail data including match stats.

## Current Scope
- Backend: one Cloudflare Worker in `worker/index.js`.
- Frontend: popup-only Chrome MV3 extension in `extension/`.
- Data source: ESPN public/unofficial soccer APIs as primary source.
- Fallback: TheSportsDB livescore only when `THESPORTSDB_API_KEY` is configured as a Worker secret.
- Cache: Cloudflare Cache API for public read-only JSON responses.
- Runtime dependencies: none.
- Build step: none.

## Core Requirements
- Default UI language is English; Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese are auto-detected by Chrome locale through `_locales`.
- Popup header includes an `ENG` toggle that forces English UI labels as a translation fallback and returns to the user's browser/default locale when turned off.
- Popup fetches `GET /live-matches` on open.
- Popup can hydrate from a fresh local client cache before calling `GET /live-matches`.
- Popup uses adaptive refresh to protect Cloudflare Workers Free plan usage.
- Live matches refresh every 60 seconds in the popup.
- No-live states with upcoming matches refresh every 5 minutes in the popup.
- No-live/no-upcoming quiet states refresh every 30 minutes in the popup.
- Refresh pauses when the popup is hidden, the power toggle is off, any detail screen is open, the user is inactive for 3 minutes, or the popup session reaches 10 minutes.
- Reopening the popup or toggling power off/on starts a fresh 10-minute auto-refresh window.
- A per-user client-side daily budget guard stops backend requests after 2,000 successful backend JSON responses per UTC day.
- Worker uses ESPN scoreboard as the primary data source.
- Worker optionally falls back to TheSportsDB only when the fallback API key exists.
- Worker filters ESPN's broad soccer scoreboard down to 28 curated leagues.
- Worker and popup only keep scheduled/upcoming matches that start within the next 24 hours.
- Worker caches `/live-matches` for 30 seconds when live matches exist and 120 seconds when no live match exists.
- Worker does not fetch or embed standings in `/live-matches`.
- Standings are lazy-loaded through `GET /league-standings?leagueCode=...` and cached for 30 minutes.
- Match details are lazy-loaded through `GET /match-detail?eventId=...&leagueCode=...` and cached for 60 seconds.
- League logos are packaged locally under `extension/icons/leagues/` so the main league list is stable and not dependent on remote logo loading.
- Match cards show remote team logos and can open the match detail screen.
- Known ESPN team-logo gaps can be patched with tightly scoped Worker overrides; Cancún FC currently uses a hardcoded official club HTTPS logo because ESPN team ID `20724` has no working ESPN CDN image.
- Favorite leagues are pinned locally with `localStorage` and always sort above non-favorite leagues.
- The latest live match payload is cached locally to reduce repeated popup-open Worker requests, with a longer quiet cache window when there are no live or upcoming-within-24h matches.
- The local daily request guard tracks `attempted` and `successful` fetches separately; the 2,000/day pause is based on successful backend JSON responses so aborted/time-out/failing requests do not prematurely consume the user's success budget.
- Popup uses the dark black-red Hype visual theme.
- Popup uses calmer, readable red tones instead of harsh neon red accents.
- Power toggle lets users disable the extension UI and background refresh behavior.

## Current Worker URL

```text
https://live-score-football.atakanozkan2001.workers.dev
```

Primary extension endpoint:

```text
https://live-score-football.atakanozkan2001.workers.dev/live-matches
```

## Current Release State
- Chrome Web Store listing is published at `https://chromewebstore.google.com/detail/hype-live-football-scores/cdnpjnmhmagmiefkleefgchgffeaacaa`.
- GitHub repository is `https://github.com/Atakan0zkan/Hype---Live-Scores.git`.
- Published Chrome extension ID: `cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Extension manifest version: `1.1`.
- Latest deployed Worker version: `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Local Worker cache key versions are deployed: live `v12`, standings `v4`, and match detail `v4`.
- Worker CORS/origin policy is restricted to valid Chrome extension origins plus browser-like no-Origin Chrome/Edge extension fetches; null, normal web origins, and raw no-Origin requests are rejected.
- Latest validated live response from `tools/smoke-test.js`: `/live-matches` returned `5` matches and all `28` curated league groups, including UEFA Champions League, UEFA Europa League, and UEFA Conference League; LaLiga 2 and Norwegian Eliteserien are intentionally removed.
- Latest validated `/live-matches` response has zero embedded standings fields.
- Latest validated `/match-detail` smoke check loaded a current Belgian Pro League match detail payload successfully.
- Latest targeted Cancún FC logo check loaded `/match-detail?eventId=401870025&leagueCode=mex.2` and confirmed the official club PNG override is returned for Cancún FC.
- Latest validated `/league-standings?leagueCode=esp.1` smoke check returned a valid `{ leagueCode, standings }` shape, even when ESPN had no rows at that moment.
- Current Chrome Web Store package: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- Chrome Web Store promo assets now exist under `store-assets/`.
- `file://` popup preview now shows a specific extension-runtime-required message instead of generic `Could not load data`; live data still requires the real Chrome extension runtime.
- README is current for v1.1 and documents release state, multilingual i18n, adaptive refresh rules, local league logos, smoke testing, packaging, security notes, and production caveats.
- Chrome Web Store long-description copy for all supported listing languages is prepared in `store-assets/store-listing-copy.md`.
- Latest v1.1 runtime package includes the `ENG` language override, popup-side ESPN link allowlist, localized fallback labels, Worker ESPN logo asset-ID sanitization, and the deployed backend now includes the Cancún FC team-logo override.

## Non-Goals For This Stage
- No paid API dependency.
- No backend database, KV, Durable Object, or scheduled precompute yet.
- No service worker/background notification pipeline yet.
- No user accounts or cloud sync for favorites.
- Chrome Web Store privacy/listing copy has draft text from earlier work and should be reviewed before each store update.
