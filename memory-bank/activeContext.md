# Active Context

## Current Snapshot
- Product: `Hype - Live Football Scores`.
- Version: `1.1` manifest/store package alignment update.
- Worker name: `live-score-football`.
- Worker URL: `https://live-score-football.atakanozkan2001.workers.dev`.
- Chrome Web Store listing: `https://chromewebstore.google.com/detail/hype-live-football-scores/cdnpjnmhmagmiefkleefgchgffeaacaa`.
- GitHub repository: `https://github.com/Atakan0zkan/Hype---Live-Scores.git`.
- Published extension ID: `cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Latest deployed Worker version: `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Extension URL during local preview: `file:///C:/Users/aozka/CascadeProjects/LiveScoreFootball/extension/popup.html`.
- Project is dependency-free and has no build step.
- Memory bank was reviewed and updated after published CORS hardening, all-league list restoration, logo source cleanup, UEFA league additions, popup header/logo polish, league logo visibility cleanup, Worker deploy, packaging, deferred risk-backlog audit, no-Origin Chrome extension fetch 403 fix, local logo packaging, request-guard improvements, smoke-test tooling, v1.0.8 match detail title polish, README documentation refresh, v1.0.9 multilingual locale support, v1.0.10 natural language/listing copy updates, v1.1 manifest/store package alignment, the v1.1 ENG override/security pass, and the Cancún FC team-logo override.

## Latest Implemented Change: Cancún FC Team Logo Override
- Fixed the missing Cancún FC team logo in match cards/details by adding a Worker-side curated team-logo override for ESPN team ID `20724`.
- ESPN summary currently returns Cancún FC with `team.id = 20724` but empty `team.logo/logos`; `https://a.espncdn.com/i/teamlogos/soccer/500/20724.png` returns `404`.
- The override points to Cancún FC's official HTTPS club logo URL: `https://www.cancunfc.mx/cdn/shop/files/LOGOS_CANUN_FC.png?v=1764009552&width=512`.
- Team-logo override URLs are sanitized through `safeHttpsUrl()` and host-allowlisted separately with `TEAM_LOGO_OVERRIDE_HOST_SUFFIXES`, so the ESPN media allowlist is not widened globally.
- Added normalized name matching for `Cancún FC` / `Cancun FC` as a fallback if ESPN omits the team ID in a future payload.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved from `v11` to `v12` and `MATCH_DETAIL_CACHE_KEY_VERSION` moved from `v3` to `v4` so stale cached logo payloads are bypassed after deploy.
- Worker deploy completed successfully: version `e145b8fb-f760-45ac-b0ad-7c0986b59159`.
- Smoke test passed: `/live-matches` returned `5` matches and `28` leagues; `/league-standings?leagueCode=esp.1` returned a valid shape with `0` rows; `/match-detail?eventId=401873711&leagueCode=bel.1` returned KAA Gent vs Racing Genk.
- Direct Cancún verification passed through the deployed Worker: `/match-detail?eventId=401870025&leagueCode=mex.2` returned Cancún FC with the official club PNG URL.
- Security regression check confirmed normal web origin `https://example.com` still receives a controlled `403`.
- No extension runtime file changed for this specific logo fix, so the existing `v1.1` Chrome Web Store package remains current.

## Latest Implemented Change: v1.1 ENG Override And Security Pass
- Added a compact `ENG` button beside the power toggle; it is the same 40px circular size and shows active state when English override is enabled.
- `ENG` forces popup UI labels to the English fallback catalog without changing the user's browser locale; turning it off returns to Chrome's/default locale.
- The override is stored in `localStorage` as `hype_english_override` and re-renders existing popup data locally without triggering a backend request.
- Added localized accessibility labels for the ENG toggle in all seven locale files.
- Moved remaining hardcoded fallback labels such as `Other`, `Unknown Team`, `Team`, and `Unknown League` into locale messages so non-English UI does not mix stray English labels.
- Locale parity now passes with `71` keys in `de`, `en`, `es`, `fr`, `pt_BR`, `pt_PT`, and `tr`.
- Popup match-detail links and highlight links are re-checked against HTTPS `espn.com` before clickable anchors are rendered.
- Worker now sanitizes fallback ESPN league/team logo asset IDs before constructing CDN URLs.
- Worker deploy completed successfully: version `5ca9c033-f559-4f80-914f-602fa05fd230`.
- Smoke test passed: `/live-matches` returned `20` matches and `28` leagues; `/league-standings?leagueCode=esp.1` returned a valid shape with `0` rows; `/match-detail?eventId=740954&leagueCode=eng.1` returned Tottenham Hotspur vs Leeds United.
- Static validation passed: popup JS syntax, Worker JS syntax, manifest JSON, all seven locale JSON files, 71-key locale parity, no DOM HTML injection/eval-like patterns, and zip-root manifest verification.
- Store zip regenerated at `dist/hype-live-football-scores-v1.1-chrome-web-store.zip` without bumping the manifest version.

