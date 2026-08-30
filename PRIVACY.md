# HypeScore Privacy Notice

Last updated: 2026-08-30

Hype - Live Football Scores does not require an account and does not use
advertising trackers, analytics cookies, or a persistent device identifier.
It does not collect browsing history, favorite leagues, or activity outside
the extension.

## Data used to operate and improve Hype

The extension requests public football data from the Hype Cloudflare Worker.
Cloudflare necessarily processes network information, including IP address,
to deliver and protect those requests. Cloudflare hostname analytics may
provide aggregate visit estimates. These are traffic metrics, not an exact
count of people or devices.

For product reliability and aggregate feature usage, the Worker writes one
Analytics Engine data point for each existing functional API request. It may
contain:

- requested Hype API feature or endpoint;
- two-letter country code and Cloudflare data-center code;
- static extension client label and manifest version;
- broad browser family and major version;
- response status, cache result, data source, and response duration;
- league code when a standings, match-detail, or bracket request includes it;
- request method and whether the request matched the extension origin policy.

The Hype product analytics dataset does **not** contain raw IP addresses,
persistent or randomly generated client identifiers, event or match IDs,
accounts, favorites, page URLs, browsing history, or cross-site activity.
No additional analytics-only request is sent when the popup opens.

## Purpose, sharing, and retention

These limited aggregate metrics are used to understand feature demand,
diagnose errors, monitor response time and cache effectiveness, plan capacity,
and improve the extension. They are not used for advertising, profiling,
selling data, or tracking users across services.

Cloudflare processes the API and analytics infrastructure as the service
provider. Hype does not send product analytics to Google Analytics or another
advertising analytics provider. Workers Analytics Engine retains written data
for three months under Cloudflare's current service limits.

## Local extension data

The power setting, favorite leagues, English override, request budget, and
short-lived public score cache remain in the extension's local storage. They
are not sent to the Hype analytics dataset.

## Choices and contact

You can stop all API requests by turning off the extension or uninstalling it.
Questions about this notice can be sent to the repository owner through
[GitHub](https://github.com/Atakan0zkan/HypeScore). Because Hype does not create
a persistent user identifier, the aggregate product dataset cannot normally
be searched or exported by a specific person or device.

This notice should be read together with the disclosures in the Chrome Web
Store Privacy practices section.

---

## Türkçe Özet

Hype hesap, reklam takipçisi, analitik çerez veya kalıcı cihaz kimliği
kullanmaz. Uygulamanın zorunlu API isteklerinden; kullanılan özellik, uygulama
sürümü, toplu ülke/tarayıcı bilgisi, cevap durumu ve süresi gibi sınırlı
istatistikler üretilir. Hype analiz veri kümesine ham IP adresi, favoriler,
tarama geçmişi veya siteler arası hareketler yazılmaz. Cloudflare ağ hizmetini
sunabilmek için IP adresini işler ve API hostname'i için yaklaşık ziyaret
istatistiği sağlayabilir; bu değer kesin kullanıcı veya cihaz sayısı değildir.
