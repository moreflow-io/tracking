# `@moreflow/tracking`

Browser-safe acquisition tracking helpers shared by Moreflow public embeds.
The package captures campaign identifiers, referrer, and browser context while
gracefully handling blocked third-party storage.

```ts
import { captureAcquisitionTracking } from '@moreflow/tracking';

const tracking = captureAcquisitionTracking();
```

It contains no UI, framework, or network code.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue
tracker](https://github.com/moreflow-io/tracking/issues). Development happens
in the private Moreflow monorepo alongside the embed packages that use this
one; each released version is synced here, so the published source always
matches the npm release.
