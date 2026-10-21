# `@moreflow/tracking`

Browser-safe acquisition tracking helpers shared by Moreflow public embeds.
The package captures campaign identifiers, referrer, and browser context while
gracefully handling blocked third-party storage.

```ts
import { captureAcquisitionTracking } from '@moreflow/tracking';

const tracking = captureAcquisitionTracking();
```

It contains no UI, framework, or network code.

## Script tag

The self-contained classic IIFE exposes the same runtime helpers as
`window.MoreflowTracking`, without a bundler or import map:

```html
<script src="https://cdn.jsdelivr.net/npm/@moreflow/tracking@VERSION/dist/browser.js"></script>
<script>
  // Call after the visitor grants attribution consent.
  window.MoreflowTracking.configureAcquisitionTracking({ model: 'first-touch' });
  window.MoreflowTracking.captureAcquisitionTracking();
</script>
```

Replace `VERSION` with the exact published release that includes this build.
The browser build is also exported as `@moreflow/tracking/browser` and selected
by the package's unpkg and jsDelivr entries. Pin the exact published version
that includes the browser build and update it deliberately when upgrading.
Allow the CDN in your page's `script-src` Content Security Policy.

## Landing values and attribution model

You can call `captureAcquisitionTracking()` on every page view, including
client-side route changes in a single-page app. The stored visit changes only
as the `model` option describes:

- `'first-touch'` (default): the first capture is kept. Later captures never
  replace its UTM parameters, ad click ids, landing `page_url`, or `referrer`.
- `'last-touch'`: a page view whose URL carries a UTM parameter or ad click id
  replaces the stored visit as a whole, so values from an older campaign are
  not mixed in. Page views without them keep the stored visit.

`fbp`, `fbc` and `user_agent` describe the browser rather than the visit and
always follow the current browser.

## Configuring once for the whole page

Set the persistence, model, and lifetime once at startup. Every later capture
uses them, including the ones `@moreflow/forms`, `@moreflow/meetings` and
`@moreflow/chatbots` make with `acquisitionTracking: true`, so the values a form
submits are the ones you captured on landing:

```ts
import { captureAcquisitionTracking, configureAcquisitionTracking } from '@moreflow/tracking';

configureAcquisitionTracking({ persistence: 'local', model: 'last-touch', ttlDays: 30 });

// On landing and on every route change, once the visitor consented:
captureAcquisitionTracking();
```

| Option | Default | Meaning |
| --- | --- | --- |
| `persistence` | `'session'` | `'session'` keeps the values in `sessionStorage` for the tab; `'local'` keeps them in `localStorage` across visits. |
| `model` | `'first-touch'` | See above. |
| `ttlDays` | none | Stored values older than this start a new visit. A record stored before `ttlDays` was set counts as expired. |
| `persistenceKey` | `moreflow:acquisition:v1` | The storage key. |

Each `configureAcquisitionTracking` call replaces the previous settings, and
options passed to a single `captureAcquisitionTracking` call win over them. The
settings are shared by every copy of the package on the page, including the
ones bundled into the SDKs' script-tag builds. Pass `storage` to use your own
`StorageLike` instead of the browser storage `persistence` selects.

## Server rendering

Without `window` (for example during server rendering) nothing is kept between
calls: each call returns only what it was given, so one request's values never
reach another visitor. Capture in the browser.

The other public SDKs, the agent plugins, and the HTTP API are listed in the
[Moreflow SDK overview](https://api.moreflow.io/v1/operations/docs/guide#sdks).

## Consent

`captureAcquisitionTracking` reads Meta's `_fbp` and `_fbc` cookies and writes
the captured values to `sessionStorage` (or `localStorage`). In the EU, and in Germany under § 25
TDDDG, reading from and writing to the visitor's device for attribution needs
the visitor's consent. Call it only after your consent banner reports that the
visitor agreed to marketing or attribution tracking.

`@moreflow/chatbots`, `@moreflow/meetings`, and `@moreflow/forms` call it for
you only when you pass `acquisitionTracking: true` (or a function that returns
`true` once the visitor consented). Without that option they capture nothing. Each SDK calls its override
`trackingCapture`: pass an options object for the built-in capture, or a
callback returning that SDK's tracking metadata. Both forms obey
`acquisitionTracking`; explicit request payload metadata is independent.

When a visitor withdraws consent, remove what was stored. Without a `storage`
option this clears the key in both `sessionStorage` and `localStorage`:

```ts
import { clearAcquisitionTracking } from '@moreflow/tracking';

clearAcquisitionTracking();
```

## Stored data

| Key | Storage | Lifetime | Purpose |
| --- | --- | --- | --- |
| `moreflow:acquisition:v1` (`acquisitionTrackingStorageKey`) | `sessionStorage` by default | Until the tab is closed. It is per tab and per origin: other tabs, other subdomains, and later visits do not see it. | Keeps the UTM parameters, ad click ids (`gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `ttp`), Meta `fbp`/`fbc`, landing page URL, referrer, and user agent, plus the capture time (`captured_at`), so a later page can still send them. |
| the same key | `localStorage` with `persistence: 'local'` | Until `ttlDays` pass (checked on the next capture), `clearAcquisitionTracking()`, or the visitor clears site data. Shared by the tabs of one origin. | The same values, kept across visits. |

When browser storage is blocked (for example in a sandboxed iframe), the
values live in memory for the page instead and are gone on reload. Pass
`storage` and `persistenceKey` to use your own storage or key.

The package reads the `_fbp` and `_fbc` cookies but never writes cookies.

## Errors

Tracking has no SDK error class or `isMoreflowError` export: blocked storage degrades to memory. The request SDKs (`@moreflow/forms`, `@moreflow/chatbots`, `@moreflow/meetings`, `@moreflow/api`) export `isMoreflowError(error)` to recognize their shared `Symbol.for('moreflow.error')` brand, even across separately bundled packages. Their errors use this common shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | `string` | Stable failure code; branch on this, including newer server codes. |
| `message` | `string` | Developer explanation, using the server's message when available. |
| `status` | `number \| undefined` | HTTP status; `undefined` when no response arrived. |
| `retryable` | `boolean` | Whether the same request may succeed later: HTTP 408, 425, 429, 5xx, network failures or a server-declared retryable failure. Caller cancellation (`ABORTED`) is not retryable. |
| `recovery` | `{ operation, args?, requiredFields? } \| undefined` | The operation that resolves the failure, its known arguments and input still needed. |
| `details` | `Record<string, unknown>` | Structured server context; `{}` when absent. Operation `context` is merged into it. |
| `requestId` | `string \| undefined` | Server request id to quote when contacting support. |
| `responseBody` | `unknown` | Raw response body, unchanged. |

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue
tracker](https://github.com/moreflow-io/tracking/issues). Development happens
in the private Moreflow monorepo alongside the embed packages that use this
one; each released version is synced here, so the published source always
matches the npm release.
