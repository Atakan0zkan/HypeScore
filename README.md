# Hype - Live Football Scores

Dependency-free example project for a Chrome browser extension backed by a Cloudflare Worker. The extension uses adaptive refresh and cache-backed lazy detail endpoints to stay friendly to the Cloudflare Workers Free plan.

The popup is English by default and supports Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese through Chrome locale files. Matches are grouped by league, with live matches, results, upcoming fixtures, team logos, local favorites, full standings, and lazy-loaded match details shown when the upstream API supports that data.

## Current release

- Chrome Web Store listing: `https://chromewebstore.google.com/detail/hype-live-football-scores/cdnpjnmhmagmiefkleefgchgffeaacaa`
- GitHub repository: `https://github.com/Atakan0zkan/Hype---Live-Scores.git`
- Published extension ID: `cdnpjnmhmagmiefkleefgchgffeaacaa`
- Extension manifest version: `1.2`
- Current store package: `dist/hype-live-football-scores-v1.2-chrome-web-store.zip`
- Worker URL: `https://live-score-football.atakanozkan2001.workers.dev`
- Latest deployed Worker version recorded in the memory bank: `e145b8fb-f760-45ac-b0ad-7c0986b59159`

## Main features

- Curated football league list with local packaged league logos.
- Live match, result, and upcoming-within-24h sections.
- League favorites stored locally and pinned above regular leagues.
- Full league standings loaded only when a league is opened.
- Match detail screen loaded only when a match is opened.
- Match detail accordions for stats, timeline, lineups, commentary, news, and links.
- ESPN team logos on match cards; known ESPN gaps can use curated HTTPS overrides such as Cancún FC.
- English default locale plus Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese Chrome-locale support.
- Header `ENG` toggle forces English labels for quick translation fallback, then returns to the browser/default locale when turned off.
- Dark Hype theme with muted red accents and fixed 580x600 popup sizing.
- Cloudflare Free-plan-friendly refresh behavior with local cache, lazy endpoints, and a local daily request guard.

## Project structure

```text
LiveScoreFootball/
  .gitignore
  AGENTS.md
  README.md
  extension/
    _locales/
      de/messages.json
      en/messages.json
      es/messages.json
      fr/messages.json
      pt_BR/messages.json
      pt_PT/messages.json
      tr/messages.json
    icons/
      icon16.png
      icon32.png
      icon48.png
      icon128.png
      leagues/
        *.png
    manifest.json
    popup.css
    popup.html
    popup.js
  store-assets/
    promo-marquee-1400x560.png
    promo-small-440x280.png
    store-listing-copy.md
    screenshot-*.png
  tools/
    capture-store-sources.ps1
    download-league-logos.ps1
    generate-store-assets.ps1
    smoke-test.js
  worker/
    index.js
```

Local-only files such as `memory-bank/`, `package-extension-store.bat`,
`crop.ps1`, `dist/`, `.wrangler/`, and raw capture files under
`store-assets/sources/` are intentionally ignored and should not be pushed.

## Backend

The Worker exposes:

```text
GET /live-matches
GET /league-standings?leagueCode={leagueCode}
GET /match-detail?eventId={eventId}&leagueCode={leagueCode}
```

Response shape:

```json
{
  "matches": [
    {
      "id": "740912",
      "league": "English Premier League",
      "homeTeam": "Manchester United",
      "awayTeam": "Leeds United",
      "homeLogo": "https://...",
      "awayLogo": "https://...",
      "homeScore": 0,
      "awayScore": 0,
      "minute": "Scheduled",
      "status": "Scheduled",
      "kickoff": "2026-04-26T17:30Z",
      "venue": "Old Trafford · Manchester, England"
    }
  ]
}
```

The response also includes a grouped `leagues` array for the popup UI:

```json
{
  "leagues": [
    {
      "id": "740",
      "code": "esp.1",
      "name": "LaLiga",
      "logo": "https://...",
      "matches": []
    }
  ]
}
```

