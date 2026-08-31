# HypeScore

HypeScore is the open-source project behind
[Hype - Live Football Scores](https://chromewebstore.google.com/detail/hype-live-football-scores/cdnpjnmhmagmiefkleefgchgffeaacaa),
a lightweight Chrome Manifest V3 popup backed by a Cloudflare Worker.

It shows live scores, results, upcoming fixtures, league tables, match details,
and the FIFA World Cup knockout bracket without injecting scripts into websites.

## Features

- 32 curated football competitions, including UEFA Nations League, UEFA EURO,
  Copa América, FIFA World Cup, and major domestic and UEFA club competitions.
- Live, completed, and upcoming matches in a compact popup.
- Lazy-loaded standings, match statistics, lineups, timeline, commentary, news,
  links, and World Cup knockout rounds.
- Local favorite leagues, adaptive refresh, local score cache, and request
  budget protection.
- 55 interface locales with RTL support for Arabic, Hebrew, and Persian.
- No account, advertisements, content scripts, or remote executable code.

## Privacy

The extension sends functional football-data requests only to the Hype
Cloudflare Worker. The Worker records limited aggregate usage and reliability
metrics in Workers Analytics Engine.

The product analytics dataset excludes raw IP addresses, persistent device
identifiers, accounts, favorites, event IDs, browsing history, and cross-site
activity. It is not used for advertising or profiling.

See [PRIVACY.md](PRIVACY.md) for the user-facing notice,
[ANALYTICS.md](ANALYTICS.md) for the analytics design, and
[SECURITY.md](SECURITY.md) for responsible disclosure.

## Architecture

```text
Chrome MV3 popup
       |
       v
Cloudflare Worker + Cache API
       |
       +--> ESPN public football endpoints
       +--> optional TheSportsDB fallback
       +--> Workers Analytics Engine
```

The project has no frontend runtime dependencies and no build step. The
extension source in `extension/` is the package loaded by Chrome.

### Worker endpoints

| Endpoint | Purpose |
|---|---|
| `GET /live-matches` | Curated live, result, and next-24-hour fixtures |
| `GET /league-standings?leagueCode=...` | Lazy league table |
| `GET /match-detail?eventId=...&leagueCode=...` | Lazy match detail |
| `GET /tournament-bracket?leagueCode=fifa.world` | Lazy World Cup bracket |

## Run the extension locally

1. Clone the repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the `extension/` directory.

The extension connects to the production API configured in
`extension/popup.js`. To use another Worker, update that URL and the matching
`host_permissions` entry in `extension/manifest.json`.

## Development

Install the development dependency:

```powershell
npm install
```

Run the local checks:

```powershell
npm test
npm run analytics:test
npm run smoke
```

- `npm test` runs the Worker regression suite.
- `npm run analytics:test` validates dashboard queries and data shaping.
- `npm run smoke` checks the deployed API and therefore requires internet
  access.

## Deploy the Worker

`wrangler.jsonc` is the canonical Cloudflare configuration.

```powershell
npx wrangler login
npm run deploy
```

For token-based automation, provide `CLOUDFLARE_API_TOKEN` through the process
environment. Never save Cloudflare credentials in the repository.

The optional fallback key must be stored as a Worker secret:

```powershell
npx wrangler secret put THESPORTSDB_API_KEY
```

## Local analytics dashboard

The owner dashboard listens only on `127.0.0.1` and keeps Cloudflare
credentials in the local server process.

```powershell
npm run analytics
```

The launcher prompts for a Cloudflare account ID and a scoped API token, then
prints the local dashboard URL. Use a read-only analytics token for routine
dashboard access and a separate deployment token for Worker updates.

## Project layout

```text
extension/             Chrome extension runtime and locales
worker/                Cloudflare Worker
analytics-dashboard/   localhost-only owner dashboard
tools/                 regression, smoke, locale audit, and QA helpers
ANALYTICS.md            analytics design decision
PRIVACY.md              privacy notice
SECURITY.md             vulnerability reporting
wrangler.jsonc          canonical Worker configuration
```

Generated store media, release archives, dependencies, local assistant context,
and credentials are intentionally excluded from Git.

## Package for Chrome Web Store

Zip the contents of `extension/` so that `manifest.json` is at the archive
root. Release archives belong in the ignored `dist/` directory.

## License

[MIT](LICENSE)
