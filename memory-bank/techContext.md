# Tech Context

## Technologies
| Layer | Technology | Notes |
|---|---|---|
| Backend | Cloudflare Worker | Vanilla JS ES module, no framework |
| Frontend | Chrome Extension | Manifest V3 popup, no service worker |
| Language | JavaScript | Vanilla, zero runtime dependencies |
| Styling | CSS | Plain CSS, dark black-red theme |
| i18n | Chrome `_locales` | English default, plus Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese |
| Primary data | ESPN public APIs | Unofficial, no key required |
| Fallback data | TheSportsDB v2 livescore | Requires Worker secret `THESPORTSDB_API_KEY` |
| Cache | Cloudflare Cache API | Public read-only JSON cache |

## Files
```text
LiveScoreFootball/
├── .gitignore
├── AGENTS.md
├── README.md
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   ├── icon128.png
│   │   └── leagues/
│   │       └── *.png
│   └── _locales/
│       ├── de/messages.json
│       ├── en/messages.json
│       ├── es/messages.json
│       ├── fr/messages.json
│       ├── pt_BR/messages.json
│       ├── pt_PT/messages.json
│       └── tr/messages.json
├── package-extension-store.bat
├── store-assets/
│   ├── promo-marquee-1400x560.png
│   ├── promo-small-440x280.png
│   ├── store-listing-copy.md
│   ├── sources/
│   │   ├── popup-live-list.png
│   │   ├── popup-league-detail.png
│   │   └── popup-match-detail.png
│   ├── screenshot-1-live-scores-1280x800.png
│   ├── screenshot-2-standings-1280x800.png
│   └── screenshot-3-match-detail-1280x800.png
├── tools/
│   ├── capture-store-sources.ps1
│   ├── download-league-logos.ps1
│   ├── generate-store-assets.ps1
│   └── smoke-test.js
├── worker/
│   └── index.js
└── memory-bank/
    ├── activeContext.md
    ├── apiCapabilities.md
    ├── productContext.md
    ├── progress.md
    ├── projectbrief.md
    ├── riskBacklog.md
    ├── requestBudget.md
    ├── systemPatterns.md
    ├── techContext.md
    └── testingStrategy.md
```

## Worker Endpoints
| Endpoint | Purpose | Cache |
|---|---|---|
| `GET /live-matches` | Scoreboard hot path, curated groups, no standings | 30s live / 120s idle |
| `GET /league-standings?leagueCode={code}` | Lazy full standings for one league | 1800s |
| `GET /match-detail?eventId={id}&leagueCode={code}` | Lazy ESPN summary detail and match stats for one match | 60s |
| `OPTIONS *` | CORS preflight | no body |

## External API Endpoints
| Source | Endpoint |
|---|---|
| ESPN scoreboard | `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard` |
| ESPN direct scoreboard | `https://site.api.espn.com/apis/site/v2/sports/soccer/{leagueCode}/scoreboard` for curated extras such as `uefa.europa.conf` |
| ESPN standings | `https://site.api.espn.com/apis/v2/sports/soccer/{leagueCode}/standings` |
| ESPN summary | `https://site.api.espn.com/apis/site/v2/sports/soccer/{leagueCode}/summary?event={eventId}` |
| ESPN league logos | Source for packaged local PNGs in `extension/icons/leagues/`; downloader uses `https://a.espncdn.com/i/leaguelogos/soccer/500/{logoId}.png` for most leagues |
| ESPN team logos | `https://a.espncdn.com/i/teamlogos/soccer/500/{teamId}.png` |
| Curated team-logo overrides | Cancún FC currently uses `https://www.cancunfc.mx/cdn/shop/files/LOGOS_CANUN_FC.png?v=1764009552&width=512` because ESPN team ID `20724` has no working CDN image |
| Fallback league logos | Danish Superliga and UEFA Conference League packaged local PNGs are refreshed from curated Wikimedia redirect image URLs with `width=512&type=png` |
| TheSportsDB fallback | `https://www.thesportsdb.com/api/v2/json/livescore/soccer` |

