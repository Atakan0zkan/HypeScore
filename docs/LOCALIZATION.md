# Localization

The shipped `extension/_locales/en/messages.json` is the English reference.
The 55 locale packs contain 107 shared messages. Eleven languages also have
48 language-specific match-count forms in total. All strings are bundled;
no translation service is contacted at runtime.

## Editorial rules

- Review English first, Turkish next, then each remaining locale separately.
- Preserve meaning and behavior, not English word order. Keep football terms
  idiomatic and use regional wording where appropriate (for example, European
  and Brazilian Portuguese).
- A round of 32 has 32 teams and 16 ties. It is not a round of 64.
- Half time is the break between halves, not the first half in progress.
- A failed refresh shows the last available data, not necessarily the latest
  data. Do not make an inaccurate freshness promise in a translated notice.
- Standings means the league ranking, not furniture; head-to-head means
  previous meetings between the two teams.
- Favorite-star tooltips describe an action. Importing settings replaces the
  saved leagues and popup size, rather than merging the favorite lists.
- Preserve every `$COUNT$` substitution and its `count: { content: "$1" }`
  declaration. Do not translate the Hype brand, team names or player names.
- Do not infer missing match information or promise that unavailable data will
  appear later. News headlines and free-form provider descriptions remain in
  their source language rather than being loosely machine-translated.

## Match counts

The popup uses `Intl.PluralRules` for the bundled languages whose integer
counts need more than a one/other distinction. Optional `Few`, `Two` and
`Zero` messages supplement the four existing count families. Where a category
shares the ordinary plural wording, the existing plural message is used.
Arabic uses natural category labels followed by a count, avoiding an incorrect
one-size-fits-all noun ending. ENG override always uses English count grammar.
It also uses English date/time formatting. Normal mode keeps the browser's
regional date/time conventions.

Known short and long provider status codes (FT/Full Time, HT/Half Time,
Scheduled and Live) use the existing localized messages. A playing half
(1H/2H), a numeric match clock or unrecognized provider prose is preserved;
it must not be misrepresented as a half-time break.

## Validation

Run `npm run test:i18n` for key coverage, placeholders, regional English
consistency, count examples and regression cases for known mistranslations.
These tests also run in `npm test` and `npm run test:fast`.

The browser suite (`npm run test:e2e`) renders all 55 packs at the Small size,
checks RTL direction, settings and standings headings, and opens match details.
It uses test-only localization stubs; it does not change the user's browser
language. Representative screenshots are written to ignored `test-results/`.
Separate temporary profiles also verify native Chromium localization for
English, Turkish, Russian, Polish, Slovenian and Arabic, including count
messages and the ENG override without localization stubs.

The old ignored `tools/i18n-source/` and seed scripts predate the current
messages. Do not regenerate the shipped packs from those stale inputs.

The 2026-10-24 pass is a contextual editorial review, not a certification by
native-speaking reviewers of all 55 locales. Native review remains the final
quality gate for publication-critical wording in an unfamiliar language.
See [the per-locale review record](LOCALIZATION-REVIEW.md) for complete
coverage, the frozen English reference and the final validation results.
