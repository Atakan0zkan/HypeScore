# Progress

## Overall Status
The project is published on the Chrome Web Store. The Worker is deployed, the extension is functional, the main request-reduction/security hardening refactor is complete, and the local store-ready extension package is currently `v1.1`.

## What Works
- Cloudflare Worker is deployed and serving public JSON.
- `/live-matches` returns normalized football match data grouped by curated leagues.
- `/live-matches` returns all 28 curated league groups even when most leagues have zero current matches.
- `/live-matches` no longer includes standings.
- `/live-matches` uses dynamic cache TTL: 30 seconds live, 120 seconds idle.
- `/league-standings` lazy-loads full standings per league.
- `/match-detail` lazy-loads ESPN summary data per match.
- `/match-detail` includes normalized ESPN boxscore match stats when available.
- Extension popup loads league cards in the installed Chrome extension runtime.
- League cards show enlarged, contrast-aware logos, live badges, and upcoming/live meta; zero-match leagues hide `0 Matches` and `0` badge noise.
- League cards use packaged local PNG league logos from `extension/icons/leagues/` for all 28 curated leagues.
- Completed-only/result-only leagues no longer show a muted `X Matches` meta line or grey count badge.
- League detail shows live, results, upcoming-within-24h, and standings section.
- Match cards show team logos.
- Match detail screen shows kickoff/venue/match details above the score hero, then closed-by-default accordion sections for Stats, Timeline, Lineups, Commentary, News, and Links without numeric count badges; accordion titles now use a larger readable heading size.
- Favorite leagues persist locally and always sort above non-favorite leagues.
- Power toggle persists locally and pauses refresh.
- English, Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese locales are present.
- Header `ENG` toggle can force English labels and return to the browser/default locale without making a backend request.
- Dark black-red theme is applied.
- CORS is restricted to Chrome extension origins and browser-like no-Origin extension fetches, and works for both the published Store extension and local unpacked-extension IDs.
- `workers.dev` access works.
- Adaptive guarded refresh works at code level with `setTimeout`.
- Popup quiet mode uses a 30-minute refresh/cache window when there are no live or upcoming-within-24h matches.
- Popup auto-refresh stops after 10 minutes of an open session and after 3 minutes of inactivity.
- Reopening the popup or toggling power off/on starts a fresh auto-refresh window.
- Popup has a local 2,000/day UTC successful-response request guard for all backend fetches, with separate `attempted` and `successful` counters.
- Refresh failures use 2m/5m/10m backoff.
- Returning from detail to the main list has a 60-second refresh threshold to avoid request spikes from repeated navigation.
- Fresh client-side live payload cache avoids unnecessary Worker requests on repeated popup opens.
- Fetch timeout uses `AbortController`.
- Scroll position is preserved on league detail re-render.
- Chrome Web Store packaging script exists and whitelists extension-only files.
- Extension icons exist and are referenced by manifest/action.
- Chrome Web Store image source captures can be regenerated at 2x quality with `tools/capture-store-sources.ps1`.
- Popup header status text was removed from the visible UI; internal status updates still exist in code but are not rendered.
- Popup header no longer has an explicit refresh button or the visible `Live Football` eyebrow.
- Popup red accents were softened to a calmer crimson/coral palette.
- Popup uses a single active red scrollbar after fixing hidden list/detail views, hiding document-level scrollbars, locking body/document scroll, and adding safe bottom scroll padding.
- League cards are keyboard accessible.
- README is updated for the current v1.1 release, including release state, multilingual i18n, adaptive refresh, local request guard semantics, smoke testing, packaging, QA, security, and production notes.
- Chrome Web Store long-description copy for all supported listing languages is prepared in `store-assets/store-listing-copy.md`.

