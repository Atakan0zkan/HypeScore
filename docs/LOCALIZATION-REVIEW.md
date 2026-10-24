# Localization review — 2026-10-24

## Scope and method

Every message value in every shipped locale was read in sequence against the
English reference and checked in its football/UI context: labels, tooltips,
empty states, errors, settings, statistics headings, knockout rounds and all
match-count variants. This was an editorial review, not a bulk replacement
or a translation-service call.

Coverage: **55 of 55 locale packs; 5,933 of 5,933 messages**. Each pack has
107 shared reference messages; eleven packs have 48 additional count forms
between them. No translation key was omitted from the review.

The second contextual pass refined **425 existing message values**, after the
initial translation correction pass. An unchanged entry was still reviewed;
correct regional wording and established football/technology terms were kept.

English was frozen for this second pass. SHA-256 of the ordered English
key-to-message map (UTF-8, JSON without extra whitespace):

`0fd4f8ecff17868971da7c34a99d5959277a53c3583abbbb66fc5174a2fb67f6`

## Sequential coverage record

“Values” includes optional count forms. “Refinements” counts existing values
changed during the second contextual pass only, not the entire Git diff.
All entries below are complete.

| Order | Locale | Values | Refinements | Context checked / result |
| --- | --- | ---: | ---: | --- |
| 1 | en | 107 | 0 | Frozen English reference; all message meanings and runtime contexts checked. |
| 2 | en_US | 107 | 0 | All messages compared with English; regional spelling and kick-off/round-name variants retained without semantic changes. |
| 3 | en_GB | 107 | 0 | All messages compared with English; regional spelling and kick-off/round-name variants retained without semantic changes. |
| 4 | en_AU | 107 | 0 | All messages compared with English; regional spelling and kick-off/round-name variants retained without semantic changes. |
| 5 | tr | 107 | 4 | All messages reviewed in their interface context; naturalized the upcoming heading, refresh failure, request limit and match timeline. |
| 6 | am | 107 | 6 | Reviewed all text and abbreviations; clarified last-received data, request reduction and export actions; replaced beginner-like wording for Starting XI with football starting-lineup usage. |
| 7 | ar | 107 | 4 | Reviewed all RTL labels, count labels and sentences; clarified last-available data, automatic-refresh pause, lineup heading and replace-on-import wording. |
| 8 | bg | 107 | 6 | Reviewed all text including abbreviations; corrected halftime versus a playing half, broadcast terminology and natural request-limit/pause wording. |
| 9 | bn | 107 | 13 | Reviewed every label and sentence; removed literal bracket wording, clarified unavailable details/statistics and the last-received-data message. |
| 10 | ca | 107 | 7 | All shared messages checked; clarified last-available data, previous meetings, halftime and idiomatic future-fixture count phrasing. |
| 11 | cs | 111 | 5 | All shared and few-count messages checked; clarified the finished status, goals-difference abbreviation, live-empty text and automatic-refresh purpose. |
| 12 | da | 107 | 7 | All messages checked; made knockout-bracket, pause, language-choice and import wording idiomatic; removed the newest-data implication. |
| 13 | de | 107 | 7 | All messages checked; used standard tournament-bracket wording, clarified pause/last-available data and the remove-from-favorites action. |
| 14 | el | 107 | 7 | All messages checked; live-game wording now means in progress rather than a literally living match; refresh-failure availability and request-reduction meaning clarified. |
| 15 | es | 107 | 6 | All Spain-Spanish messages checked; preserved en directo and regional terms, clarified available cached data and idiomatic upcoming-match/history wording. |
| 16 | es_419 | 107 | 7 | All Latin-American Spanish messages checked independently; preserved en vivo, clarified standings and last-available data, and naturalized future-match phrasing. |
| 17 | et | 107 | 11 | All messages checked; distinguished standings abbreviations, halftime break and knockout round, and clarified ongoing-match and last-received-data wording. |
| 18 | fa | 107 | 5 | All RTL text, counts and standings terms checked; clarified temporary pause, daily limit, undecided status and last-received data without promising freshness. |
| 19 | fi | 107 | 9 | All messages and Finnish match-count cases checked; standardized knockout-stage wording, finished status and precise request/cache explanations. |
| 20 | fil | 107 | 3 | All messages checked; retained natural Filipino football/technology loanwords, distinguished today from now and corrected newest-data wording. |
| 21 | fr | 107 | 5 | All messages checked; clarified file-preview scope, previous meetings, league naming and last-available data while preserving feminine window-size forms. |
| 22 | gu | 107 | 10 | All labels, notices and count messages checked; clarified goal difference, previous meetings, initial players and accurate pause/cache language. |
| 23 | he | 107 | 15 | All RTL text and counts checked; removed live-video implications from live-score labels, clarified halftime, standings abbreviations and last-received data. |
| 24 | hi | 107 | 9 | All text and numerical noun forms checked; naturalized notices, historical meetings, timeline and goals-difference/statistics wording. |
| 25 | hr | 111 | 4 | All shared and few-count forms checked; retained idiomatic squad/round terminology and corrected empty-state and last-available-data explanations. |
| 26 | hu | 107 | 5 | All messages and invariant numerical nouns checked; clarified available-data notice, English display action and substitute-player wording. |
| 27 | id | 107 | 6 | All messages checked; translated the undecided acronym, clarified played/favorites labels and used an idiomatic football halftime phrase. |
| 28 | it | 107 | 7 | All messages checked; preserved standard football round/lineup terms, clarified preview/pause wording and aligned window-size grammatical gender. |
| 29 | ja | 107 | 16 | All messages checked; removed newest-data and hard-to-use-detail implications, clarified the members heading and made count spacing consistent. |
| 30 | kn | 107 | 7 | All text checked; clarified goal difference and past meetings and corrected literal request-saving/newest-data sentences. |
| 31 | ko | 107 | 13 | All text and invariant count labels checked; distinguished in-progress scores from video, ranking tables from a single rank, unavailable detail and replacing saved settings. |
| 32 | lt | 111 | 5 | All shared and few-count forms checked; preserved plural-only rungtynes grammar and clarified final results, real-time data and last-received data. |
| 33 | lv | 111 | 16 | All shared and zero-count forms checked; distinguished scored/conceded goals and standings, and made in-progress game wording independent of broadcasting. |
| 34 | ml | 107 | 13 | All messages checked; naturalized request/pause/last-received-data notices, prior meetings and software import/export vocabulary. |
| 35 | mr | 107 | 17 | All text checked; corrected genitive/plural agreement, match-history wording, last-received data and familiar software import/export terminology. |
| 36 | ms | 107 | 12 | All messages checked; clarified team-count rounds and the final, ongoing games versus broadcasts, and retained the conventional UI term lalai for default. |
| 37 | nl | 107 | 5 | All messages checked; retained idiomatic football/knockout terms, distinguished played from draws and corrected compound spelling and favorite/language actions. |
| 38 | no | 107 | 5 | All messages checked; retained Norwegian round/squad vocabulary, clarified last-available data and consistent bracket/favorite actions. |
| 39 | pl | 111 | 0 | All 111 shared/few-form messages checked; existing Polish wording and count agreement were already accurate and were retained. |
| 40 | pt_BR | 107 | 4 | All Brazilian Portuguese text checked; preserved mata-mata/time/arquivo vocabulary, clarified cached-data notice and an unambiguous 32-team round label. |
| 41 | pt_PT | 107 | 4 | All European Portuguese text checked independently; preserved equipa/ficheiro/definicoes and validated the 16-avos stage; removed the scorer/score ambiguity from the description. |
| 42 | ro | 111 | 5 | Romanian football bracket/lineup vocabulary, last-available-data meaning, and file-import replacement wording checked. |
| 43 | ru | 111 | 11 | Russian live-score labels no longer imply video broadcasts; count agreement, last available data, and import wording reviewed. |
| 44 | sk | 111 | 15 | Slovak half-time is explicitly a break; natural request/status phrasing and all few forms checked. |
| 45 | sl | 115 | 6 | Slovene half-time break, distinct played/points abbreviations, dual/few forms, and last-available-data wording checked. |
| 46 | sr | 111 | 8 | Serbian native tournament-tree wording, last available data, all few forms, and natural import/status notices checked. |
| 47 | sv | 107 | 11 | Swedish compounds, football tree terminology, localized full/half-time labels, and last-fetched-data meaning checked. |
| 48 | sw | 107 | 6 | Swahili noun/count agreement, ongoing-match terminology, goal-difference abbreviation, and natural request notices checked. |
| 49 | ta | 107 | 18 | Tamil plural agreement, ongoing/upcoming/finished count word order, last-received-data meaning, and match-history terminology checked. |
| 50 | te | 107 | 12 | Telugu action politeness, goal-stat headings, match-history wording, and last-received-data meaning checked. |
| 51 | th | 107 | 13 | Thai classifiers/counts, tournament chart terminology, head-to-head wording, and last-fetched-data meaning checked. |
| 52 | uk | 111 | 5 | Ukrainian football spelling, all few forms, last-available-data meaning, and import replacement wording checked. |
| 53 | vi | 107 | 13 | Vietnamese concise football statuses, match details/history wording, recap label, and last-fetched-data meaning checked. |
| 54 | zh_CN | 107 | 6 | Simplified Chinese football terms, explicit half-time break, natural request wording, and last-fetched-data meaning checked. |
| 55 | zh_TW | 107 | 11 | Traditional Chinese uses Taiwan UI vocabulary (extension, import/export, refresh, details, final whistle); last-fetched-data and half-time meaning checked. |

