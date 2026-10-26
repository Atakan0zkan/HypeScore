# Security Policy

HypeScore is a public, read-only football score extension. It should not store
API keys, credentials, direct identifiers, or private user data in the
extension. Aggregate Worker request analytics are documented in `PRIVACY.md`.

## Reporting A Vulnerability

Please report security issues through GitHub by opening a private security
advisory when available, or by contacting the repository owner through GitHub.
Do not include exploitable details in a public issue until the issue is fixed.

## Important Notes

- The extension only requests host access for the configured Cloudflare Worker.
- Optional TheSportsDB credentials must be stored as Cloudflare Worker secrets,
  never in extension files.
- Product analytics must not add raw IP addresses, persistent device IDs,
  accounts, favorites, browsing history, or cross-site activity to the Hype
  Analytics Engine dataset.
- The Worker is public and read-only. If traffic grows, protect the deployed
  Worker with Cloudflare WAF or rate limiting.

## Public API trust boundary

The API intentionally serves public football data without accounts. Origin,
User-Agent, client/version labels and monitor labels are not authentication:
non-browser callers can imitate them. Do not place private operations behind
these checks or embed an alleged secret access key in a public extension.

Only the four documented API routes exist. There is no PHP interpreter,
filesystem download route, admin login, account-management endpoint, user
database, or upload handler in this Worker. A path scan cannot retrieve local
developer files or extension storage through a route that does not exist.
This is a code-level boundary, not a blanket guarantee that compromise is
impossible or a substitute for reviewing Cloudflare/GitHub account access.

The custom-domain WAF rejects unknown paths before Worker execution. The
Worker also applies a short-window rate limit using Cloudflare's connecting
IP, currently 240 requests per 60 seconds in each Cloudflare location. Counters
are approximate, shared-IP users can share a budget, and distributed traffic
can exceed a single regional threshold. This protects upstream work, not the
number of already-started Worker invocations. A limiter outage fails open for
availability; input, route, provider and origin guards remain in effect.

Provider requests are confined to pinned HTTPS origins/paths, redirects are
not followed, and JSON bodies have a size/deadline budget. Public errors omit
raw diagnostics. The popup renders provider text without HTML execution and
filters external URLs. These controls are covered by deterministic regressions.

## Incident and release checks

Review suspected compromise using request evidence, account audit/access
history and deployment history; error/invocation counts alone cannot prove a
breach or establish continuous downtime. A clean credential-pattern scan is
not proof that a credential was never exposed in a chat, log or another system.
Rotate externally shared credentials and use least-privilege deployment and
analytics credentials. Never include raw keys in a public issue or memory.

See [the release checklist](docs/RELEASE-CHECKLIST.md) for daily checks, human
review gates and recovery guidance. Third-party Actions are pinned, test
checkouts do not retain Git credentials, and daily incident reporting does not
send raw logs to an AI service.
