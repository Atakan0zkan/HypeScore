# Product Context

## Why This Exists
Hype - Live Football Scores gives football fans a fast, low-friction way to check live scores, results, upcoming fixtures, and key match context without opening a full sports website. The product should feel like a polished mini score center, not a raw API dump.

## Target User Experience
- User opens the popup and sees a curated league list immediately.
- Leagues are grouped as top-level cards with packaged local PNG logos for consistent visibility in the popup and store screenshots.
- Live leagues are visually obvious with bright `LIVE N` / `CANLI N` badges.
- League meta reads like `X upcoming · Y live` so the user understands active/upcoming activity at a glance.
- Completed-only leagues no longer show a muted `X matches` line or grey count badge, keeping quiet/result-only rows cleaner.
- Opening a league shows live matches first, then results, then upcoming fixtures.
- Opening a league also lazy-loads the full table when ESPN supports standings for that league.
- Clicking a match opens details such as venue, kickoff, events, match stats, lineups, commentary, head-to-head, news, highlights, and ESPN links where available.
- Match detail accordion headings are intentionally larger than the old tiny label style so Stats, Timeline, Lineups, Commentary, News, and Links are readable at popup size.
- Favorite league stars let users pin what they care about without sending preferences to the backend.
- Favorited leagues always appear at the top of the league list.
- Fresh local score cache makes repeated popup opens feel instant and avoids unnecessary Worker requests.
- Power toggle gives the user a clear way to pause the extension and stop refreshes.
- Long-open popup protection stops automatic refresh after 10 minutes so forgotten popups do not burn Free plan quota.
- The popup uses a fixed 580x600 root size with one internal red scrollbar and a dark, sporty black-red visual direction.
- The red palette should stay readable and premium, using muted crimson/coral tones instead of harsh neon red.

## Language Experience
- English is the default locale.
- Turkish is provided through Chrome's `_locales/tr/messages.json`.
- German is provided through Chrome's `_locales/de/messages.json`.
- Spanish is provided through Chrome's `_locales/es/messages.json`.
- French is provided through Chrome's `_locales/fr/messages.json`.
- Portuguese is provided through Chrome's region-specific `_locales/pt_BR/messages.json` and `_locales/pt_PT/messages.json`.
- The popup has a compact `ENG` toggle beside the power button. When active, it forces English UI labels for translation fallback/reference checks; when inactive, Chrome locale decides again.
- The `ENG` override is stored locally and does not change request behavior or send language preferences to the backend.
- Local `file://` preview has fallback English labels because `chrome.i18n` may not be available outside extension runtime; live data is intentionally blocked there and the popup now explains that the real Chrome extension popup is required.

## Product Choices
- The extension is dependency-free for simplicity and easy inspection.
- The popup is the whole product surface; no content scripts or background service worker are used yet.
- The league roster is curated to 28 leagues to keep the UI relevant and reduce noise from ESPN's broad `all/scoreboard` feed.
- League logos are bundled locally for the curated league roster; team logos remain remote image assets because bundling every team logo would be high-maintenance.
- Upcoming fixtures are intentionally limited to matches within the next 24 hours so far-future scheduled games do not clutter the popup or keep the app in a higher refresh tier.
- Removed leagues: Dutch Vrouwen Eredivisie, NWSL, Cypriot First Division, Chinese Super League, Spanish Liga F, UEFA Women's Champions League, LaLiga 2, Norwegian Eliteserien.
- Standings are not part of the main score payload because they are heavier, less time-sensitive, and not needed until a league is opened.
- Match details are not part of the main score payload because summary data is deeper, less consistently available, and only relevant after a click.
- Live score payload cache is stored locally because it is public read-only scoreboard data and avoids repeated same-user requests.
- Free plan viability matters more than 15-second freshness; current accepted freshness is 60 seconds during live states, 5 minutes when upcoming matches exist, and 30 minutes when there are no live/upcoming matches.

## Request Budget Product Assumption
- The Free plan target is 500 occasional users, not 500 people keeping the popup open all day.
- With 10 minutes of daily usage per user, adaptive refresh should be much closer to Free plan limits than the old 15-second loop.
- If a user keeps the popup open, automatic refresh stops after 10 minutes and can be restarted by reopening the popup or toggling power off/on.
- Main list freshness is acceptable at 60 seconds because live-score users still get timely status without multiplying Worker requests.

## Visual Direction
- Brand name: `Hype - Live Football Scores`.
- Theme: premium dark sports dashboard, black/red, high-contrast live badges.
- Avoid pale or default-looking UI.
- Preserve clarity over decorative density because popup real estate is limited.

## Known UX Tradeoffs
- Standings may show a loading/empty/error state independently from match cards.
- Some leagues have fallback logos or custom contrast plates because ESPN does not expose reliable assets or because dark/text-heavy logos become unreadable on the dark Hype theme.
- Some teams can need narrow logo overrides when ESPN exposes a team ID but no image asset; Cancún FC is currently mapped to the club's official HTTPS PNG in the Worker.
- Local league logos reduce broken/white logo issues, but they should still be rechecked visually before major store screenshot updates.
- Match detail secondary sections are collapsible and default closed so long live-match details stay readable in the popup.
- Detail accordion headings should stay prominent enough to scan quickly; avoid shrinking them back to the earlier 11px label size.
- Some match detail sections may be absent because ESPN summary coverage varies by match and league.
- ESPN summary data currently exposes rosters, leaders, boxscore-like stats, news, videos, commentary, odds, and head-to-head where available, but no reliable SofaScore-style player rating field has been verified.
- Chrome Web Store promo images and screenshots are generated from real popup screenshots in the dark Hype visual direction; privacy copy is still separate.
- Chrome Web Store long-description copy is prepared per supported language in `store-assets/store-listing-copy.md` and should be used when filling localized Store listing fields.