## Latest Implemented Change: v1.1 Manifest Version Alignment
- Manifest version was changed from `1.0.10` to `1.1` for the next Chrome Web Store package.
- No runtime JavaScript, Worker logic, locale content, permissions, host permissions, or UI behavior changed in this release step.
- README current release metadata and Memory Bank current-state references were aligned to `v1.1`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.1-chrome-web-store.zip`.
- Static validation passed: popup JS syntax, manifest JSON, all seven locale JSON files, and 65-key locale parity.

## Latest Implemented Change: v1.0.10 Natural Language And Store Listing Copy
- Added `store-assets/store-listing-copy.md` with natural Chrome Web Store long-description copy for English, Turkish, German, Spanish, French, Brazilian Portuguese, and European Portuguese.
- Re-reviewed popup locale files for non-literal phrasing and adjusted selected German, Spanish, French, Brazilian Portuguese, European Portuguese, and Turkish strings.
- Examples of wording polish include football-specific labels such as German `Anpfiff`, Spanish `Resúmenes`, Turkish `Başlama saati`, and more user-friendly request-limit wording in Portuguese.
- Manifest version was bumped to `1.0.10`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.10-chrome-web-store.zip`.
- Static validation passed: popup JS syntax, manifest JSON, all seven locale JSON files, and 65-key locale parity.

## Latest Implemented Change: v1.0.9 Multilingual Locale Support
- Added natural Chrome i18n locale files for German (`de`), Spanish (`es`), French (`fr`), Brazilian Portuguese (`pt_BR`), and European Portuguese (`pt_PT`).
- Polished several Turkish strings to sound less mechanical in the popup.
- Kept English as the default locale and kept Chrome locale auto-detection as the language-selection model.
- Localized `action.default_title` by changing it from a fixed English string to `__MSG_extName__`.
- Updated `package-extension-store.bat` so the Chrome Web Store zip copies every `_locales/*/messages.json` folder instead of only `en` and `tr`.
- Manifest version was bumped to `1.0.9`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.9-chrome-web-store.zip`.
- Static validation passed: popup JS syntax, manifest JSON, and all seven locale JSON files.
- Locale key parity passed: `de`, `en`, `es`, `fr`, `pt_BR`, `pt_PT`, and `tr` all have 65 keys.

## Latest Documentation Refresh: 2026-05-11
- README now has a current release section with the Chrome Web Store listing, published extension ID, manifest version `1.1`, current store zip, Worker URL, and latest recorded Worker version.
- README now has a concise feature overview covering curated leagues, local league logos, lazy standings, lazy match details, favorites, multilingual i18n, dark Hype theme, and Free-plan-friendly behavior.
- README project structure now includes `.gitignore`, `AGENTS.md`, `README.md`, `store-assets/`, `tools/`, and `memory-bank/` instead of only the minimal extension/worker tree.
- README adaptive refresh rules now document 60s live, 5m upcoming-within-24h idle, 30m quiet, hidden/off/detail pause, 10-minute session auto-pause, 3-minute inactivity pause, 30s visibility stale threshold, and 60s detail-return threshold.
- README now explains the `attempted` vs `successful` local request guard model and that the 2,000/day pause uses successful backend JSON responses.
- README smoke-test section now includes the latest recorded output and clarifies that 0 standings rows can still be a valid response-shape pass.
- README now includes a local QA checklist for JS syntax, JSON parsing, smoke testing, package regeneration, and real installed-extension QA.
- README production notes now explicitly call out ESPN unofficial API risk, the role of `tools/smoke-test.js`, CORS limits, future Cloudflare WAF/rate limiting, remote team-logo behavior, and manifest bump/package workflow.
- Memory bank files were reviewed and aligned with the current v1.1 state.

## Latest Implemented Change: v1.0.8 Match Detail Accordion Title Polish
- Match detail accordion headings such as Stats, Timeline, Lineups, Commentary, News, and Links were enlarged from `11px` to `13px`.
- Accordion summary padding was adjusted from `12px` to `13px 12px` to keep the larger headings comfortably aligned.
- Letter spacing was slightly reduced from `0.08em` to `0.07em` so uppercase headings remain readable inside the popup width.
- Manifest version was bumped to `1.0.8`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.8-chrome-web-store.zip`.
- Static validation passed: popup JS syntax, manifest JSON, EN locale JSON, and TR locale JSON.

## Current Git/Publish State
- The project now has its own dedicated GitHub repository: `https://github.com/Atakan0zkan/Hype---Live-Scores.git`.
- Use a dedicated `.git` repository inside `C:\Users\aozka\CascadeProjects\LiveScoreFootball`; do not use the parent user-home Git repository for this project.
- The older parent user-home Git repository commit `ea5bb3c Add LiveScoreFootball extension project` is historical only and should not be treated as the project repository.
- `.gitignore` now excludes `.chrome-store-capture-profile/`, `.wrangler/`, `dist/`, and temporary `store-assets/sources/headless-test*.png` files.
- `dist/hype-live-football-scores-v1.1-chrome-web-store.zip` exists locally and is intentionally ignored from Git.
- Future pushes should target `origin` on the dedicated repo above.

## Latest Implemented Change: v1.0.7 Request Guard, Local Logos, Smoke QA
- The extension currently works without a known live popup issue.
- Manifest version was bumped to `1.0.7`.
- Local daily request guard now stores a UTC-day bucket with `attempted` and `successful` counts.
- Backend fetches increment `attempted` before the request starts, but the 2,000/day pause is based on `successful` JSON responses only.
- Aborted, timed-out, non-OK, or invalid-JSON requests no longer prematurely burn the user's successful request budget.
- Legacy request buckets with the old `count` field are migrated safely into both `attempted` and `successful`.
- Added `tools/smoke-test.js` to quickly validate `/live-matches`, `/league-standings`, and `/match-detail` payload shapes against the deployed Worker.
- Added `tools/download-league-logos.ps1` to refresh packaged league PNGs from ESPN CDN and curated Wikimedia redirects.
- Added `extension/icons/leagues/` with local PNG logos for all 28 curated leagues; team logos remain remote ESPN assets.
- Popup league cards now prefer local league logos through `LOCAL_LEAGUE_LOGOS`.
- Removed the muted grey numeric badge beside the favorite star for non-live counts; only live leagues render the bright `LIVE N` badge.
- Removed the fallback `X Matches` meta line for completed-only/result-only leagues.
- Popup red accents were softened to a calmer crimson/coral palette while keeping the dark Hype visual identity.
- README now documents local league logos, the smoke test command, and the `v1.0.7` store package.
- Chrome Web Store zip regenerated at `dist/hype-live-football-scores-v1.0.7-chrome-web-store.zip`.
- Latest smoke test result: `/live-matches` passed with `70` matches and `28` leagues; `/league-standings?leagueCode=esp.1` passed shape validation; `/match-detail` passed against a current English Premier League match.
- Browser visual QA through the in-app Browser tool could not be completed because the tool refuses local `file://` navigation; real installed-extension QA remains the correct live popup test path.