## Completed Features
| Feature | Status | Notes |
|---|---|---|
| Chrome i18n | Done | EN default; TR, DE, ES, FR, PT-BR, and PT-PT supported; 71 keys each |
| English override toggle | Done | Header `ENG` button, local-only `hype_english_override`, no backend request |
| Manifest MV3 | Done | v1.1, default locale, no broad permissions |
| Extension icons | Done | 16, 32, 48, 128px PNG icons |
| Worker deploy | Done | Latest version `e145b8fb-f760-45ac-b0ad-7c0986b59159` |
| ESPN scoreboard backend | Done | Primary source for `/live-matches` |
| TheSportsDB fallback | Done | Optional secret-based fallback |
| Curated league filter | Done | 28 selected leagues |
| League logo mapping | Done | All 28 curated league logos are packaged locally as PNGs; Worker logo metadata remains fallback/source context |
| Team logos | Done | Match cards use ESPN team logos/fallback; Cancún FC uses a curated official-source override because ESPN ID `20724` has no CDN logo |
| League pick list | Done | Logo, meta, badge, favorite action |
| League detail view | Done | Header, match sections, lazy standings |
| Match detail view | Done | Lazy ESPN summary sections, simple empty states, fallback ESPN Match Center link |
| Match statistics | Done | Lazy `/match-detail` stats rows from ESPN boxscore |
| Full standings | Done | All available rows, grouped tables, team logos, colored W/D/L, no horizontal scrollbar |
| Lazy standings endpoint | Done | 30 minute cache, no main-list subrequests |
| Adaptive refresh | Done | 60s live, 5m upcoming-within-24h idle, 30m quiet, pauses hidden/off/detail/inactive/session, 60s detail-return threshold |
| Local daily request guard | Done | 2,000 successful backend JSON responses per UTC day per user in localStorage; attempted and successful counters are separate |
| Client live payload cache | Done | `hype_live_matches_cache`, 30s live / 120s upcoming-within-24h idle / 30m quiet freshness |
| Power toggle | Done | localStorage, grayscale, overlay |
| Favorite pinning | Done | League stars only in localStorage; team pinning removed |
| Dark Hype theme | Done | Black/red high-contrast UI |
| Live badge fix | Done | `LIVE N` / `CANLI N` instead of dim red dot |
| Fetch timeout | Done | 10s AbortController |
| Worker upstream timeout | Done | 8s ESPN/TheSportsDB timeout |
| Security headers | Done | nosniff, no-referrer, noindex |
| ESPN link host allowlist | Done | `espn.com` links, `espncdn.com` media |
| Popup link allowlist | Done | Popup re-checks clickable detail links against HTTPS `espn.com` |
| ESPN asset ID sanitization | Done | Worker sanitizes fallback logo asset IDs before building CDN URLs |
| Visible status bar | Removed | User requested the `Updated` line be removed from the popup header |
| Keyboard-accessible league cards | Done | `role=button`, tab focus, Enter/Space |
| Cache key versioning | Done | Live `v12`, standings `v4`, detail `v4`, client live cache `v7` |
| Content-Type validation | Done | Worker refuses non-JSON upstream responses |
| Store zip packaging script | Done | `package-extension-store.bat`, outputs to `dist/` |
| ESPN smoke-test script | Done | `tools/smoke-test.js` validates live, standings, and match-detail payload shapes |
| Local league logo downloader | Done | `tools/download-league-logos.ps1` refreshes packaged league PNGs from ESPN/Wikimedia sources |
| Chrome Web Store image assets | Done | 24-bit PNG promo assets and screenshots in `store-assets/`, composed from 2x real popup screenshots |
| Popup scroll fit | Done | Fixed 580x600 popup root, safe bottom scroll padding |
| Lazy error retry | Done | Standings and match detail error cache retries after 60 seconds |
| Safe storage helpers | Done | Power, favorites, live cache, and request bucket use guarded localStorage helpers |
| Missing-origin handling | Done | Worker allows Chrome extension origins plus browser-like no-Origin extension fetches; null-origin, web-origin, and raw no-Origin requests return 403 |
| CORS cache-miss fix | Done | Fresh `/live-matches` and `/match-detail` responses now carry the caller request into CORS headers |
| Data-load error clarity | Done | `file://` preview and local request-limit first-load failures no longer show only generic `Could not load data` |

