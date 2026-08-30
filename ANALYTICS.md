# Analytics architecture

Hype uses Cloudflare Workers Analytics Engine for aggregate product and
reliability metrics. Each existing score API request can contribute one bounded
data point. The schema deliberately excludes raw IP addresses, persistent or
random client identifiers, accounts, favorites, event IDs, browsing history,
and cross-site activity. No analytics-only request is made when the popup opens.

See [PRIVACY.md](PRIVACY.md) for the user-facing disclosure and the
[README dashboard section](README.md#local-analytics-dashboard) for local panel
instructions.

## Google Analytics evaluation

Google Analytics 4 can technically be used by a Manifest V3 extension. Chrome
does not allow remotely hosted code such as `gtag.js`, so Chrome's official
extension guide uses the GA4 Measurement Protocol instead:

- [Use Google Analytics in Chrome extensions](https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4)
- [Send Measurement Protocol events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events)

That standard integration needs a GA4 Web data stream, a Measurement ID, a
Measurement Protocol API secret, and a persistent `client_id` for each browser
installation. Chrome's example stores that identifier in `chrome.storage.local`.
Google also states that the API secret must not be exposed in client-side code.

Hype does not enable Google Analytics in v1.5. A standard GA4 integration would
introduce a persistent installation identifier, additional analytics traffic,
Google as another processor, and new privacy/store disclosure obligations. It
would also duplicate most endpoint, version, country, browser, latency, cache,
and error metrics already available in the Cloudflare dashboard.

Chrome Web Store policy requires transparent disclosure of collected user data
and changed data practices. Applicable law can impose additional requirements;
updating a privacy notice alone must not be treated as a universal substitute
for consent:

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/user_data)

## If GA4 is added later

Use this minimum design:

1. Collect an explicit user choice before enabling GA4 and provide an opt-out.
2. Send only allowlisted, coarse UI events; never send team favorites, event IDs,
   free-form error text, URLs, browsing activity, or other extension data.
3. Proxy Measurement Protocol calls through the Worker and store the API secret
   as a Worker secret. Never package it in the extension.
4. Update `PRIVACY.md`, the Chrome Web Store Privacy practices form, and listing
   disclosures before release.
5. Set a documented retention period and verify GA4 DebugView/Realtime reports
   with test traffic before production rollout.

Required owner-provided values would be the GA4 Measurement ID (`G-...`) and a
Measurement Protocol API secret. They are intentionally not present in this
repository.