## Latest Implemented Change: Published Popup 403 Fix
- Investigated the Store extension error `Backend returned 403` from `loadMatches()`.
- Root cause: the Worker required an explicit `Origin` header, but Chrome extension fetches with `host_permissions` can arrive without `Origin` while still being legitimate browser-extension requests.
- Worker origin policy now allows valid Chrome extension origins and also allows no-Origin requests only when they look like Chrome/Edge extension/browser CORS fetches: Chrome/Chromium/Edge user agent plus safe `Sec-Fetch-*` shape.
- Normal web origins, `Origin: null`, and raw no-Origin `curl` requests still return controlled `403`.
- 403 JSON responses now include a small `reason` field such as `missing-origin` or `blocked-origin` to make future debugging faster.
- Worker deploy completed successfully: version `e86cbb85-cc11-4dbe-98d8-38dc9df341d9`.
- Smoke tests passed: published extension origin `/live-matches` returned `200`, normal web origin returned `403`, browser-like no-Origin fetch returned `200`, and raw no-Origin `curl` returned `403`.

## Latest Audit Note: Deferred Risk Backlog
- A new `memory-bank/riskBacklog.md` file tracks bug, security, and optimization findings that are not yet approved for implementation.
- The backlog is ordered by likely extension-visible bug risk, highest first.
- Recently completed risk items: lazy standings/match-detail error cache retry behavior, unguarded `localStorage` access paths, Worker raw no-Origin rejection, and no-Origin Chrome extension fetch compatibility.
- Highest-impact remaining security/quota item: Cloudflare WAF/rate limiting for the public Worker URL, because server-to-server clients can spoof request headers.
- Latest audit static checks passed: Worker syntax, popup syntax, manifest JSON, EN locale JSON, and TR locale JSON.
- Latest audit security scan found no DOM HTML injection helpers, eval-like execution, or broad Chrome API permissions.

## Latest Implemented Change: CORS Cache-Miss Data Load Fix
- Fixed a `Could not load data` regression caused by fresh Worker responses not receiving the current request origin on `/live-matches` and `/match-detail` cache misses.
- `getFreshLiveMatchesResponse()`, `refreshLiveMatches()`, `getFreshMatchDetailResponse()`, and `refreshMatchDetail()` now carry the original `request` into `jsonResponse()`, so CORS headers match the calling Chrome extension origin on both cache hits and misses.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved to `v11` to force a clean live-cache miss after the CORS fix.
- Worker now allows any syntactically valid Chrome extension origin (`chrome-extension://[a-p]{32}`), which supports both the published Store extension and local unpacked-extension IDs.
- Worker still rejects `Origin: null`, raw missing-origin requests, and normal web origins, so `file://` browser preview remains blocked for live data by design.
- Worker deploy completed successfully: version `5a8886ee-e38d-4ed0-a494-33976a76f32f`.
- Smoke tests passed: published extension origin `/live-matches` returned `200`, random unpacked-style extension origin returned `200` with matching `Access-Control-Allow-Origin`, `Origin: null` returned `403`, and raw no-origin returned `403`.

## Latest Implemented Change: Popup Data-Load Error Clarity
- Investigated the current `Could not load data` report by reviewing all memory-bank files, Worker code, popup code, manifest, locales, README, and live Worker responses.
- Live Worker `/live-matches` currently returns `200` for the published extension origin and random unpacked-style Chrome extension origins; `Origin: null` and normal web origins remain blocked by design.
- Popup now detects `file://` preview before fetching and shows a specific extension-runtime-required message instead of the generic data-load error.
- Popup first-load daily request-limit failures now show the request-limit message in the visible error card instead of hidden status text plus generic `Could not load data`.
- Added `extensionRuntimeRequired` locale key in English and Turkish.
- Manifest version was bumped to `1.0.6`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.6-chrome-web-store.zip`.
- Static checks passed: Worker JS syntax, popup JS syntax, manifest JSON, and EN/TR locale JSON with 65 aligned keys.

## Latest Implemented Change: Risk Backlog Stability And Origin Hardening
- Lazy standings and match-detail error states now store `failedAt` and automatically retry after 60 seconds when the user revisits/re-renders the section.
- `localStorage` access is centralized through safe get/set/remove/JSON helpers so storage quota, blocked storage, or malformed JSON does not crash popup startup/interactions.
- Worker origin validation now requires an allowed Chrome extension `Origin` header; missing-origin direct requests now return `403`.
- Manual Worker smoke tests now require `Origin: chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Manifest version was bumped to `1.0.5`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.5-chrome-web-store.zip`.
- Worker deploy completed successfully: version `316ebac3-6762-4214-9c6a-7f83b5e08ac1`.
- Deploy smoke tests passed: allowed extension-origin `/live-matches` returned `200`, no-origin `/live-matches` returned `403`, and allowed-origin `OPTIONS /live-matches` returned `204`.

## Latest Implemented Change: League Logo Visibility And Roster Cleanup
- Main league logo tiles were enlarged from `42px` to `56px`; league detail logos were enlarged from `48px` to `66px`.
- League logos now render inside a wrapper plate so the plate background and the actual image can be styled separately.
- Dark/white ESPN logo variants are used for UEFA Champions League, UEFA Europa League, and Australian A-League Men.
- Black/text-heavy fallback logos can request a light contrast plate through `logoTone: "light"`.
- Danish Superliga, UEFA Conference League, and USL Championship currently use the light contrast plate.
- LaLiga 2 (`esp.2`) was removed from the curated roster per user request.
- Norwegian Eliteserien (`nor.1`) was removed from the curated roster because the available fallback image was not stable/pleasant enough for the popup.
- Curated roster is now 28 leagues.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved to `v10` and `CLIENT_LIVE_CACHE_VERSION` moved to `v7` to invalidate stale logo payloads.
- Manifest version was bumped to `1.0.4`.
- Worker deploy completed successfully: version `a190822b-3c1d-4355-8e1a-3952f6f883b4`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.4-chrome-web-store.zip`.
- Smoke test after deploy returned `200`, `X-Cache: HIT` on repeat, `28` leagues, `2` matches, `hasLaLiga2=False`, `hasNorwegian=False`, and expected logo tones for Danish/Conference/USL.
- In-app browser preview showed enlarged logos, Danish/Conference/USL readable on light plates, Champions/Europa readable on dark plates, and no console errors.

