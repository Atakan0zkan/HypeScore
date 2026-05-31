# Request Budget And Free Plan Strategy

## Goal
Keep Hype - Live Football Scores realistic for Cloudflare Workers Free plan usage with approximately 500 occasional users. This does not mean 500 always-concurrent users with the popup open all day.

## Cloudflare Request Reduction Strategy
- Main hot endpoint is only `/live-matches`.
- `/live-matches` performs one ESPN scoreboard fetch per cache window, not per user.
- `/live-matches` may perform one small extra ESPN direct scoreboard probe for UEFA Conference League on cache miss; this is still shared by cache and not per user.
- Standings are removed from `/live-matches`.
- Standings are lazy-loaded only when a league detail screen is opened.
- Match detail, including match stats, is lazy-loaded only when a match card is opened.
- Popup refresh is adaptive instead of fixed 15 seconds.
- Popup refresh stops when hidden, powered off, or on any detail screen.
- Popup only refreshes on visibility return if the last successful fetch is older than 30 seconds.
- Returning from a detail screen to the main list only refreshes if the last successful fetch is older than 60 seconds.
- Popup open first checks fresh local live payload cache before making a Worker request.
- Popup auto-refresh stops after 10 minutes of an open session.
- Popup auto-refresh stops after 3 minutes of user inactivity.
- Refresh failures retry with 2 minute, 5 minute, then 10 minute backoff.
- If there are no live or upcoming-within-24h matches anywhere in the payload, the popup enters quiet mode and refreshes every 30 minutes.
- Scheduled matches more than 24 hours away are hidden in the Worker and filtered again in the popup, so far-future fixtures do not keep the app in the 5-minute upcoming refresh tier.
- A local per-user daily guard blocks backend fetches after 2,000 successful backend JSON responses per UTC day.
- The guard records `attempted` requests separately from `successful` responses so aborted, timed-out, failed, or invalid-JSON requests do not prematurely consume the successful daily budget.
- The `ENG` language override is UI-only, re-renders existing data locally, and does not trigger a Worker request.

## Current Worker Cache TTLs
| Resource | TTL | Why |
|---|---:|---|
| `/live-matches` with live matches | 30 seconds | Keeps live data reasonably fresh while sharing upstream fetches |
| `/live-matches` with no live matches | 120 seconds | Reduces idle traffic when there is little urgency |
| `/league-standings` | 1800 seconds | Tables change slowly and do not need frequent refresh |
| `/match-detail` | 60 seconds | Detail pages should be fresher than standings but remain lazy |

## Current Popup Refresh Rules
| State | Behavior |
|---|---|
| Popup first opens | Immediate `/live-matches` request |
| Popup first opens with fresh local cache | Render local payload and skip Worker request |
| Live match exists | Refresh every 60 seconds |
| No live match exists but upcoming matches within 24 hours do | Refresh every 5 minutes |
| No live or upcoming-within-24h matches exist | Refresh every 30 minutes |
| Popup hidden | Stop refresh timer |
| Power toggle off | Stop refresh timer and abort detail request |
| League or match detail open | Stop main refresh timer |
| Popup open for 10 minutes | Stop auto-refresh until popup reopen or power toggle off/on |
| No interaction for 3 minutes | Stop auto-refresh until user interaction or power toggle off/on |
| Refresh failure | Retry after 2m, then 5m, then 10m |
| Daily local successful-response guard reaches 2,000 | Stop backend fetches, show cached data where possible, or show a visible request-limit message when no cache exists |
| Visible again | Refresh only if data is older than 30 seconds |
| Return from detail to main list | Refresh only if data is older than 60 seconds |

## Request Math
Old fixed 15-second refresh:
- 4 requests/minute/user.
- 240 requests/hour/user.
- 500 users for 10 minutes/day could reach about 20,000 popup requests/day before details.
- 500 users for 1 hour/day could reach about 120,000 popup requests/day, above Free plan comfort.

New adaptive refresh:
- Live state: about 1 request/minute/user, or 60 requests/hour/user.
- Upcoming idle state: about 0.2 requests/minute/user, or 12 requests/hour/user.
- Quiet no-live/no-upcoming state: about 2 requests/hour/user while the popup remains active, before the 10-minute session cap stops auto-refresh.
- 500 users for 10 minutes/day:
- Live-heavy usage: roughly 5,000 user-initiated Worker requests/day.
- Idle-heavy usage: roughly 1,000 user-initiated Worker requests/day.
- Lazy standings/details add extra requests only when users click.

With the 10-minute session cap:
- A forgotten popup no longer refreshes indefinitely.
- A single open session can produce at most about 10 automatic live refreshes after initial load, plus explicit user clicks.
- There is no explicit refresh button; any resumed fetch from reopening or power toggle still records an attempted request and only counts toward the 2,000/day stop condition after a successful JSON response.

With quiet mode:
- Inactive leagues do not cause their own requests because the app still uses one global `/live-matches` payload.
- If no league has live or upcoming-within-24h matches, the whole popup can safely wait 30 minutes between auto-refreshes.
- Per-league background polling is intentionally avoided because it would multiply Worker requests.

## Important Nuance
Cloudflare counts Worker requests from users. Cache reduces ESPN upstream subrequests and CPU/time, but the Worker request itself is still counted. Therefore frontend refresh policy matters as much as backend caching.

## Latest Observed Worker Metrics From User
- Requests: 367 during development usage.
- Subrequests: about 3k before the lazy-standings optimization.
- Errors: 0.
- CPU time: low, around 17.79ms aggregate in the screenshot/context.
- Wall time: around 425ms aggregate in the screenshot/context.

## Expected Improvement
- Repeated popup opens within the local cache freshness window can be zero Worker requests.
- Main list no longer fans out to standings subrequests.
- One `/live-matches` request no longer implies many ESPN standings calls.
- Repeated popup refreshes are 4x lower during live periods compared with fixed 15 seconds.
- Repeated popup refreshes are 20x lower during idle/no-live periods compared with fixed 15 seconds.
- Quiet mode is up to 120x lower than the old 15-second loop while the popup remains open.
- Error backoff prevents outage loops from repeatedly hitting the Worker.

## Remaining Free Plan Risks
- 500 always-concurrent users can still exceed Free plan request limits.
- If the extension becomes popular, Worker request count can still grow even with cache hits.
- ESPN may rate-limit or change unofficial endpoints.
- CORS/origin policy is restricted to Chrome extension origins plus browser-like no-Origin Chrome/Edge extension fetches, which prevents normal third-party browser pages, raw no-Origin clients, and local `file://` previews from reading/using the API. The public Worker URL can still be called server-to-server with spoofed allowed-looking headers, so Cloudflare WAF/rate limiting remains the stronger abuse control if traffic grows.
- The 2,000/day successful-response guard is client-side and can be bypassed by a modified extension or direct calls to the Worker.

## Future Guardrails If Traffic Grows
- Add backend-side rate limiting or soft degradation if public endpoint abuse appears.
- Add browser `alarms`/service worker only if notifications are implemented carefully.
- Add Cloudflare KV or Durable Object for precomputed shared payloads if Cache API behavior is insufficient.
- Add a backend-side daily guard or soft degradation mode if traffic grows beyond client-side controls.
- Keep CORS restricted to extension-compatible request shapes and add Cloudflare WAF/rate limiting if abuse appears.
- Add Cloudflare WAF/rate limiting if abuse appears.

## Documentation State
- README now documents the current request-budget model, including adaptive intervals, detail-screen pause, 10-minute session auto-pause, 3-minute inactivity pause, local live cache, and `attempted`/`successful` request guard semantics.