## Important Constants
| Constant | Current Value | Meaning |
|---|---:|---|
| `LIVE_CACHE_TTL_SECONDS` | `30` | Worker cache TTL when live matches exist |
| `IDLE_CACHE_TTL_SECONDS` | `120` | Worker cache TTL when no live matches exist |
| `STANDINGS_CACHE_TTL_SECONDS` | `1800` | Worker cache TTL for one league table |
| `MATCH_DETAIL_CACHE_TTL_SECONDS` | `60` | Worker cache TTL for one match detail |
| `UPSTREAM_FETCH_TIMEOUT_MS` | `8000` | Worker upstream API timeout |
| `UPCOMING_MATCH_WINDOW_MS` | `86400000` | Scheduled matches more than 24 hours away are hidden |
| `LIVE_MATCHES_CACHE_KEY_VERSION` | `v12` | Bumps `/live-matches` payload cache after the Cancún FC team-logo override |
| `STANDINGS_CACHE_KEY_VERSION` | `v4` | Bumps standings payload shape cache |
| `MATCH_DETAIL_CACHE_KEY_VERSION` | `v4` | Bumps match detail cache after the Cancún FC team-logo override |
| `LIVE_REFRESH_INTERVAL_MS` | `60000` | Popup refresh when live matches exist |
| `IDLE_REFRESH_INTERVAL_MS` | `300000` | Popup refresh when no live match exists but upcoming matches do |
| `QUIET_REFRESH_INTERVAL_MS` | `1800000` | Popup refresh when no live or upcoming-within-24h matches exist |
| `UPCOMING_MATCH_WINDOW_MS` | `86400000` | Popup-side guard against stale/old-cache far-future scheduled matches |
| `STALE_VISIBLE_REFRESH_MS` | `30000` | Visibility-return stale threshold |
| `DETAIL_RETURN_REFRESH_MIN_INTERVAL_MS` | `60000` | Minimum live payload age before refreshing after returning from detail to list |
| `AUTO_PAUSE_AFTER_MS` | `600000` | Stops automatic refresh after 10 minutes per popup session |
| `INACTIVITY_PAUSE_AFTER_MS` | `180000` | Stops automatic refresh after 3 inactive minutes |
| `ERROR_RETRY_DELAYS_MS` | `[120000, 300000, 600000]` | Backoff delays after refresh failures |
| `DAILY_REQUEST_LIMIT` | `2000` | Per-user local backend request guard per UTC day |
| `CLIENT_LIVE_CACHE_VERSION` | `v7` | Client-side live payload cache shape version with logo wrapper/tone changes |
| `CLIENT_LIVE_CACHE_MAX_AGE_LIVE_MS` | `30000` | Local cache freshness when live matches exist |
| `CLIENT_LIVE_CACHE_MAX_AGE_IDLE_MS` | `120000` | Local cache freshness when no live matches exist but upcoming matches do |
| `CLIENT_LIVE_CACHE_MAX_AGE_QUIET_MS` | `1800000` | Local cache freshness when no live or upcoming-within-24h matches exist |
| `FETCH_TIMEOUT_MS` | `10000` | Popup fetch abort timeout |
| `LAZY_ERROR_RETRY_MS` | `60000` | Popup lazy standings/detail error cache retry window |
| `STORAGE_KEY_LIVE_CACHE` | `hype_live_matches_cache` | Local public live payload cache |
| `STORAGE_KEY_DAILY_REQUEST_BUCKET` | `hype_daily_request_count` | UTC-day local request counter |
| `STORAGE_KEY_ENGLISH_OVERRIDE` | `hype_english_override` | Local ENG override toggle state |
| Daily request bucket shape | `{ date, attempted, successful }` | `attempted` increments before fetch; `successful` increments only after successful JSON response |

## Popup Layout Constants
- CSS `--popup-width`: `580px`.
- CSS `--popup-height`: `600px`.
- Header action buttons: power and `ENG` language override are both `40px` circular controls.
- Root width/height are fixed on `html, body`; avoid `100vh` or viewport-dependent root sizing because it can collapse the Chrome MV3 popup to a tiny box.
- CSS `--scroll-safe-bottom`: `46px` for main list and detail scroll areas.
- Match detail accordion headings use `.detail-section-title` at `13px` with `0.07em` letter spacing.
- `.detail-section-summary` uses `13px 12px` padding to keep larger accordion titles aligned.