## Latest Implemented Change: Popup Header Polish And Logo Tile Cleanup
- The visible header status line (`Updated`, `Not updated yet`, etc.) was removed from the popup UI.
- The extension icon is now displayed as a brand mark to the left of `Hype Scores`.
- Header logo uses a dark red glass tile so it fits the Hype visual language.
- League logo tile backgrounds changed from pale/white to dark red glass, improving white/transparent league logo visibility.
- Upcoming-only league cards no longer show a plain numeric badge next to the favorite star; the upcoming count remains only in the meta text.
- Non-live result cards can still show a subdued count badge; live cards still show the bright `LIVE N` badge.
- Danish Superliga and UEFA Conference League fallback logo URLs use Wikimedia `Special:Redirect` image endpoints with `width=512&type=png` where possible; Norwegian Eliteserien was later removed from the curated roster.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved to `v7` and `CLIENT_LIVE_CACHE_VERSION` moved to `v4` to invalidate old logo payloads.
- Manifest version was bumped to `1.0.3`.
- Worker deploy completed successfully: version `27ca24d3-928f-4f4e-b709-8c5bb7b25063`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.3-chrome-web-store.zip`.
- Local browser preview confirmed the header logo/status removal renders without console errors; live data still requires installed extension runtime because `file://` is CORS-blocked by design.

## Latest Implemented Change: League Logo Cleanup And UEFA Competitions
- Worker league-logo URLs now default to ESPN `500` assets instead of `500-dark`, avoiding white/blank-looking league logos on light logo tiles.
- Norwegian Eliteserien previously used a Wikimedia fallback image, but was later removed because the visual quality was not good enough for the popup.
- UEFA Champions League (`uefa.champions`, ESPN league ID `775`) and UEFA Europa League (`uefa.europa`, ESPN league ID `2310`) were added to the curated league roster.
- UEFA Conference League (`uefa.europa.conf`) was added as a curated league with a stable Wikimedia logo and an extra direct ESPN scoreboard probe for that league code.
- `/live-matches` grouping now keys curated groups by league code, so direct league scoreboards and the all-scoreboard feed merge into the same visible league card.
- Zero-match leagues no longer show `0 Matches` text or a `0` badge in the popup; they remain visible as clean league rows.
- League detail headers also hide the match meta line when a league has no visible matches.
- Empty zero-match league details no longer add the extra `No matches found today.` paragraph before standings.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved to `v6` and `CLIENT_LIVE_CACHE_VERSION` moved to `v3` to avoid stale dark-logo/single-league payloads.
- Manifest version was bumped to `1.0.2`.
- Worker deploy completed successfully: version `466406ec-1417-4e35-87b3-4c6a431ac324`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.2-chrome-web-store.zip`.
- Important QA note: local `file://` preview now cannot fetch live backend data because Worker CORS is intentionally restricted to the published extension origin. Use the installed Chrome extension runtime for live popup QA.

## Current Architecture Focus
- The hot path is intentionally small: popup → `/live-matches` → ESPN scoreboard/cache.
- Standings are lazy: popup league detail → `/league-standings`.
- Match detail is lazy: popup match click → `/match-detail`.
- Frontend refresh policy is now the main Free plan control lever because every popup fetch counts as a Worker request even when Cache API hits.