## Runtime and validation

- The English fallback matches all 107 English reference messages.
- Required keys, duplicate keys, placeholder tokens/declarations, optional
  count families and Chrome manifest text limits are checked automatically.
- CLDR integer count forms are tested for the eleven affected languages;
  Arabic uses invariant category labels. ENG override uses English grammar.
- FT/HT and their known long/status-code aliases use the localized full-time
  and half-time messages. Numeric clocks, 1H/2H, and unrecognized provider
  text are not guessed or relabeled as a half-time break.
- ENG override also selects English date/time formatting. Normal mode keeps
  the browser's regional conventions and the user's time zone.
- `npm run test:i18n`: 37 tests passed; locale audit reported zero issues.
- `npm test`: 208 tests passed, plus Worker regression, hardening and
  analytics-dashboard regression checks.
- Browser validation uses a temporary unpacked extension in Microsoft Edge
  (Chromium), with deterministic API fixtures. All 55 packs were rendered at
  Small size; translated settings, standings, details, finished status and
  RTL direction were checked. Separate real-language profiles covered en,
  tr, ru, pl, sl and ar without localization stubs. All 17 browser tests
  passed with zero captured console/page errors.
- Representative screenshots are local, ignored test artifacts in
  `test-results/`; the screenshots are not extension package assets.
