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
- Source-coverage measurement (`npm run test:coverage`). This is a report, not
  proof that every browser path is covered; VM/eval and real-browser coverage
  are different. Do not claim an unmeasured 80% project-wide guarantee.
- Worker build/config validation with Wrangler `deploy --dry-run`.
- Headed Chromium extension E2E under xvfb, with an HTML report and failed-test
  screenshot/trace artifacts retained for seven days. Fixtures are synthetic;
  production credentials and user browsing profiles must not be recorded.

The public production probe is separate: it checks real API availability and
does not load-test the service. The five-minute monitor remains in place.

## Before every version

1. Run `npm run verify -- --release --live`. On a local machine, use a supported
   installed Chromium build; set `E2E_BROWSER_PATH` only when necessary.
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
   result, checkpoint commit, GREEN result, coverage limits and remaining risks.
   Daily CI does not replay the old buggy implementation to manufacture RED.
10. Verify package/manifest versions, review the exact extension ZIP contents,
    exclude development tools/private memory, and compare the archive with the
    reviewed source. A Worker deployment does not update an installed extension.
11. Publish only with owner approval, then verify the exact Cloudflare build and
    all four production API features. Record the deployment and tested revision.
    Revert a faulty release with a reviewed forward revert or known-good Worker
    version; do not reset user work or silently remove security controls.

## ECC workflows

- `verification-loop`: organize the applicable gates and a factual PASS/FAIL report.
- `e2e-testing`: keep stable fixtures, semantic selectors and useful artifacts.
- `production-audit`: review deployment, dependency and operational evidence.
- `security-review`: verify trust boundaries, secrets, input and output handling.
- `tdd-workflow`: reproduce first, fix minimally, prove GREEN, retain evidence.

Human code/translation/UI judgment, account-security review, live regional
observations and the final store-package review cannot be replaced by a daily
green badge. Keep these gates in the project memory and revisit them each release.