## Latest Implemented Change: Published Extension Security And League List Fix
- Chrome Web Store extension ID is now known: `cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Worker CORS was changed from wildcard to the published extension origin `chrome-extension://cdnpjnmhmagmiefkleefgchgffeaacaa`.
- Browser requests with a disallowed `Origin` receive a controlled `403` JSON response; a later hardening pass also made direct no-Origin smoke tests return `403`.
- `/live-matches` now returns all 27 curated league groups even when a league has no current match.
- Popup no longer filters out zero-match league groups, so the main list stays complete even on quiet match days.
- League details for zero-match leagues show the existing empty message and can still lazy-load standings.
- Upcoming time badges were widened and forced onto one line so AM/PM does not wrap.
- `LIVE_MATCHES_CACHE_KEY_VERSION` moved to `v5` and `CLIENT_LIVE_CACHE_VERSION` moved to `v2` to avoid stale single-league cache payloads.
- Manifest version was bumped to `1.0.1`.
- Worker deploy completed successfully: version `d13ea098-08af-493d-a73d-dfbea04b6be3`.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.1-chrome-web-store.zip`.

## Latest Implemented Change: Chrome Web Store Image Quality Pass
- Added `tools/capture-store-sources.ps1` to capture the live popup UI through Chrome headless at 2x resolution.
- Source popup screenshots in `store-assets/sources/` are now `1160x1200` `Format24bppRgb` captures instead of lower-resolution `551x600` in-app-browser crops.
- `tools/generate-store-assets.ps1` now uses the full high-resolution source capture and downsamples into store canvases for sharper text/logos.
- Fixed the previous right-edge crop issue where the source screenshot clipped the power button and scrollbar.
- Final store PNGs were regenerated and visually checked again: marquee promo, small promo, and three 1280x800 screenshots.
- Added `.gitignore` entries for Chrome capture profile data and temporary `headless-test*.png` files.

## Previous Implemented Change: Chrome Web Store Asset Rebuild
- Rebuilt Chrome Web Store assets after the previous generated gradients and mock screenshots looked broken.
- Captured real popup source screenshots from the current UI into `store-assets/sources/`: live list, league detail, and match detail.
- Rewrote `tools/generate-store-assets.ps1` to compose real popup screenshots instead of hand-drawn mock cards.
- New promo backgrounds use controlled solid/shape layers rather than the previous gradient-heavy mock style.
- Regenerated final assets: 1400x560 marquee promo, 440x280 small promo, and three 1280x800 screenshots.
- Validated all final store PNGs as `Format24bppRgb` with required Chrome Web Store dimensions.
- Store asset generator was simplified further: removed extra promo pills and feature cards, cropped source screenshots to remove blank lower areas, and uses true rounded clipping for popup screenshot corners.
- Store asset background was refined again to remove visible circular glow/blob shapes; it now uses full-canvas lineer `ColorBlend` lighting, soft diagonal red wash, subtle warm top light, and vignette.

## Latest Implemented Change: Popup Collapse Regression Fix
- Fixed the extension popup opening as a tiny box by removing the `100vh`/viewport-dependent root sizing from `html, body`.
- Popup root sizing is fixed again at `580x600`, which is safer for Chrome MV3 popup runtime sizing.
- Internal scroll areas still keep the safe bottom padding/scroll-padding buffer so the final league card and final standings rows remain reachable.
- Browser preview confirmed the popup renders as a full panel, loads league cards, and has no console errors.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON checks passed after the fix.
- Store zip was regenerated after the popup collapse fix.

## Latest Implemented Change: Accordion Count Removal And Scroll Fit Fix
- Detail accordion headers no longer render numeric counts beside labels such as Stats, Timeline, Lineups, Commentary, News, or Links.
- Removed the now-unused `detail-section-count` styling and `formatSectionCount()` helper.
- Popup width increased from 540px to 580px.
- Popup height is now fixed at 600px to avoid Chrome MV3 popup collapse; do not use `100vh` for the popup root.
- Main league list and league detail scroll areas now have a safe bottom padding/scroll-padding buffer so the last league card and final standings rows can scroll fully into view.
- Store zip was regenerated after these frontend runtime changes.

## Latest Implemented Change: Match Detail Accordions, Stats, Scroll Lock, Store Assets
- Match detail now renders kickoff, venue, and match details above the team-logo/score hero.
- Match stats are normalized from ESPN summary `boxscore.teams[].statistics` and returned from `/match-detail`.
- Detail sections for Stats, Timeline, Lineups, Commentary, News, and Links are collapsible `<details>` sections and default closed.
- Popup document/body scrolling is hardened with CSS `overflow: clip`, fixed body positioning, and a JS document-scroll lock so only the red internal list/detail scrollbar should move.
- `MATCH_DETAIL_CACHE_KEY_VERSION` is now `v3` so old cached detail payloads without `stats` are not reused.
- Worker deploy completed successfully: version `a70d2e9a-0d66-4e2a-929f-0d2de08a6a33`.
- Chrome Web Store assets were generated as 24-bit PNGs in `store-assets/`: one 1400x560 marquee promo, one 440x280 small promo, and three 1280x800 screenshots.
- Store zip was regenerated at `dist/hype-live-football-scores-v1.0.0-chrome-web-store.zip` after the runtime changes.

## Latest Implemented Change: Popup Open Fix, League-Only Favorites, And 24h Upcoming
- Popup root sizing now uses fixed `540x720` dimensions on both `html` and `body`, removing the Chrome popup collapse that could show only a tiny icon-sized panel.
- League logos use tighter padding so badges such as Turkish Super Lig fill their tiles more naturally.
- Match card and match-detail team favorite buttons were removed; only league favorites remain.
- Legacy `hype_favorite_teams` localStorage is cleaned up on startup and no longer affects sorting.
- Favorite leagues remain stored locally and always sort above non-favorite leagues, before live-count sorting.
- Upcoming fixtures are filtered to a 24-hour window in both popup normalization and Worker normalization.
- Upcoming match cards no longer show redundant `Scheduled` status text; they show kickoff time in the time badge and leave the right status pill hidden.
- Standings numbers are slightly larger and numeric columns are tighter/centered to fit without horizontal scrolling.
- Local Worker code bumped `LIVE_MATCHES_CACHE_KEY_VERSION` from `v3` to `v4` for the new upcoming-filtered payload.

## Latest Implemented Change: Detail Scroll, Standings Colors, And Simple Links
- Popup shell grew to about 540x720 and hides document-level scrollbars so only the app's red internal scrollbar remains visible.
- Detail view children are now `flex: 0 0 auto`, preventing match detail sections from shrinking and clipping Lineups, News, or Links content.
- Standings no longer uses horizontal scrolling; the table is compact, fixed-layout, and fits inside the popup.
- Standings W/D/L columns are color-coded: wins green, draws orange, losses muted dark red.
- Match detail News and Links sections render simple empty-state text when ESPN has no rows.
- Worker match detail now guarantees a safe fallback `ESPN Match Center` link when ESPN summary links are absent.
- `MATCH_DETAIL_CACHE_KEY_VERSION = "v2"` prevents old cached match-detail payloads without fallback links from being reused.
- Store zip was regenerated after these extension runtime changes.

## Latest Implemented Change: Popup UI Cleanup And Detailed Standings
- Removed the header `Refresh` / `Yenile` button because refresh is fully automatic and guarded.
- Removed the visible `Live Football` eyebrow text from the popup header while keeping the extension name `Hype - Live Football Scores`.
- Fixed the double-scrollbar bug by enforcing `[hidden] { display: none !important; }`, constraining popup height, and making only the active list/detail area scroll.
- Danish Superliga stays in the curated roster; ESPN currently exposes only a generic placeholder league logo, so the Worker now supplies a Wikimedia-hosted Superliga SVG.
- `/live-matches` now carries `leagueLogoUrl` per match so grouped league cards can use curated/fallback league logos consistently.
- Standings are more detailed: grouped tables are preserved, team logos are shown, and rows include position, team, played, wins, draws, losses, goals for, goals against, goal difference, and points.
- Worker standings normalization also keeps extra values such as group, abbreviation, points per game, deductions, and overall record for future UI use.
- Current live payload audit found zero missing/default team logos in the deployed `/live-matches` response.
- Store zip was regenerated after these extension runtime changes.

## Latest Implemented Change: Popup Request Guardrails
- Automatic main-list refresh now has three activity tiers: 60 seconds when live matches exist, 5 minutes when upcoming-within-24h matches exist, and 30 minutes when there are no live or upcoming-within-24h matches.
- Client-side live payload cache now stays fresh for 30 minutes in the no-live/no-upcoming-within-24h quiet state.
- Popup sessions now auto-pause after 10 minutes to protect against users leaving the popup open.
- Inactivity pause stops refresh after 3 minutes without user interaction.
- Reopening the popup or toggling power off/on starts a fresh 10-minute session window.
- Refresh failures now use backoff delays of 2 minutes, 5 minutes, then 10 minutes instead of immediately returning to the normal interval.
- Added a per-user client-side daily request guard using localStorage: `hype_daily_request_count`, 2,000 backend requests per UTC day.
- The daily guard applies to `/live-matches`, `/league-standings`, and `/match-detail` because they all pass through `fetchJsonWithTimeout()`.
- When the daily guard is reached, stale cached data remains visible where possible and the status bar shows a limit message.

## Latest Implemented Change: Free Plan Request Reduction
- Removed standings from the main `/live-matches` response path.
- Added `GET /league-standings?leagueCode=...`.
- `/league-standings` validates league codes against the curated ESPN league map.
- `/league-standings` returns `{ leagueCode, standings }`.
- `/league-standings` caches for 30 minutes.
- `/live-matches` now uses dynamic cache TTL: 30 seconds when live matches exist, 120 seconds when no live matches exist.
- `LIVE_MATCHES_CACHE_KEY_VERSION = "v4"` prevents old live payloads without `leagueLogoUrl` or the 24-hour upcoming filter from being reused after deployment.
- `STANDINGS_CACHE_KEY_VERSION = "v4"` prevents old standings payloads without expanded stats, group, and team-logo fields from being reused.
- Popup refresh is adaptive: 60 seconds when live matches exist, 5 minutes when upcoming-within-24h matches exist without live matches, and 30 minutes when there are no live or upcoming-within-24h matches.
- Popup refresh pauses when hidden, power off, any league/match detail screen is open, inactive for 3 minutes, or auto-paused after 10 minutes.
- Popup refresh on visibility return only happens if the last successful fetch is older than 30 seconds.
- Popup refresh on returning from detail to the main league list only happens if the last successful fetch is older than 60 seconds, preventing rapid detail/list loops from spiking requests.
- League standings are cached in memory per popup session.

## Latest Implemented Change: Client-Side Live Payload Cache
- Popup now stores successful `/live-matches` payloads in `localStorage` under `hype_live_matches_cache`.
- Cache records include a version (`v1`), saved timestamp, and payload.
- On popup open or power toggle on, the UI hydrates from local cache before calling the Worker.
- Cache is considered fresh for 30 seconds when the cached payload contains live matches.
- Cache is considered fresh for 120 seconds when the cached payload has no live matches but still has upcoming-within-24h matches.
- Cache is considered fresh for 30 minutes when the cached payload has no live or upcoming-within-24h matches.
- Hydrated cache schedules the next refresh based on the payload's real age, not a full interval from the current moment.
- Returning from visibility/detail states also schedules based on remaining refresh delay so interactions do not indefinitely push refreshes forward.
- Cache write failures are caught so quota issues do not break the popup.

## Latest Implemented Change: Chrome Web Store Packaging Script
- Added `package-extension-store.bat` at the project root.
- Script creates a Chrome Web Store-ready zip in `dist/`.
- Zip output name follows manifest version: `hype-live-football-scores-v{version}-chrome-web-store.zip`.
- Script uses a whitelist so only extension runtime files are packaged.
- Required included runtime files: `manifest.json`, `popup.html`, `popup.css`, `popup.js`, plus every `_locales/*/messages.json` folder.
- Optional `extension/icons/` is included automatically if present.
- Worker backend, memory bank, README, and project tooling files are intentionally excluded.
- Script validates that `manifest.json` is at the zip root.

## Latest Implemented Change: Bug Fix, Security, Optimization Pass
- Worker upstream API calls now have an 8 second timeout.
- Worker JSON responses include additional hardening headers.
- Worker CORS allowed headers include `Accept`.
- Worker ESPN clickable links are restricted to HTTPS `espn.com` hosts.
- Worker ESPN media URLs are restricted to HTTPS `espncdn.com` hosts.
- Popup live, standings, and match-detail requests use a shared timeout-aware JSON fetch helper.
- Popup validates JSON content type when present.
- Popup shows a header status line for loading, refreshed, paused, and refresh-failed states.
- Popup preserves stale data on background refresh failures and makes that state visible to the user.
- League cards are keyboard accessible with `role="button"`, `tabIndex`, and Enter/Space activation.
- Favorite buttons now expose `aria-pressed`.
- Power toggle updates its title, aria-label, and aria-pressed based on state.
- Match-detail abort handling avoids clearing a newer in-flight controller from an older request.
- These backend hardening changes remain included in the latest deployed Worker.

## Latest Implemented Change: Edit Mode Removed
- Removed the `Edit` / `Done` league reorder control from the popup header.
- Removed league reorder UI, reorder CSS, reorder locale keys, and `hype_league_order` runtime usage.
- League list ordering is automatic again: favorite league, live match count, then league name.
- EN/TR locale files later increased to 60 aligned keys after detailed standings labels were added.

## Latest Validation
- v1.0.7 static checks passed locally: Worker JS syntax, popup JS syntax, smoke-test JS syntax, manifest JSON, and EN/TR locale JSON.
- `node tools/smoke-test.js` passed against the deployed Worker: `/live-matches` returned `70` matches and `28` leagues, `/league-standings?leagueCode=esp.1` returned a valid standings payload shape, and `/match-detail` returned a current English Premier League match detail.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.7-chrome-web-store.zip` and includes packaged local league logos under `icons/leagues/`.
- Worker syntax check passed.
- Popup JS syntax check passed.
- Manifest JSON parsed.
- English and Turkish locale JSON parsed.
- Locale key count is 65 keys in each locale.
- Latest live endpoint smoke test after logo cleanup returned 2 matches, 28 curated leagues, no LaLiga 2, no Norwegian Eliteserien, and expected `logoTone` values.
- Live endpoint response headers: `X-Cache: HIT`, `Cache-Control: public, max-age=30`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
- Live endpoint response contained zero embedded standings fields.
- Lazy standings smoke test for `den.1` returned 12 rows across `Group Championship` and `Group Relegation`.
- Immediate repeated live request returned `X-Cache: HIT`.
- Invalid `leagueCode` returned `400`.
- In-app browser preview after popup changes showed 26 league cards, status text updated, keyboard metadata present, and no console errors.
- In-app browser preview after final refresh pause update rendered 26 league cards, opened Austrian Bundesliga detail, and showed no console errors.
- Store zip regenerated at `dist/hype-live-football-scores-v1.0.0-chrome-web-store.zip`.
- Store zip contents verified by script: locale files, icons, manifest, popup CSS/HTML/JS only.
- Popup JS syntax, manifest JSON, and locale JSON checks passed after adding the 60-second detail-return refresh threshold.
- Store zip was regenerated again after the detail-return threshold change.
- Popup JS syntax, manifest JSON, and locale JSON checks passed after adding client-side live payload cache.
- In-app browser preview after client cache change rendered 26 league cards and showed no console errors.
- Popup JS syntax, manifest JSON, EN/TR locale JSON, and Edit-reference scan passed after removing Edit mode.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after adding request guardrails.
- EN/TR locale files now have 61 aligned keys after removing the team-favorite locale label.
- In-app browser QA after the detail-scroll fix showed one red scrollbar, no grey outer scrollbar, no horizontal standings scrollbar, visible Lineups content, visible News/Links rows, and no console errors.
- Store zip regenerated again after adding request guardrails.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after the popup open/favorites/upcoming changes.
- In-app browser QA after the popup open/favorites/upcoming changes showed no console errors, normal popup width, no team favorite stars, visible Lineups, no horizontal standings scrollbar, and upcoming cards showing kickoff times instead of `Scheduled`.
- A live ESPN summary probe showed current summary keys such as `boxscore`, `gameInfo`, `headToHeadGames`, `broadcasts`, `odds`, `rosters`, `videos`, `news`, `leaders`, `keyEvents`, `commentary`, and `standings`; no reliable player-rating field was identified.
- Popup JS syntax, Worker JS syntax, manifest JSON, and EN/TR locale JSON passed after match stats and accordion detail changes.
- EN/TR locale files now have 64 aligned keys after adding Stats and empty-section labels.
- Worker deploy succeeded with version `a70d2e9a-0d66-4e2a-929f-0d2de08a6a33`.
- `/match-detail?eventId=740932&leagueCode=eng.1` returned 18 normalized stats rows, timeline, commentary, lineups, news, and ESPN links.
- Immediate repeated `/live-matches` returned `X-Cache: HIT` after the new deploy.
- `OPTIONS /live-matches` returned `204` with CORS headers.
- Security scan found no `innerHTML`, `eval`, `new Function`, `document.write`, broad Chrome API permissions, or unsafe inline script usage.
- Chrome Web Store image validation passed: generated promo/screenshots have required dimensions and `Format24bppRgb`.
- Browser QA after the scroll-fit fix showed the main list can reach Turkish Super Lig at the bottom, Swedish Allsvenskan standings can reach row 16, match detail accordion labels no longer show counts, and console logs were clean.
- Browser QA after the popup collapse regression fix showed the popup renders as a full panel, league cards load, and console logs remain clean.
- Chrome Web Store assets were rebuilt from real popup source screenshots, simplified per user feedback, and all five final PNGs passed dimension/`Format24bppRgb` validation.
- Chrome Web Store background gradients were refined again after visual QA; final PNGs still pass dimension/`Format24bppRgb` validation.
- Chrome Web Store source screenshots were recaptured through Chrome headless at `1160x1200` 2x quality, final PNGs were regenerated, and visual QA showed the right edge is no longer clipped.

## Feature State
- League pick list works and shows logos, meta, and bright live badges.
- League detail works and shows live, results, upcoming, and detailed lazy standings.
- Match cards show team logos and open match detail; they no longer show team favorite buttons.
- Match detail screen works and lazy-loads ESPN summary data without clipping Lineups, News, or Links.
- Favorite league pinning works through `localStorage`; team pinning was intentionally removed.
- Power toggle works and stops refresh behavior.
- Header no longer has an explicit refresh button; refresh is automatic, adaptive, and guard-railed.
- English/Turkish/German/Spanish/French/Portuguese i18n works through Chrome locale files, with a local `ENG` override for English reference labels.
- Extension icons are present in `extension/icons/` and referenced by the manifest.
- Worker CORS and `workers.dev` deployment are working.

## Recent Historical Changes
- Rebranded extension to `Hype - Live Football Scores`.
- Rebuilt popup UI into a dark black-red theme.
- Added curated league filtering and removed low-priority leagues.
- Re-audited league logos and corrected LaLiga, Scottish Premiership, and several other mappings.
- Added ESPN team logos to match cards.
- Added match detail endpoint and UI using ESPN summary.
- Added favorite pinning historically; the current product keeps only league favorites.
- Replaced dim live count dot with bright `LIVE N` / `CANLI N` text badge.
- Expanded standings from 5 rows to all available ESPN rows before moving standings to lazy endpoint.
- Expanded standings again with grouped table rows, team logos, and W/D/L/F/A/GD/Pts columns.
- Fixed the popup double-scrollbar regression in local preview.
- Removed the visible `Live Football` eyebrow from the popup header.

## Active Decisions
- Keep the project dependency-free.
- Keep the extension popup-only until a feature truly needs a service worker.
- Keep English as the default locale, keep supported translations driven by Chrome auto-detected locale, and keep the `ENG` override as a local fallback/reference control.
- Keep Worker CORS restricted to valid Chrome extension origins plus browser-like no-Origin extension fetches unless a future distribution channel requires another explicit origin pattern.
- Keep league favorite data local-only and do not transmit user preferences.
- Keep standings and match detail lazy to protect Free plan usage.
- Keep Danish Superliga and UEFA Conference League on Wikimedia redirect image endpoints because ESPN did not provide reliable curated logos for those tiles.
- Use `logoTone` contrast plates for dark/text-heavy league logos instead of making every logo tile light.

## Known Risks
- ESPN APIs are unofficial and can change without notice.
- ESPN summary coverage varies by league and match.
- Some leagues/cups may not have useful standings.
- 500 always-concurrent users can still exceed Cloudflare Free plan request limits.
- CORS is now restricted to Chrome extension origins and browser-like no-Origin extension fetches; null/web/raw no-origin requests are rejected, but direct server-to-server calls can still spoof allowed-looking headers. Cloudflare WAF/rate limiting remains the stronger abuse-control layer if traffic grows.
- No backend-side rate limiting exists yet; only the popup has a local daily request guard.
- Chrome Web Store privacy/listing text has draft copy from earlier work, but should be rechecked before each store update.
- See `memory-bank/riskBacklog.md` for deferred audit items and decision-pending production hardening ideas.

## Immediate Next Steps
- Reload the unpacked extension in Chrome after local file changes.
- Do a real Chrome extension popup pass, not only `file://` preview; live backend fetches are blocked from local `file://` by origin-restricted CORS.
- Check adaptive refresh behavior in DevTools Network or console if request budget remains a concern.
- QA the 10-minute auto-pause, 3-minute inactivity pause, 30-minute quiet interval, and 2,000/day local guard in real Chrome extension runtime.
- Use the regenerated `v1.1` Chrome Web Store zip after final installed-extension QA; this package now includes the ENG override and security pass.
- Review generated Chrome Web Store images and prepare privacy policy/listing copy if publishing.
- Keep Git operations scoped to the dedicated `LiveScoreFootball` repository.
- Decide whether to implement the remaining deferred risk-backlog items, especially stale UX indication, backend rate limiting, ESPN schema hardening beyond smoke tests, extra scoreboard probe tuning, and Cloudflare WAF/rate limiting.
- Consider a client-side search/filter after the current core flow is stable.

## Memory Bank Notes
- Read all memory-bank files at the start of each future task.
- `requestBudget.md` is the canonical reference for Free plan request math and refresh strategy.
- `testingStrategy.md` is the canonical reference for static/manual validation steps.
- `systemPatterns.md` is the canonical reference for architecture and data flow.
- `riskBacklog.md` is the canonical reference for deferred audit findings that are awaiting user approval.
