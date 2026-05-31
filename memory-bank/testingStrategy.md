# Testing Strategy

## Static Validation
Run after code changes:

```bash
Get-Content -Raw worker/index.js | node --check --input-type=module
node --check extension/popup.js
Get-Content -Raw extension/manifest.json | ConvertFrom-Json
Get-ChildItem extension/_locales -Recurse -Filter messages.json | ForEach-Object { Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null }
node --check tools/smoke-test.js
```

Expected:
- Worker syntax passes.
- Popup syntax passes.
- Manifest JSON parses.
- All locale JSON files parse.
- Locale key counts should stay aligned; latest expected set is `de`, `en`, `es`, `fr`, `pt_BR`, `pt_PT`, and `tr`, with 71 keys each.
- Smoke-test script syntax passes.

## Worker/API Smoke Test
Run after Worker/API normalization changes or before a store upload:

```bash
node tools/smoke-test.js
```

Expected:
- `/live-matches` returns JSON with `matches` and `leagues` arrays.
- Curated league count stays at least 20 and currently should be 28.
- Sample match rows include `id`, `league`, `homeTeam`, `awayTeam`, numeric scores, `minute`, and `status`.
- `/league-standings?leagueCode=esp.1` returns a valid `{ leagueCode, standings }` shape, even if ESPN has no rows at that moment.
- `/match-detail` is tested against a current match from `/live-matches` and returns the normalized detail arrays/objects.

## Packaging Validation
Run before Chrome Web Store upload:

```bash
package-extension-store.bat
```

Expected:
- Creates `dist/hype-live-football-scores-v1.1-chrome-web-store.zip` or the matching manifest version.
- Zip root contains `manifest.json`.
- Zip includes only extension runtime files and optional `icons/`.
- Zip does not include `worker/`, `memory-bank/`, `README.md`, `dist/`, or project tooling files.

## Worker Manual Tests
| Test | Expected |
|---|---|
| `GET /live-matches` with allowed Chrome extension `Origin` | `200`, JSON, `{ matches, leagues }`, echoed `Access-Control-Allow-Origin` |
| Repeated `GET /live-matches` | `X-Cache: HIT` within TTL |
| Live matches present | `Cache-Control: public, max-age=30` |
| No live matches present | `Cache-Control: public, max-age=120` |
| `/live-matches` payload | No embedded `standings` field in league objects |
| `/live-matches` curated groups | Includes all 28 curated league groups even when most have no matches |
| `/live-matches` UEFA groups | Includes `uefa.champions`, `uefa.europa`, and `uefa.europa.conf` groups |
| `/live-matches` logo URLs | Worker logo metadata remains valid fallback/source context |
| Known team-logo override | `/match-detail?eventId=401870025&leagueCode=mex.2` returns Cancún FC with the official `cancunfc.mx` PNG URL |
| `/live-matches` logo tones | Danish Superliga, UEFA Conference League, and USL Championship should return `logoTone: "light"` |
| `/live-matches` upcoming filter | Scheduled matches more than 24 hours away are absent |
| `GET /league-standings?leagueCode=esp.1` | `200`, `{ leagueCode, standings }`, `max-age=1800` |
| Repeated standings request | `X-Cache: HIT` |
| `GET /league-standings?leagueCode=bad.code` | `400` JSON error |
| `GET /match-detail?eventId=...&leagueCode=...` | `200` when ESPN summary is available |
| Match detail stats | `stats` array appears when ESPN boxscore statistics are available |
| Invalid match detail params | `400` JSON error |
| `OPTIONS /live-matches` | `204` CORS preflight |
| `GET /live-matches` with `Origin: null` | `403` JSON error |
| Raw `GET /live-matches` without `Origin` | `403` JSON error |
| Browser-like Chrome no-Origin CORS fetch to `/live-matches` | `200`, JSON, supports extension host-permission fetch behavior |
| `GET /live-matches` with normal web `Origin` | `403` JSON error |
| Unknown route | `404` JSON error |