The primary source is ESPN's unofficial soccer scoreboard endpoint:

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard
```

If ESPN fails, the Worker uses TheSportsDB only when `THESPORTSDB_API_KEY` is configured:

```text
https://www.thesportsdb.com/api/v2/json/livescore/soccer
```

TheSportsDB v2 livescore requires an API key, so fallback is optional by design.

ESPN standings are fetched from:

```text
https://site.api.espn.com/apis/v2/sports/soccer/{leagueCode}/standings
```

Live match responses use dynamic cache TTLs: 30 seconds when live matches exist, 120 seconds when there are no live matches. Standings are no longer fetched as part of `/live-matches`; they are loaded lazily through `/league-standings` when a user opens a league detail view.

Standings are cached separately for 30 minutes and omitted when a league has no usable table. When ESPN returns a table, the Worker returns all available teams rather than limiting the table to five rows.

Standings endpoint response:

```json
{
  "leagueCode": "esp.1",
  "standings": [
    {
      "position": 1,
      "team": "Barcelona",
      "played": 34,
      "wins": 24,
      "draws": 5,
      "losses": 5,
      "goalDifference": "+42",
      "points": 77
    }
  ]
}
```

Match details are intentionally lazy-loaded only after a user clicks a match. This keeps the adaptive main score refresh light while still allowing a richer detail view with ESPN summary data:

- timeline/key events
- venue and kickoff
- broadcasts
- match stats from ESPN boxscore when available
- lineups/rosters
- commentary
- head-to-head
- news
- highlights/videos
- ESPN links

Match detail responses are cached for 60 seconds.

## Deploy the Worker

You can deploy with Wrangler without adding project dependencies:

```bash
npx wrangler deploy worker/index.js --name live-score-football
```

Optional TheSportsDB fallback secret:

```bash
npx wrangler secret put THESPORTSDB_API_KEY --name live-score-football
```

After deploy, your endpoint will look like:

```text
https://live-score-football.YOUR_ACCOUNT.workers.dev/live-matches
```

## Configure the extension

The included example is already configured to use:

```text
https://live-score-football.atakanozkan2001.workers.dev/live-matches
```

For your own Cloudflare account, open `extension/popup.js` and replace:

```js
const BACKEND_URL = "https://YOUR-WORKER-SUBDOMAIN.workers.dev/live-matches";
```

with your deployed Worker URL.

The Worker accepts valid Chrome extension origins and browser-like no-Origin
Chrome/Edge extension fetches. It rejects normal web origins, raw no-Origin
requests, and `file://` preview requests. The published Store ID is kept in
`worker/index.js` as the fallback CORS origin, while local unpacked Chrome
extension IDs also work because they use the same `chrome-extension://...`
origin format:

```js
const ALLOWED_ORIGINS = new Set([
  "chrome-extension://YOUR_EXTENSION_ID"
]);
```

Direct `curl` smoke tests should include an extension origin. A local
`file:///.../popup.html` preview is only for layout; live data should be tested
from the real Chrome extension popup.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `extension` folder.
5. Open the extension popup.
6. After local file changes, click the reload button on the extension card.

The popup fetches scores on open and uses adaptive refresh:

- Live matches present: refresh every 60 seconds.
- No live matches but upcoming-within-24h exists: refresh every 5 minutes.
- No live or upcoming-within-24h matches: refresh every 30 minutes.
- Popup hidden, power off, league detail open, or match detail open: main refresh is paused.
- Popup auto-refresh stops after 10 minutes of an open session.
- Popup auto-refresh stops after 3 minutes of user inactivity.
- When the popup becomes visible again, it refreshes once if the last request is older than 30 seconds.
- Returning from detail to the main list refreshes only if the last successful score fetch is older than 60 seconds.
- A local request guard and short-lived client cache help reduce repeated Worker requests.
- The local daily guard records `attempted` and `successful` requests separately. The 2,000/day pause is based on successful backend JSON responses, so timeouts, aborts, failed responses, or invalid JSON do not prematurely consume the success budget.

Favorites are local-only:

- Favorite leagues are pinned above regular leagues.
- Favorite state is stored in Chrome popup `localStorage` and is not sent to the backend.

League logos are packaged locally under `extension/icons/leagues/` so the main
league list is less dependent on remote logo CDN rendering. Team logos still
load from remote image URLs because bundling every team badge would make the
extension much heavier and harder to maintain. Most team logos come from ESPN;
targeted overrides can be kept in the Worker for teams whose ESPN ID has no
image asset. Cancún FC is currently mapped to the club's official HTTPS logo
URL because ESPN team ID `20724` does not expose a working ESPN CDN logo.