## Chrome Manifest
- `manifest_version`: `3`
- `name`: `__MSG_extName__`
- `description`: `__MSG_extDescription__`
- `default_locale`: `en`
- `version`: `1.1`
- `icons`: 16, 32, 48, and 128px PNG icons under `extension/icons/`
- `action.default_icon`: same icon set
- `permissions`: empty array
- `host_permissions`: `https://live-score-football.atakanozkan2001.workers.dev/*`
- Published extension ID: `cdnpjnmhmagmiefkleefgchgffeaacaa`
- Worker CORS/origin policy: syntactically valid Chrome extension origins (`chrome-extension://[a-p]{32}`), including published ID `cdnpjnmhmagmiefkleefgchgffeaacaa`, plus browser-like no-Origin Chrome/Edge extension fetches

## Locale Files
- English locale: `extension/_locales/en/messages.json`
- Turkish locale: `extension/_locales/tr/messages.json`
- German locale: `extension/_locales/de/messages.json`
- Spanish locale: `extension/_locales/es/messages.json`
- French locale: `extension/_locales/fr/messages.json`
- Brazilian Portuguese locale: `extension/_locales/pt_BR/messages.json`
- European Portuguese locale: `extension/_locales/pt_PT/messages.json`
- Current key count: 71 keys in each locale file.

## Development Commands
```bash
# Worker syntax check
Get-Content -Raw worker/index.js | node --check --input-type=module

# Popup syntax check
node --check extension/popup.js

# Validate JSON files
Get-Content -Raw extension/manifest.json | ConvertFrom-Json
Get-ChildItem extension/_locales -Recurse -Filter messages.json | ForEach-Object { Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null }

# Deploy Worker
npx wrangler deploy worker/index.js --name live-score-football --compatibility-date 2026-04-26

# Create Chrome Web Store zip
package-extension-store.bat

# Refresh packaged league logos
powershell -NoProfile -ExecutionPolicy Bypass -File tools/download-league-logos.ps1

# Worker/API response-shape smoke test
node tools/smoke-test.js

# Generate Chrome Web Store image assets
powershell -ExecutionPolicy Bypass -File tools/capture-store-sources.ps1
powershell -ExecutionPolicy Bypass -File tools/generate-store-assets.ps1
```

## Chrome Web Store Packaging
- Packaging script: `package-extension-store.bat`.
- Output directory: `dist/`.
- Output file pattern: `hype-live-football-scores-v{manifest.version}-chrome-web-store.zip`.
- Current output: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- The zip root contains `manifest.json`, not an outer `extension/` folder.
- Current required runtime files are whitelisted and the complete `_locales/` directory is copied recursively.
- Optional `extension/icons/` is included automatically if it exists.
- Current store package includes local league logos under `icons/leagues/`.
- Backend files, memory bank files, README, Wrangler files, and local project files are intentionally excluded.

## Git Repository State
- The intended project repository is `https://github.com/Atakan0zkan/Hype---Live-Scores.git`.
- Use a dedicated `.git` repository inside `C:\Users\aozka\CascadeProjects\LiveScoreFootball`.
- Do not use the parent user-home repository at `C:\Users\aozka` for this project; it previously caused noisy status output and an unrelated/inaccessible remote.
- Current GitHub repository is private unless changed in GitHub settings.
- Project `.gitignore` ignores local runtime/build artifacts: `.chrome-store-capture-profile/`, `.wrangler/`, `dist/`, and `store-assets/sources/headless-test*.png`.