- `git diff --check` passed with no whitespace errors.

These automated checks establish coverage and runtime/layout behavior, not
native-speaker fluency. This editorial pass is **not certification by native
reviewers of all 55 locales**; native review remains an additional quality
gate for publication-critical wording in an unfamiliar language.

## Data-provider boundary

The review covers every bundled translation message. Brand, club, league and
player names remain proper names. Provider-supplied news headlines, video
titles, event descriptions, statistic labels and unknown status codes remain
in their source language; no automatic prose translation or invented match
information is introduced. This report does not claim to have translated
all dynamically supplied content into 55 languages.

## Targeted terminology references

These sources corroborate selected terms; they are not blanket linguistic
certification of a locale. No source text is copied wholesale into the packs.

- am: [terminology source](https://www.soccerethiopia.net/football/63445/) — Native football usage of lineup and starting lineup.
- mr: [terminology source](https://support.google.com/chrome/answer/96816?hl=mr) — Established Chrome UI usage of import/export vocabulary.
- ms: [terminology source](https://support.google.com/chrome/answer/96816?hl=ms) — Conventional Malay browser terminology; corroboration only, not native-speaker certification.
- pt_PT: [terminology source](https://www3.fpf.pt/pt/News/Todas-as-not%C3%ADcias/Not%C3%ADcia/news/53822) — Portuguese federation usage of 16-avos for the knockout stage with 32 teams.
- sr: [terminology source](https://kss.rs/komentar-selektora-svetislava-pesica-na-ishod-zreba-za-svetsko-prvenstvo-2023/) — Serbian federation use of kostur for a tournament progression, distinct from the draw itself.
- sv: [terminology source](https://www.svenskfotboll.se/nyheter/landslag/2025/11/infor-lottning-playoff-vm-2026/) — Swedish federation use of slutspelsträd for the knockout tournament chart.
- uk: [terminology source](https://uaf.ua/files/2026/%D0%9F%D0%BB%D0%B5%D0%B9-%D0%BE%D1%84-%D0%B2%D1%96%D0%B4%D0%B1%D0%BE%D1%80%D1%83-%D0%A7%D0%A1-2026-%D0%9E%D1%84%D1%96%D1%86%D1%96%D0%B9%D0%BD%D0%B0-%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%B0-%D0%BC%D0%B0%D1%82%D1%87%D1%83-%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B0-%D0%A8%D0%B2%D0%B5%D1%86%D1%96%D1%8F.pdf) — Ukrainian association official match programme uses the spelling плей-оф and shows the progression chart.