To refresh the local league logo files:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/download-league-logos.ps1
```

## Package for Chrome Web Store

Create the Chrome Web Store zip from the project root:

```powershell
New-Item -ItemType Directory -Force dist
Compress-Archive -Path extension\* -DestinationPath dist\hype-live-football-scores-v1.2-chrome-web-store.zip -Force
```

The command creates:

```text
dist/hype-live-football-scores-v1.2-chrome-web-store.zip
```

Only extension runtime files are included. The zip root contains `manifest.json`; backend, memory-bank, README, Wrangler files, and local tooling are excluded.

## Smoke test

Run the Worker/API shape smoke test from the project root:

```bash
node tools/smoke-test.js
```

The script checks `/live-matches`, `/league-standings`, and `/match-detail`
against the deployed Worker. It is useful after ESPN response changes, Worker
deploys, or before packaging a Chrome Web Store update.

Latest recorded smoke result:

```text
PASS GET /live-matches - 20 matches, 28 leagues
PASS GET /league-standings?leagueCode=esp.1 - 0 rows
PASS GET /match-detail?eventId=740954&leagueCode=eng.1 - Tottenham Hotspur vs Leeds United
```

The standings row count can be `0` for a league at a given moment and still be
valid when the response shape is correct.

Latest backend-only logo smoke after the Cancún FC fix:

```text
PASS GET /live-matches - 5 matches, 28 leagues
PASS GET /league-standings?leagueCode=esp.1 - 0 rows
PASS GET /match-detail?eventId=401873711&leagueCode=bel.1 - KAA Gent vs Racing Genk
PASS GET /match-detail?eventId=401870025&leagueCode=mex.2 - Cancún FC logo override returned official club PNG URL
```

## Local QA checklist

Run these before a Chrome Web Store upload:

```bash
node --check extension/popup.js
node --check worker/index.js
node --check tools/smoke-test.js
node tools/smoke-test.js
```

Validate JSON files in PowerShell:

```powershell
Get-Content -Raw extension/manifest.json | ConvertFrom-Json
Get-ChildItem extension/_locales -Recurse -Filter messages.json | ForEach-Object { Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null }
```

Then reload the unpacked extension from `chrome://extensions` and test the real
popup. A `file://` preview is useful for layout checks only; it cannot load live
data because Worker CORS intentionally rejects `Origin: null`.

## Manual checks

```bash
curl -i -H "Origin: chrome-extension://YOUR_EXTENSION_ID" https://YOUR-WORKER-SUBDOMAIN.workers.dev/live-matches
curl -i -H "Origin: chrome-extension://YOUR_EXTENSION_ID" "https://YOUR-WORKER-SUBDOMAIN.workers.dev/league-standings?leagueCode=esp.1"
curl -i -H "Origin: chrome-extension://YOUR_EXTENSION_ID" "https://YOUR-WORKER-SUBDOMAIN.workers.dev/match-detail?eventId=401867653&leagueCode=eng.fa"
curl -i -X OPTIONS -H "Origin: chrome-extension://YOUR_EXTENSION_ID" https://YOUR-WORKER-SUBDOMAIN.workers.dev/live-matches
curl -i -H "Origin: chrome-extension://YOUR_EXTENSION_ID" https://YOUR-WORKER-SUBDOMAIN.workers.dev/unknown
```

Expected live cache behavior:

```text
First request:  X-Cache: MISS
Second request: X-Cache: HIT
Live match TTL: Cache-Control: public, max-age=30
No live match TTL: Cache-Control: public, max-age=120
Standings TTL: Cache-Control: public, max-age=1800
```

Expected UI states:

- Loading: shown during the first request.
- Empty: shown when the backend returns an empty `matches` array.
- Error: shown as "Veri alınamadı" when the backend fails or returns invalid JSON.

## Security notes

- The extension has no broad Chrome permissions.
- Host access is limited to the deployed Worker URL.
- API keys are never stored in extension code; optional TheSportsDB access belongs in a Worker secret.
- Popup rendering uses `textContent` and does not inject upstream HTML.
- ESPN external links are sanitized to HTTPS and restricted to ESPN-owned host suffixes before being returned to the popup.
- Popup also re-checks match detail links against an HTTPS `espn.com` allowlist before rendering clickable links.
- Worker fallback ESPN logo asset IDs are sanitized before building CDN URLs.
- Worker team-logo overrides are hardcoded HTTPS URLs and host-allowlisted separately from ESPN media URLs.
- Worker upstream API requests have an 8 second timeout.
- Worker CORS/origin policy is restricted to Chrome extension origins plus browser-like no-Origin Chrome/Edge extension fetches; it rejects raw no-Origin, `file://`, and normal web origins.
- Worker JSON responses include `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex`.
- Match details are fetched lazily and cached to avoid amplifying upstream API traffic.
- Public Worker errors are generic; detailed errors stay in Worker logs.

## Known production notes

- ESPN APIs used here are unofficial and can change without notice.
- `tools/smoke-test.js` is the quick guard against silent response-shape breakage.
- CORS blocks normal web pages and raw no-Origin calls, but server-to-server clients can still spoof request headers. If traffic grows, add Cloudflare WAF/rate limiting.
- Team logos remain remote images; league logos are packaged locally in the extension.
- If extension runtime files change, bump `extension/manifest.json`, create a new Chrome Web Store zip from `extension/`, and upload it.
