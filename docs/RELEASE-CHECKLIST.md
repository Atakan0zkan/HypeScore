# Release validation

This project uses deterministic daily checks plus an owner-reviewed release
gate. ECC skills are local development guidance, not autonomous deployment
jobs. Passing tests reduces risk; it is not a security or uptime guarantee.

## Automated daily / push / pull-request checks

- Popup, Worker, monitoring, settings/import/export, locale and security
  regression tests (`npm test`).
- Credential-pattern scan, private-file exclusion and immutable Action refs
  (`npm run security:check`). Findings never print matched credential values.
- Dependency advisories, including development tools (`npm audit`).
- Enforced measured-source coverage (`npm run test:coverage`): at least 90%
  lines, 80% branches and 85% functions. VM/eval and real-browser coverage are
  different; this is not a claim about unmeasured files or every possible path.
- Worker build/config validation with Wrangler `deploy --dry-run`.
- Headed Chromium extension E2E under xvfb, with an HTML report and failed-test
  screenshot/trace artifacts retained for seven days. Fixtures are synthetic;
  production credentials and user browsing profiles must not be recorded.

The public production probe is separate: it checks real API availability and
does not load-test the service. The five-minute monitor remains in place.

## Before every version

1. Run `npm run test:release`. It saves per-phase logs, JSON and a readable
   summary under `test-results/release-gate/`. Candidate and deployed-service
   results are distinct. On Windows an installed Edge/Brave is selected when
   available; `E2E_BROWSER_PATH` overrides it. Linux browser runs need a display
   or `xvfb-run -a npm run test:release`. No browser is installed automatically.
2. Review the entire release diff, permission/CSP changes, third-party URLs,
   error paths, request budgets, cache expiry and rollback plan. Build/typecheck
   steps that do not exist in this plain-JavaScript project are not invented;
   syntax, tests and Worker bundling provide the applicable gates.
3. Check every changed user journey in the actual popup: Small/Default/Big,
   favorite sorting, navigation/scroll restoration, settings backup, details,
   empty/no-data states, offline/429/502 behavior and power-off.
4. Review changed English and translated wording for meaning and naturalness;
   automated token/parity checks cannot certify translation quality. Include
   RTL and long-label checks when relevant.
5. Inspect the live custom-domain WAF rule and deployed rate-limit binding.
   Confirm legitimate requests work and unknown paths are blocked. Do not
   perform a high-volume production test or assume Workers rate limits are
   globally exact; shared-IP/NAT users and regional counters require judgment.
6. Check Cloudflare invocation/error trends and the most recent independent
   health runs. Counts of failed Cron invocations are not measured outages;
   an HTTP 403/404 is not proof of a successful compromise.
7. Review Cloudflare/GitHub account access, scoped API tokens and secret
   rotation needs. Never paste credentials into source, logs or memory.
   An externally shared token should be rotated by its owner; scanning cannot
   prove a token was never disclosed elsewhere.
8. Re-run historical secret scanning (`node tools/security-check.mjs --history`)
   and inspect any finding privately. Do not erase history or revoke unrelated
   access without an explicit decision.
9. Keep a TDD evidence note for behavior changes: user journey, intended RED
   result, GREEN result, coverage limits and remaining risks. Create checkpoint
   commits only when the owner has authorized Git commits; otherwise keep
   local evidence without staging or committing user work.
   Daily CI does not replay the old buggy implementation to manufacture RED.
10. Verify package/manifest versions, review the exact extension ZIP contents,
    exclude development tools/private memory, and compare the archive with the
    reviewed source. A Worker deployment does not update an installed extension.
11. Publish only with owner approval, then verify the exact Cloudflare build and
    all four production API features. Record the deployment and tested revision.
    Revert a faulty release with a reviewed forward revert or known-good Worker
    version; do not reset user work or silently remove security controls.

## Automated feature and regression matrix

| Area | Evidence |
| --- | --- |
| League lists, favorite sorting, popular previews and Live/HT/FT/upcoming labels | Node/DOM regressions and native popup E2E |
| Single score, stats proportions, event icons, pitch/player cards/goals, substitutes, broadcasts and H2H | Native browser fixtures, candidate Worker-to-popup contract, empty/incomplete-lineup fallbacks |
| Combined news/highlights and safe external links | Native browser and sanitizer regressions; no links/email are opened by release checks |
| Power, settings, three sizes, JSON import/export, language override and saved navigation | Storage/DOM/timer tests and native browser round trips |
| 55 locales, plural forms, RTL, long labels and responsive geometry | Locale audit and all-pack Small-size browser checks; semantic translation review remains manual |
| Cold/offline/429/502, bounded snapshots, expiry, coalescing, lazy cache and request budget | Worker/DOM/timer tests plus native cold-error and concurrency scenarios |
| MV3/CSP, minimal permissions, injection, URL/redirect guards, rate limiting and analytics boundaries | Static/package guards, local HTTP security regressions and real-browser CSP test; not penetration testing |
| Resource size, speed and DOM stability | Extension <=4 MiB; each file <=256 KiB; Worker <=256 KiB raw/64 KiB gzip; 930-match redraw median <300ms/p95 <1000ms, league render <750ms and stable DOM over 20 redraws |
| Deployed data and latency | 31 current provider league/event comparisons; real popup settings/standings/available detail/World Cup 2030; three measured warm responses <3000ms on this runner/network |

The release gate refuses zero/insufficient test counts, skipped/todo tests,
flaky browser results, stale/missing browser evidence or a candidate changed
during the run. A limited `--local-only` pass is not deploy readiness. Reports
are local and ignored; credentials are redacted from diagnostic logs.

Live HTTP probes are labeled monitoring. The small real-browser journey uses
the genuine extension request shape to test WAF/CORS and can appear in product
traffic; its responses and headers are not rewritten. Empty provider data is
valid and may leave a feature unobserved live; synthetic candidate fixtures
exercise those paths independently. These are bounded reads, not a load test.

`npm run deploy` is guarded by `predeploy`; raw `npx wrangler deploy`, direct
Cloudflare API calls and Git-linked Cloudflare builds bypass that hook. Changing
remote deployment wiring requires a separate owner-approved operation. No test
command grants permission to deploy, push, merge, alter accounts or publish.

## ECC workflows

- `verification-loop`: organize the applicable gates and a factual PASS/FAIL report.
- `e2e-testing`: keep stable fixtures, semantic selectors and useful artifacts.
- `production-audit`: review deployment, dependency and operational evidence.
- `security-review`: verify trust boundaries, secrets, input and output handling.
- `tdd-workflow`: reproduce first, fix minimally, prove GREEN, retain evidence.

Human code/translation/UI judgment, account-security review, live regional
observations and the final store-package review cannot be replaced by a daily
green badge. Keep these gates in the project memory and revisit them each release.
