# Security Policy

HypeScore is a public, read-only football score extension. It should not store
API keys, credentials, personal data, or private user data in the extension.

## Reporting A Vulnerability

Please report security issues through GitHub by opening a private security
advisory when available, or by contacting the repository owner through GitHub.
Do not include exploitable details in a public issue until the issue is fixed.

## Important Notes

- The extension only requests host access for the configured Cloudflare Worker.
- Optional TheSportsDB credentials must be stored as Cloudflare Worker secrets,
  never in extension files.
- The Worker is public and read-only. If traffic grows, protect the deployed
  Worker with Cloudflare WAF or rate limiting.