## Curated League Roster
| ID | Code | League | Logo |
|---|---|---|---|
| 700 | `eng.1` | English Premier League | ESPN logo 23 |
| 710 | `fra.1` | Ligue 1 | ESPN logo 9 |
| 715 | `por.1` | Portuguese Primeira Liga | ESPN logo 14 |
| 720 | `ger.1` | German Bundesliga | ESPN logo 10 |
| 725 | `ned.1` | Dutch Eredivisie | ESPN logo 11 |
| 730 | `ita.1` | Italian Serie A | ESPN logo 12 |
| 735 | `sco.1` | Scottish Premiership | ESPN logo 45 |
| 740 | `esp.1` | LaLiga | ESPN logo 15 |
| 745 | `arg.1` | Argentine Liga Profesional | ESPN logo 1 |
| 760 | `mex.1` | Mexican Liga MX | ESPN logo 22 |
| 770 | `usa.1` | MLS | ESPN logo 19 |
| 775 | `uefa.champions` | UEFA Champions League | ESPN logo 2 |
| 2310 | `uefa.europa` | UEFA Europa League | ESPN logo 2310 |
| 3901 | `bel.1` | Belgian Pro League | ESPN logo 6 |
| 3906 | `aus.1` | Australian A-League Men | ESPN logo 1308 |
| 3907 | `aut.1` | Austrian Bundesliga | ESPN logo 5 |
| 3913 | `den.1` | Danish Superliga | Wikimedia redirect PNG thumbnail, light logo plate |
| 3914 | `eng.2` | English Championship | ESPN logo 24 |
| 3918 | `eng.fa` | English FA Cup | ESPN logo 40 |
| 3927 | `ger.2` | German 2. Bundesliga | ESPN logo 97, default style |
| 3932 | `mex.2` | Mexican Liga de Expansion MX | ESPN logo 2306 |
| 3939 | `rus.1` | Russian Premier League | ESPN logo 106 |
| 3945 | `swe.1` | Swedish Allsvenskan | ESPN logo 16, default style |
| 3946 | `tur.1` | Turkish Super Lig | ESPN logo 18 |
| 3955 | `gre.1` | Greek Super League | ESPN logo 98, default style |
| 8097 | `eng.w.1` | English Women's Super League | ESPN logo 2314 |
| `uefa.europa.conf` | `uefa.europa.conf` | UEFA Conference League | Wikimedia redirect PNG thumbnail, light logo plate |
| 23633 | `usa.usl.1` | USL Championship | ESPN logo 2292, light logo plate |

## Removed Leagues
- Dutch Vrouwen Eredivisie (`19945`)
- NWSL (`8301`)
- Cypriot First Division (`5346`)
- Chinese Super League (`8376`)
- Spanish Liga F (`20956`)
- UEFA Women's Champions League (`19483`)
- LaLiga 2 (`3921`)
- Norwegian Eliteserien (`3960`)