## Latest Worker Smoke Test
- Cancún FC team-logo override validation passed after Worker deploy `e145b8fb-f760-45ac-b0ad-7c0986b59159`: `/match-detail?eventId=401870025&leagueCode=mex.2` returned the official club PNG URL for Cancún FC.
- Latest `tools/smoke-test.js` result after the Cancún FC Worker deploy: `/live-matches` passed with `5` matches and `28` leagues; `/league-standings?leagueCode=esp.1` passed shape validation with 0 rows; `/match-detail` passed for KAA Gent vs Racing Genk.
- Static validation after the Cancún FC Worker change passed: Worker syntax, popup syntax, smoke-test script syntax, manifest JSON, all locale JSON files, and 71-key locale parity.
- Normal web-origin security smoke after the Cancún FC change still returned controlled `403`.
- Initial v1.1 manifest/package validation passed: popup JS syntax, manifest JSON, all seven locale JSON files, and 65-key locale parity before the ENG override added more locale keys.
- Store zip regenerated for `v1.1`: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- v1.1 ENG override/security validation passed: popup JS syntax, Worker JS syntax, manifest JSON, all seven locale JSON files, 71-key locale parity, DOM injection/eval-like scan, and zip-root manifest verification.
- Worker deploy succeeded with version `5ca9c033-f559-4f80-914f-602fa05fd230`.
- Latest `tools/smoke-test.js` result: `/live-matches` passed with `20` matches and `28` leagues; `/league-standings?leagueCode=esp.1` passed shape validation with 0 rows; `/match-detail?eventId=740954&leagueCode=eng.1` passed for Tottenham Hotspur vs Leeds United.
- Store zip regenerated again for `v1.1`: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- README documentation refresh completed on 2026-05-11 and now includes release state, feature overview, adaptive refresh behavior, request guard semantics, local QA, smoke-test output, and production notes.
- v1.0.10 natural language/listing copy validation passed: popup JS syntax, manifest JSON, all seven locale JSON files, and 65-key locale parity.
- Store zip regenerated for `v1.0.10`: `dist/hype-live-football-scores-v1.0.10-chrome-web-store.zip`.
- v1.0.9 multilingual validation passed: popup JS syntax, manifest JSON, all seven locale JSON files, and 65-key locale parity.
- Store zip regenerated for `v1.0.9`: `dist/hype-live-football-scores-v1.0.9-chrome-web-store.zip`.
- v1.0.8 UI polish validation passed: popup JS syntax, manifest JSON, EN locale JSON, and TR locale JSON.
- Store zip regenerated for `v1.0.8`: `dist/hype-live-football-scores-v1.0.8-chrome-web-store.zip`.
- `tools/smoke-test.js` latest result: `/live-matches` passed with `70` matches and `28` leagues; `/league-standings?leagueCode=esp.1` passed shape validation with 0 rows; `/match-detail` passed for a current English Premier League match.
- v1.0.7 static validation passed: Worker JS syntax, popup JS syntax, smoke-test JS syntax, manifest JSON, EN locale JSON, and TR locale JSON.
- Store zip regenerated for `v1.0.7`: `dist/hype-live-football-scores-v1.0.7-chrome-web-store.zip`.
- Local league logo package contains 28 PNG files under `extension/icons/leagues/`.
- Latest deployed Worker version recorded in memory bank: `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Latest deferred-risk audit static checks passed on 2026-05-05: Worker syntax, popup syntax, manifest JSON, EN locale JSON, and TR locale JSON.
- Latest deferred-risk audit security scan found no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, or `document.write` usage.
- Latest deferred-risk audit confirmed manifest still has no broad Chrome API permissions and only uses the Worker host permission.
- `/live-matches`: `200`, repeated request `X-Cache: HIT`, `Cache-Control: public, max-age=120` in the latest quiet-state smoke test.
- `/live-matches`: 2 matches, 28 curated leagues, no LaLiga 2, no Norwegian Eliteserien.
- `/live-matches`: expected `logoTone` values for Danish Superliga, UEFA Conference League, USL Championship, Australian A-League Men, UEFA Champions League, and UEFA Europa League.
- `/live-matches`: zero embedded standings fields.
- `/live-matches`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
- `/league-standings?leagueCode=den.1`: `200`, 12 rows across two groups, `Cache-Control: public, max-age=1800`.
- Immediate repeated `/live-matches` request: `X-Cache: HIT`.
- Browser preview: 26 league cards rendered, status bar updated, first league card had `role="button"` and `tabindex="0"`, no console errors.
- Browser preview after final refresh pause update: 26 league cards rendered, Austrian Bundesliga detail opened, and no console errors were recorded.
- Static validation after detail-return threshold: popup JS syntax, manifest JSON, and EN/TR locale JSON passed.
- Static validation after removing Edit mode: popup JS syntax, manifest JSON, EN/TR locale JSON, and Edit-reference scan passed.
- Static validation after request guardrails: popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed.
- Locale count after popup-open/favorites/upcoming fix: EN 61 keys, TR 61 keys; current locale count after file-preview messaging is EN 65 keys, TR 65 keys.
- Browser preview after popup cleanup: Refresh button removed, visible `Live Football` eyebrow removed, one red scrollbar, Danish Superliga logo visible, and no console errors.
- Browser preview after detail-scroll fix: one red scrollbar, no grey outer scrollbar, no horizontal standings scrollbar, colored W/D/L columns, Lineups fully visible, News/Links visible, and no console errors.
- Store zip regenerated and script-verified with manifest at root.
- Invalid league code: `400`.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after the popup-open/favorites/upcoming changes.
- Browser preview after popup-open/favorites/upcoming changes: normal popup width, no console errors, no team favorite stars, LaLiga standings fit without horizontal scroll, live match Lineups are visible, and upcoming cards show kickoff times instead of `Scheduled`.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after match detail stats and accordion changes.
- EN/TR locale JSON: valid, 64 keys each.
- `/match-detail?eventId=740932&leagueCode=eng.1`: `200`, 18 stats rows, timeline, commentary, lineups, news, and links.
- Immediate repeated `/live-matches`: `X-Cache: HIT`.
- `OPTIONS /live-matches`: `204`.
- Security scan: no DOM HTML injection helpers, no eval-like execution, no unsafe inline script, no broad Chrome API permissions.
- Store assets: 1400x560, 440x280, and three 1280x800 PNGs validated as `Format24bppRgb`.
- Published-extension CORS smoke: published extension-origin `/live-matches` returns `200`; random unpacked-style Chrome extension-origin `/live-matches` returns `200` and echoes that origin; `Origin: null`, normal web origin, and raw no-Origin `/live-matches` return `403`; browser-like Chrome no-Origin CORS fetch returns `200`.
- `/live-matches` after live cache `v5`: returns all 27 curated league groups, including zero-match leagues, plus the active/upcoming match rows.
- Local popup preview after all-league fix: main list renders all curated leagues; English Championship detail opens; upcoming kickoff stays on one line; console logs are empty.
- Store zip regenerated for `v1.0.1`: `dist/hype-live-football-scores-v1.0.1-chrome-web-store.zip`.
- Static validation after UEFA/logo/no-zero-matches changes: Worker JS syntax passed, popup JS syntax passed, manifest version updated to `1.0.2`.
- `/live-matches` after live cache `v6`: first smoke returned `200`, `X-Cache: MISS`, `Cache-Control: public, max-age=120`, all 30 curated league groups, UEFA Champions League upcoming match, and clean ESPN `500`/Wikimedia league logo URLs.
- Local `file://` popup preview after CORS hardening: no console errors, but live backend data is blocked by design because `Origin: null` is not in the allowed CORS origins.
- Store zip regenerated for `v1.0.2`: `dist/hype-live-football-scores-v1.0.2-chrome-web-store.zip`.
- Static validation after header/logo update: Worker JS syntax passed, popup JS syntax passed, manifest version updated to `1.0.3`, and EN/TR locale keys remain aligned at 64 each.
- Local browser preview after header/logo update: brand icon appears left of `Hype Scores`, visible `Updated`/status line is gone, and console logs are empty.
- Store zip regenerated for `v1.0.5`: `dist/hype-live-football-scores-v1.0.5-chrome-web-store.zip`.
- Static validation after the data-load clarity update: Worker JS syntax passed, popup JS syntax passed, manifest version is `1.0.6`, and EN/TR locale keys are aligned at 65 each.
- Store zip regenerated for `v1.0.6`: `dist/hype-live-football-scores-v1.0.6-chrome-web-store.zip`.

