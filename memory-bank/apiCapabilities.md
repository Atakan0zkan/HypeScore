# API Capabilities

## ESPN Scoreboard Endpoint
Endpoint:

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard
```

Useful data already used:
- Match IDs.
- League identity through `event.uid` and season metadata.
- Home/away teams.
- Team IDs and logos.
- Scores.
- Match state: pre, in, post.
- Minute/clock/status.
- Kickoff time.
- Venue information.
- Competition metadata such as broadcasts and details when present.

Current app usage:
- Hot path for `/live-matches`.
- Filtered to curated league IDs only.
- Scheduled fixtures are filtered to a 24-hour upcoming window.
- Normalized into `matches` and grouped `leagues`.
- Does not include standings in the hot response.
- UEFA Champions League (`uefa.champions`) and UEFA Europa League (`uefa.europa`) are supported through ESPN league IDs from the all-scoreboard feed.
- UEFA Conference League (`uefa.europa.conf`) is also curated and has a small direct scoreboard probe because its code is exposed by ESPN pages and its numeric league ID can be less obvious from the all-scoreboard feed.

## ESPN Standings Endpoint
Endpoint pattern:

```text
https://site.api.espn.com/apis/v2/sports/soccer/{leagueCode}/standings
```

Useful data already used:
- `standings.entries`
- `children[].standings.entries` for leagues with grouped/conference tables
- Team name/display name
- Team ID, abbreviation, and logo
- Group/table name and group order
- Rank
- Games played
- Wins/draws/losses
- Goals for, goals against, and goal difference / point differential
- Points
- Points per game
- Deductions when ESPN exposes them
- Overall record summary when ESPN exposes it

Current app usage:
- Lazy Worker endpoint: `/league-standings?leagueCode={leagueCode}`.
- Called only when the user opens a league detail view.
- Cached 30 minutes in Cloudflare Cache.
- Cached in popup memory for the current popup session.
- Standings failures do not block match rendering.

## ESPN Summary Endpoint
Endpoint pattern:

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/{leagueCode}/summary?event={eventId}
```

Observed useful keys:
- `header`
- `boxscore`
- `gameInfo`
- `keyEvents`
- `commentary`
- `standings`

Player-rating note:
- A current live-match summary probe did not reveal a reliable, explicit player-rating field.
- ESPN summary can expose rosters, leaders, boxscore-like stats, commentary, odds, news, videos, and head-to-head data, but rating availability should be treated as unsupported unless a stable field is verified per league.
- `leaders`
- `headToHeadGames`
- `broadcasts`
- `pickcenter` / `odds`
- `rosters`
- `news`
- `videos`
- `meta`

Current app usage:
- Lazy Worker endpoint: `/match-detail?eventId={eventId}&leagueCode={leagueCode}`.
- Called only when the user opens a match detail screen.
- Cached 60 seconds in Cloudflare Cache.
- Cached in popup memory for the current popup session.
- Normalized detail can include timeline, venue, kickoff, broadcasts, match stats, lineups, commentary, head-to-head, news, videos, and links.
- Match stats are normalized from `boxscore.teams[].statistics` into home/away rows such as possession, shots, shots on target, corners, cards, passes, tackles, interceptions, and clearances.
- If ESPN does not provide match links, Worker adds a safe `ESPN Match Center` fallback link from the validated event ID.

## TheSportsDB Fallback
Endpoint:

```text
https://www.thesportsdb.com/api/v2/json/livescore/soccer
```

Current app usage:
- Only used when ESPN scoreboard fails and `THESPORTSDB_API_KEY` is configured.
- Fallback data is normalized into the same match shape where possible.
- League code may be unavailable from this fallback, so standings and summary details are ESPN-only features.

## Implemented Feature Matrix
| Capability | Status | Notes |
|---|---|---|
| Team logos in match cards | Implemented | Uses ESPN team IDs/logos; Cancún FC has a curated official-source override because ESPN team ID `20724` has no CDN logo |
| League logos | Implemented | All 28 curated league logos are packaged locally under `extension/icons/leagues/`; ESPN/Wikimedia URLs remain source inputs for refresh tooling and Worker fallback metadata |
| Full standings | Implemented | Lazy per league, all available rows, groups, team logos, W/D/L/F/A/GD/Pts |
| Match events/timeline | Implemented | Depends on ESPN summary coverage |
| Venue/kickoff | Implemented | Main payload plus detail screen |
| Lineups/rosters | Implemented | Summary coverage varies |
| Commentary | Implemented | Summary coverage varies |
| Head-to-head | Implemented | Summary coverage varies |
| Match statistics | Implemented | Lazy detail section; coverage depends on ESPN boxscore |
| Match detail accordion UI | Implemented | Stats/Timeline/Lineups/Commentary/News/Links are collapsible and use larger readable labels as of v1.0.8 |
| English override toggle | Implemented | UI-only `ENG` toggle forces English labels and returns to Chrome locale when off |
| News | Implemented | Summary coverage varies; popup shows a simple empty state when absent |
| Highlights/videos | Implemented | Summary coverage varies |
| Fallback match center link | Implemented | Added when ESPN summary links are absent |
| Favorite leagues | Implemented | Local only; favorite leagues sort above non-favorites |
| Favorite teams | Removed | Removed to simplify match cards and detail hero |
| Player ratings | Not implemented | No reliable ESPN summary field verified |
| Notifications | Not implemented | Requires extension service worker |
| Search/filter | Not implemented | Could be client-only |
| League tabs | Not implemented | Potential UI improvement |

## Caveats
- ESPN is unofficial, so response fields can change without notice.
- Summary/boxscore/deep match data coverage varies by league and match importance.
- Some cup competitions do not have meaningful standings.
- Fallback TheSportsDB data may not provide ESPN league codes, standings, summary, or logos.
- Extra detail endpoints should stay lazy and never be added to the adaptive main list refresh.
- User-clickable URLs should remain host-restricted; currently ESPN links are limited to `espn.com`, while media assets are limited to `espncdn.com`.
- Worker and popup both enforce HTTPS/ESPN host restrictions for clickable detail links, and Worker sanitizes fallback ESPN logo asset IDs before constructing CDN URLs.
- League logos are packaged locally in the extension, so the main league list no longer depends on remote league-logo image loading at runtime.
- Team logos remain remote display-only images, not remote code; most load from ESPN image providers, while tightly scoped official-source overrides can be used for known ESPN gaps such as Cancún FC.
- Norwegian Eliteserien and LaLiga 2 are currently removed from the curated roster; re-adding either should include a fresh logo QA pass first.