## Latest Validation
- Worker deploy succeeded with version `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Static validation after the Cancún FC team-logo override passed: Worker JS syntax, popup JS syntax, smoke-test JS syntax, manifest JSON, all locale JSON files, and 71-key locale parity.
- `node tools/smoke-test.js` passed after deploy: `/live-matches` returned `5` matches and `28` leagues, `/league-standings?leagueCode=esp.1` returned a valid standings payload shape with 0 rows, and `/match-detail` returned KAA Gent vs Racing Genk.
- Targeted Cancún verification passed: `/match-detail?eventId=401870025&leagueCode=mex.2` returned Cancún FC with `https://www.cancunfc.mx/cdn/shop/files/LOGOS_CANUN_FC.png?v=1764009552&width=512`.
- Normal web origin smoke remained blocked with controlled `403`, confirming the logo override did not loosen Worker CORS.
- v1.1 manifest/package validation: popup JS syntax passed, manifest JSON parsed, all seven locale JSON files parsed, and locale key parity passed with 65 keys each.
- Store zip regenerated for `v1.1`: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- v1.1 ENG override/security validation: popup JS syntax passed, Worker JS syntax passed, manifest JSON parsed, all seven locale JSON files parsed, locale key parity passed with 71 keys each, and DOM injection/eval-like scan returned no findings.
- Worker deploy succeeded with version `5ca9c033-f559-4f80-914f-602fa05fd230`.
- Smoke test after deploy: `/live-matches` returned `20` matches and `28` leagues; `/league-standings?leagueCode=esp.1` returned a valid shape with `0` rows; `/match-detail?eventId=740954&leagueCode=eng.1` returned Tottenham Hotspur vs Leeds United.
- Store zip regenerated again for `v1.1`: `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- README and memory bank documentation refresh completed on 2026-05-11.
- Documentation now records the current Git caveat: local commit `ea5bb3c` exists, but push to `https://github.com/Atakan0zkan/aozka.git` failed because GitHub returned `Repository not found`.
- v1.0.10 natural language/listing copy validation: popup JS syntax passed, manifest JSON parsed, all seven locale JSON files parsed, and locale key parity passed with 65 keys each.
- Store zip regenerated for `v1.0.10`: `dist/hype-live-football-scores-v1.0.10-chrome-web-store.zip`.
- v1.0.9 multilingual validation: popup JS syntax passed, manifest JSON parsed, all seven locale JSON files parsed, and locale key parity passed with 65 keys each.
- Store zip regenerated for `v1.0.9`: `dist/hype-live-football-scores-v1.0.9-chrome-web-store.zip`.
- v1.0.8 UI polish validation: popup JS syntax passed, manifest JSON parsed, EN locale JSON parsed, and TR locale JSON parsed.
- Store zip regenerated for `v1.0.8`: `dist/hype-live-football-scores-v1.0.8-chrome-web-store.zip`.
- v1.0.7 static validation: Worker JS syntax passed, popup JS syntax passed, smoke-test JS syntax passed, manifest JSON parsed, EN locale JSON parsed, and TR locale JSON parsed.
- v1.0.7 smoke test: `node tools/smoke-test.js` passed against the deployed Worker with `/live-matches` returning `70` matches and `28` leagues, `/league-standings?leagueCode=esp.1` returning a valid standings payload shape, and `/match-detail` returning a current English Premier League detail payload.
- Store zip regenerated for `v1.0.7`: `dist/hype-live-football-scores-v1.0.7-chrome-web-store.zip`.
- Local league logo package: 28 PNG files under `extension/icons/leagues/`, all verified with PNG signatures.
- UI cleanup validation by code scan: non-live grey count badge class removed; completed-only fallback `X Matches` meta removed.
- Worker syntax check: passed.
- Popup JS syntax check: passed.
- Manifest JSON: valid.
- EN locale JSON: valid, 65 keys.
- TR locale JSON: valid, 65 keys.
- Worker deploy: `5a8886ee-e38d-4ed0-a494-33976a76f32f`.
- Extension manifest version: `1.1`.
- `/live-matches`: 2 matches, 28 curated league groups, LaLiga 2 absent, Norwegian Eliteserien absent.
- `/live-matches`: expected logo tones returned for `den.1`, `uefa.europa.conf`, and `usa.usl.1`.
- `/live-matches`: repeated request returned `X-Cache: HIT`.
- `/live-matches`: `Cache-Control: public, max-age=120` in the latest quiet-state smoke test.
- `/live-matches`: security headers verified: `nosniff`, `no-referrer`, `noindex`.
- `/live-matches`: zero embedded standings fields.
- `/league-standings?leagueCode=den.1`: 12 rows across `Group Championship` and `Group Relegation`.
- Immediate repeated `/live-matches` request: `X-Cache: HIT`.
- Browser preview: 26 league cards, status bar updated, keyboard metadata present, no console errors.
- Browser preview: after final refresh pause update, 26 league cards rendered and Austrian Bundesliga detail opened without console errors.
- Store zip regenerated: `dist/hype-live-football-scores-v1.0.0-chrome-web-store.zip`.
- Store zip contents: manifest, popup files, locale files, icons only.
- Store zip regenerated again after adding the 60-second detail-return refresh threshold.
- Popup JS syntax check passed after client live payload cache.
- Browser preview after client cache change: 26 league cards, no console errors.
- Popup JS syntax, manifest JSON, EN/TR locale JSON, and Edit-reference scan passed after removing Edit mode.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after request guardrails.
- EN/TR locale JSON: valid, 64 keys each.
- Browser preview after popup cleanup: Refresh button removed, visible `Live Football` eyebrow removed, one red scrollbar visible, Danish Superliga logo renders on a light tile, no console errors.
- Browser preview after detail-scroll fix: no grey outer scrollbar, no horizontal standings scrollbar, colored W/D/L columns, Lineups fully visible after scroll, News/Links visible in a simple compact form, no console errors.
- Store zip regenerated after request guardrails.
- Invalid league code: `400`.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after the popup-open/favorites/upcoming changes.
- Browser preview after the popup-open/favorites/upcoming changes: normal popup width, no console errors, no team favorite stars, LaLiga standings fit without horizontal scroll, live match Lineups are visible, and upcoming cards show kickoff times instead of `Scheduled`.
- Current ESPN summary probe found useful keys such as rosters, leaders, boxscore/gameInfo, news, videos, commentary, odds, head-to-head, and standings, but no reliable player-rating field.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after match detail stats and accordion changes.
- EN/TR locale JSON: valid, 64 keys each.
- Worker deploy succeeded with version `a70d2e9a-0d66-4e2a-929f-0d2de08a6a33`.
- `/match-detail?eventId=740932&leagueCode=eng.1` returned 18 stats rows plus lineups, commentary, news, and links.
- Immediate repeated `/live-matches` returned `X-Cache: HIT`.
- `OPTIONS /live-matches` returned `204`.
- Chrome Web Store zip regenerated: `dist/hype-live-football-scores-v1.0.0-chrome-web-store.zip`.
- Store assets generated and dimension-verified: 1400x560 marquee, 440x280 small promo, and three 1280x800 screenshots, all `Format24bppRgb`.
- Security scan found no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`, `unsafe-inline`, broad Chrome API permissions, or unsafe external link targets.
- Browser QA after popup scroll-fit change: main list reaches Turkish Super Lig, Swedish Allsvenskan standings reaches row 16, match detail accordion labels have no count badges, and console logs are empty.
- Store zip regenerated again after popup scroll-fit/count-removal changes.
- Popup collapse regression fix: fixed root sizing back to 580x600, static checks passed, browser preview renders a full panel with league cards, and console logs are empty.
- Store zip regenerated again after the popup collapse regression fix.
- Chrome Web Store assets rebuilt after gradient/mock issues: real popup source screenshots captured and cropped, generator rewritten with true rounded screenshot clipping, extra badges/feature cards removed, final five PNGs regenerated and validated as required dimensions with `Format24bppRgb`.
- Chrome Web Store background pass completed: circular glow/blob shapes removed, lineer studio-light gradients added, final five PNGs regenerated and validated as required dimensions with `Format24bppRgb`.
- Chrome Web Store image quality pass completed: popup source captures regenerated at `1160x1200` 2x quality through Chrome headless, final five PNGs regenerated, visual QA showed sharper UI/logos and no right-edge crop.
- Published-extension security pass: Worker CORS wildcard removed and restricted to `chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Worker deploy succeeded with version `d13ea098-08af-493d-a73d-dfbea04b6be3`.
- `/live-matches` latest smoke test after the `v5` deploy returned 1 upcoming match and all 27 curated league groups.
- Local browser preview after the league-list fix rendered all curated leagues, opened English Championship detail, showed the upcoming kickoff on one line, and had no console errors.
- Store zip regenerated for `v1.0.1`: `dist/hype-live-football-scores-v1.0.1-chrome-web-store.zip`.
- Worker deploy succeeded with version `466406ec-1417-4e35-87b3-4c6a431ac324`.
- `/live-matches` after live cache `v6`: `200`, `X-Cache: MISS` on first smoke, `Cache-Control: public, max-age=120`, and returned all 30 curated league groups.
- `/live-matches` after UEFA/logo update included UEFA Champions League as an upcoming match and included UEFA Europa League plus UEFA Conference League as curated league cards.
- `/live-matches` league logos now use ESPN `500` paths by default; Norwegian Eliteserien uses Wikimedia Eliteserien JPG; Conference League uses Wikimedia Conference League SVG.
- Popup JS syntax check, Worker JS syntax check, and manifest version update passed after the UEFA/logo/no-zero-matches changes.
- Local `file://` preview produced no JavaScript console errors, but cannot fetch live data because Worker CORS intentionally blocks `Origin: null`; installed extension runtime is required for live QA.
- Store zip regenerated for `v1.0.2`: `dist/hype-live-football-scores-v1.0.2-chrome-web-store.zip`.
- Header polish update: visible status/updated line removed, brand icon added left of `Hype Scores`, league logo tiles changed from pale/white to dark red glass.
- Upcoming-only league cards no longer render a plain numeric badge next to the favorite star.
- Worker deploy succeeded with version `27ca24d3-928f-4f4e-b709-8c5bb7b25063`.
- Static validation after header/logo update: Worker JS syntax passed, popup JS syntax passed, manifest version updated to `1.0.3`, EN/TR locale keys remain aligned at 64 each.
- Local browser preview after header/logo update showed the brand logo beside `Hype Scores`, no visible status line, and no console errors.
- Store zip regenerated for `v1.0.3`: `dist/hype-live-football-scores-v1.0.3-chrome-web-store.zip`.
- Worker CORS cache-miss fix deployed with version `5a8886ee-e38d-4ed0-a494-33976a76f32f`.
- `/live-matches` with published extension origin returned `200`; `/live-matches` with a random unpacked-style Chrome extension origin returned `200` and echoed that origin in `Access-Control-Allow-Origin`.
- `/live-matches` with `Origin: null` returned `403`; `/live-matches` with no `Origin` returned `403`.
- Popup data-load clarity update: `file://` preview now shows an extension-runtime-required message; first-load local daily-limit failures show the request-limit message.
- Static validation after the data-load clarity update: Worker JS syntax passed, popup JS syntax passed, manifest version is `1.0.6`, and EN/TR locale keys are aligned at 65 each.
- Store zip regenerated for `v1.0.6`: `dist/hype-live-football-scores-v1.0.6-chrome-web-store.zip`.
- Published popup 403 fix deployed with Worker version `e86cbb85-cc11-4dbe-98d8-38dc9df341d9`.
- `/live-matches` with the published extension origin returned `200`.
- `/live-matches` with a normal web origin returned `403`.
- `/live-matches` with a browser-like Chrome no-Origin CORS fetch shape returned `200`, matching Chrome extension host-permission behavior.
- `/live-matches` with raw no-Origin `curl` returned `403`.

