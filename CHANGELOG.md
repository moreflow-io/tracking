# Changelog

All notable changes to `@moreflow/tracking` are documented in this file.

## 0.1.1

- Documentation-only release: remove internal maintainer release instructions from the README shown on the npm package page; no code changes.

## 0.1.0

- Initial release, extracted from `@moreflow/forms` so every Moreflow embed package shares one acquisition-tracking implementation.
- `captureAcquisitionTracking` captures utm parameters, ad click ids (`gclid`/`gbraid`/`wbraid`, `fbclid`/`fbp`/`fbc`, `ttclid`/`ttp`), page url, referrer, and user agent, persisted across pages under `moreflow:acquisition:v1`.
- Canonical `AcquisitionTracking` shape plus the `trackingKeys` list and `TrackingKey` type.
- Storage utilities: `StorageLike`, `createMemoryStorage`, `guardStorage`, and `resolveStorage` with a session-lived memory fallback when browser storage throws or is blocked.
