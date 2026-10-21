# Changelog

All notable changes to `@moreflow/tracking` are documented in this file.

## Unreleased

## 0.2.0

- Next minor browser distribution: add the self-contained `dist/browser.js` IIFE (`window.MoreflowTracking`), `@moreflow/tracking/browser` export, and unpkg/jsDelivr entries.
- **Breaking — requires the next minor release (companion SDK migration):** the forms, chatbots, and meetings capture override is consistently named `trackingCapture`, accepting capture options or a callback behind `acquisitionTracking`. Replace their former `trackingOptions`, chatbot `metadataCapture`, and forms session/submission `tracking` options; direct `captureAcquisitionTracking(options)` keeps its API.

- Document the common request-SDK error table and cross-package `isMoreflowError` guard. Tracking itself continues to degrade to memory when storage is blocked and has no SDK error class.

- Fix: repeated captures no longer overwrite the landing `page_url` and `referrer`. Previously each call replaced them (and any UTM parameter or click id in the current URL), so a site that captures on every route change reported its last page instead of the landing page.
- Add `model: 'first-touch' | 'last-touch'`. `'first-touch'` (default) keeps the first visit; `'last-touch'` replaces the stored visit as a whole when a URL carries campaign parameters and keeps it otherwise. `fbp`, `fbc` and `user_agent` follow the current browser in both models.
- Add `persistence: 'session' | 'local'` (default `'session'`) and `ttlDays`. The stored record carries its capture time as `captured_at`; a record without one counts as expired once `ttlDays` is set.
- Add `configureAcquisitionTracking({ persistence, model, ttlDays, persistenceKey })`: page-wide settings for every later capture, including the ones `@moreflow/forms`, `@moreflow/meetings` and `@moreflow/chatbots` make with `acquisitionTracking: true`, and shared by every copy of the package on the page. Per-call options win. Export the `AcquisitionTrackingConfig`, `AcquisitionTrackingModel` and `AcquisitionTrackingPersistence` types.
- Fix: without `window` (server rendering) nothing is shared between calls. Previously the default storage and the blocked-storage fallback were one module-wide memory store, so values captured for one request appeared in later requests for other visitors. `resolveStorage(storage, persistence?)` returns call-scoped memory there.
- `clearAcquisitionTracking()` without `storage` clears the key in both `sessionStorage` and `localStorage`.
- Add `clearAcquisitionTracking({ storage?, persistenceKey? })` to remove the persisted values, for example when a visitor withdraws consent, and export the default key as `acquisitionTrackingStorageKey`.
- Document that `captureAcquisitionTracking` reads Meta's `_fbp`/`_fbc` cookies and writes `sessionStorage`, so it needs the visitor's consent in the EU, and add a stored-data table to the README.
- Correct the 0.1.0 entry: captured values are kept in `sessionStorage`, which lasts only for one tab on one origin, not across tabs or visits.

## 0.1.1

- Documentation-only release: remove internal maintainer release instructions from the README shown on the npm package page; no code changes.

## 0.1.0

- Initial release, extracted from `@moreflow/forms` so every Moreflow embed package shares one acquisition-tracking implementation.
- `captureAcquisitionTracking` captures utm parameters, ad click ids (`gclid`/`gbraid`/`wbraid`, `fbclid`/`fbp`/`fbc`, `ttclid`/`ttp`), page url, referrer, and user agent, persisted under `moreflow:acquisition:v1` in `sessionStorage`, so later pages in the same tab and on the same origin see them (not other tabs or later visits).
- Canonical `AcquisitionTracking` shape plus the `trackingKeys` list and `TrackingKey` type.
- Storage utilities: `StorageLike`, `createMemoryStorage`, `guardStorage`, and `resolveStorage` with a session-lived memory fallback when browser storage throws or is blocked.