## Known Issues
- GitHub repository targeting is resolved to the dedicated private repo `https://github.com/Atakan0zkan/Hype---Live-Scores.git`; keep future Git commands scoped to the project directory.
- Curated league logos are packaged locally, but they still depend on source logo quality/licensing and should be visually rechecked before major store updates.
- Team logos remain remote assets and can still fail independently of packaged league logos; known ESPN gaps can be fixed with narrow Worker overrides when a stable official HTTPS source is available.
- Dark/text-heavy logos use per-league contrast plates; Danish Superliga, UEFA Conference League, and USL Championship currently use light plates.
- ESPN is unofficial and can change response shapes.
- Summary data varies heavily by league and match.
- Some cup competitions may not have useful standings.
- CORS is restricted to Chrome extension origins plus browser-like no-Origin extension fetches; `Origin: null`, normal web-origin, and raw no-Origin smoke tests return `403`.
- Local `file://` preview does not load live data, but now explains that live data requires the Chrome extension popup instead of showing only `Could not load data`.
- No backend-side rate limiting beyond cache and validation; popup has a local 2,000/day guard.
- Chrome Web Store privacy/listing copy has draft text from earlier work and should be reviewed before each store update.
- Packaging script and actual store listing image assets are ready; final store listing copy still needs preparation.
- Deferred audit findings are tracked in `memory-bank/riskBacklog.md`; lazy retry, safe storage helpers, request guard semantics, local league logos, ESPN smoke test, and extension-compatible missing-origin handling have been implemented.
- Team-logo fallback sanitization is now implemented; Cloudflare WAF/rate limiting remains the biggest direct Worker abuse-control follow-up.

## Backlog
- Keep the dedicated GitHub repository remote connected and push future project commits there.
- Run `package-extension-store.bat` after final extension QA to create the Chrome Web Store zip.
- Run a real Chrome unpacked-extension QA pass after each meaningful UI change.
- QA 10-minute auto-pause, 3-minute inactivity pause, 30-minute quiet refresh, power-toggle/reopen resume, and local daily request guard in real Chrome.
- Re-run `package-extension-store.bat` only if more extension runtime files change before upload.
- Decide on remaining deferred audit backlog items, especially stale UX indication, backend WAF/rate limiting, deeper ESPN schema hardening, and extra scoreboard probe tuning.
- Add search/filter by league or team.
- Reintroduce a subtle status/countdown only if users later miss refresh visibility.
- Consider notifications only after adding a proper MV3 service worker.
- Consider Cloudflare WAF/rate limiting if public endpoint abuse appears despite CORS being restricted to the extension origin.
- Consider KV/Durable Object/precompute strategy if traffic grows beyond Free plan comfort.