## Extension Manual Tests
| Test | Expected |
|---|---|
| Load unpacked extension | Popup opens without console errors |
| Initial popup open | Shows loading then league pick list |
| `file://` popup preview | Shows extension-runtime-required message instead of generic data-load error |
| Reopen popup with fresh live cache | Renders cached league list without an immediate Worker request |
| League pick list | League logos, names, meta, and live badges render |
| Local league logos | League cards load packaged `icons/leagues/*.png` assets before Worker fallback URLs |
| Zero-match league card | Shows league name/logo/favorite only; no `0 Matches` text and no `0` badge |
| Completed-only league card | Does not show a fallback `X Matches` line or muted grey numeric badge |
| Upcoming-only league card | Shows upcoming meta text but no plain numeric badge beside the favorite star |
| Popup header brand | Shows brand icon beside `Hype Scores` and no visible `Updated`/status line |
| Popup header cleanup | No explicit Refresh button and no visible `Live Football` eyebrow |
| Popup scrolling | Only one active red vertical scrollbar is visible in list or detail state |
| League card keyboard nav | Tab focus works; Enter/Space opens league detail |
| Live badge | Uses bright `LIVE N` or `CANLI N`, not dim red dot |
| League click | Opens league detail view |
| League detail open | Main refresh timer is paused until returning to league list |
| Return from league detail to list | Refreshes only if the last successful live fetch is older than 60 seconds |
| League detail | Shows live/results/upcoming sections |
| Standings | Initially loading, then detailed grouped table/empty/error; matches remain visible |
| Standings retry after temporary error | Reopening/re-rendering the section after 60 seconds retries the lazy standings request |
| Detailed standings columns | Team logos plus P/W/D/L/F/A/GD/Pts render when ESPN provides rows |
| Standings colors | W is green, D is orange, L is muted dark red |
| Standings horizontal overflow | No horizontal scrollbar appears in league detail |
| Reopen same league in same popup session | Uses standings memory cache |
| Match card click | Opens detail screen and pauses main refresh |
| Match detail retry after temporary error | Reopening/re-rendering the detail after 60 seconds retries the lazy match detail request |
| Match detail lineups | Lineups are not clipped and remain scrollable inside the single detail scrollbar |
| Match detail news/links | News and Links render compact rows or simple empty-state text |
| Match detail accordions | Stats, Timeline, Lineups, Commentary, News, and Links render as closed-by-default accordions |
| Match detail accordion labels | Accordion labels do not show numeric count badges and are large enough to read comfortably |
| Match detail stats | Stats accordion shows home/away values when ESPN boxscore stats exist |
| Back from match detail | Returns to league detail and keeps main refresh paused until returning to list |
| Power toggle off | UI grays out and refresh timer stops |
| Power toggle on | Refresh resumes |
| Hidden/visible popup | Hidden pauses; visible refreshes only if stale |
| Refresh failure with stale data | Existing data remains visible; no visible header status is currently shown |
| Refresh failure retry | Retry timer backs off to 2m, then 5m, then 10m |
| No live but upcoming exists | Main auto-refresh schedules 5 minutes |
| No live/upcoming exists | Main auto-refresh schedules 30 minutes and local cache can hydrate for 30 minutes |
| Popup open for 10 minutes | Auto-refresh stops; no visible header status is currently shown |
| Reopen/power toggle after auto-pause | Starts a fresh 10-minute window |
| No user interaction for 3 minutes | Auto-refresh stops until interaction or power toggle off/on |
| Daily local successful count reaches 2,000 | Backend fetches stop and cached data remains visible where available |
| Timeout/failed fetch | Increments `attempted` but not `successful`; does not prematurely burn the 2,000/day success budget |
| Daily local successful count reaches 2,000 with no cache | Visible error card shows request-limit message, not generic data-load text |
| Turkish browser locale | Turkish labels appear through Chrome i18n |
| ENG override button | Tapping `ENG` forces English labels without fetching; tapping again returns to the browser/default locale |
| ENG override persistence | Reopening the popup preserves the local override state until the user turns it off |
| League favorite only | League star is visible; team favorite stars are absent from match cards and match detail |
| Favorite league sorting | Favorited leagues appear above non-favorite leagues |
| Upcoming cards | Scheduled/upcoming cards show kickoff time and do not repeat `Scheduled` in the status pill |
| Upcoming window | Matches more than 24 hours away are not shown as upcoming |
| Store zip upload dry-run | Chrome Web Store accepts the generated zip structure |
| Store image assets | Promo assets and screenshots match required dimensions and have no alpha channel |
| Main list bottom reachability | User can scroll to the final visible league card |
| Standings bottom reachability | User can scroll to the final standings row |
| Worker raw no-origin request | Direct request without `Origin` returns `403` |
| Worker browser-like no-origin request | Chrome/Edge CORS fetch-shaped request without `Origin` returns `200` |