## Chrome Web Store Assets
- Asset generator: `tools/generate-store-assets.ps1`.
- Source capture helper: `tools/capture-store-sources.ps1`.
- Output directory: `store-assets/`.
- Source popup captures are stored in `store-assets/sources/` and are composed into the final store canvases.
- Source popup captures should be generated through Chrome headless at 2x quality: `1160x1200`, `Format24bppRgb`.
- The generator uses the full high-resolution source captures and downsamples into final canvases so text, logos, and UI edges stay sharper.
- Temporary Chrome capture profile data is ignored through `.gitignore` at `.chrome-store-capture-profile/`.
- Temporary test captures matching `store-assets/sources/headless-test*.png` are ignored through `.gitignore`.
- `promo-marquee-1400x560.png`: 1400x560, `Format24bppRgb`.
- `promo-small-440x280.png`: 440x280, `Format24bppRgb`.
- `screenshot-1-live-scores-1280x800.png`: 1280x800, `Format24bppRgb`.
- `screenshot-2-standings-1280x800.png`: 1280x800, `Format24bppRgb`.
- `screenshot-3-match-detail-1280x800.png`: 1280x800, `Format24bppRgb`.
- `store-listing-copy.md`: localized long-description text for the Chrome Web Store listing.
- Generator should keep using real popup screenshots, not hand-drawn mock cards, so league/team logos remain visible.
- Generator should keep final assets clean and listing-focused: no extra request-mode/language badges or feature cards unless explicitly requested again.
- Generator backgrounds should avoid obvious circular glow/blob shapes; prefer full-canvas lineer lighting bands, subtle diagonal red wash, warm top light, and vignette.

## Manual Endpoint Checks
```bash
curl -i -H "Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa" https://live-score-football.atakanozkan2001.workers.dev/live-matches
curl -i -H "Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa" "https://live-score-football.atakanozkan2001.workers.dev/league-standings?leagueCode=esp.1"
curl -i -H "Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa" "https://live-score-football.atakanozkan2001.workers.dev/match-detail?eventId=401867653&leagueCode=eng.fa"
curl -i -X OPTIONS -H "Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa" https://live-score-football.atakanozkan2001.workers.dev/live-matches
curl -i -H "Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa" https://live-score-football.atakanozkan2001.workers.dev/unknown
curl -i https://live-score-football.atakanozkan2001.workers.dev/live-matches
curl -i -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" -H "Sec-Fetch-Mode: cors" -H "Sec-Fetch-Dest: empty" -H "Sec-Fetch-Site: none" https://live-score-football.atakanozkan2001.workers.dev/live-matches
```

## Deployment State
- Cloudflare account subdomain: `atakanozkan2001.workers.dev`.
- Worker name: `live-score-football`.
- Chrome Web Store listing: `https://chromewebstore.google.com/detail/hype-live-football-scores/cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Latest deployed Worker version: `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Local Worker code is deployed with live cache `v12`, standings cache `v4`, and match-detail cache `v4`.
- Extension points directly to the deployed Worker URL in `popup.js`.
- After extension file changes, reload the unpacked extension from `chrome://extensions`.

## Technical Constraints
- ESPN APIs are unofficial and can change without notice.
- ESPN coverage varies; summary data may not include every detail section.
- Curated league logos are now packaged locally; use `tools/download-league-logos.ps1` plus visual QA before replacing them.
- Team logos remain remote images because local bundling every possible team logo is not practical for this popup. Most come from ESPN; tightly scoped official-source overrides can be added in the Worker when ESPN has no usable logo for a known team.
- Cloudflare Workers Free plan has daily request limits; adaptive refresh and lazy endpoints are intentional.
- No backend-side rate limiting exists yet beyond cache and endpoint validation; popup has a local 2,000/day request guard.
- CORS is restricted to Chrome extension origins plus browser-like no-Origin extension fetches; null/web/raw no-origin requests return `403`.
- Local `file://` preview cannot fetch live backend data because browser requests use `Origin: null`, which is intentionally not allowed; the popup shows a dedicated extension-runtime-required message in this mode.
- Worker responses include basic hardening headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex`.

## Deferred Risk Tracking
- `memory-bank/riskBacklog.md` is the canonical list of deferred bug, security, and optimization findings that are awaiting a user decision.
- Before implementing any risk-backlog item, re-run the relevant local code scan and update the backlog status or remove the item after validation.