## Store Asset Tests
| Test | Expected |
|---|---|
| `powershell -ExecutionPolicy Bypass -File tools/capture-store-sources.ps1` | Recaptures popup source screenshots at 1160x1200 2x quality |
| `powershell -ExecutionPolicy Bypass -File tools/generate-store-assets.ps1` | Regenerates all five final store PNGs |
| Source popup PNG dimensions | `popup-live-list.png`, `popup-league-detail.png`, and `popup-match-detail.png` are 1160x1200 |
| Final store PNG dimensions | 1400x560, 440x280, and 1280x800 screenshots |
| Final store PNG format | `Format24bppRgb`, no alpha channel |
| Promo/screenshot visual QA | Uses real high-resolution popup screenshots, league/team icons visible, no right-edge crop, no broken gradient/mock UI, no circular glow/blob background, no extra badge/feature-card clutter |

## Browser Preview Notes
- `file:///.../extension/popup.html` is useful for layout inspection but does not perfectly simulate Chrome extension runtime.
- After published-origin CORS hardening, `file://` preview cannot fetch the live Worker because browser requests use `Origin: null`.
- `chrome.i18n` may be unavailable in file preview, so fallback English labels are expected.
- Real extension testing should be done through `chrome://extensions` with "Load unpacked".
- Chrome MV3 popup runtime is sensitive to root sizing; keep `html, body` fixed-size and do not use `100vh` for the popup root.

## Regression Watchlist
- Keep README and memory bank aligned after every manifest version bump or package regeneration.
- Do not re-add standings fetches to `/live-matches`.
- Do not change popup refresh back to fixed 15 seconds.
- Do not remove client-side live payload cache unless another request-reduction layer replaces it.
- Do not fetch match details in the main list.
- Do not add broad Chrome permissions without a specific feature need.
- Do not store API keys in extension files.
- Do not bind popup root height to `100vh`; it previously caused the extension popup to open as a tiny box.
