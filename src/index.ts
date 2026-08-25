export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const defaultStorageKey = 'moreflow:acquisition:v1';

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

// One session-lived fallback shared by every helper call, so values diverted
// away from a failing storage stay visible to later calls in the same session.
const sharedMemoryFallback = createMemoryStorage();

/** Guard browser storage because embedded third-party contexts can deny it. */
export function guardStorage(primary: StorageLike): StorageLike {
  const fallback = sharedMemoryFallback;
  return {
    getItem: (key) => {
      try {
        return primary.getItem(key) ?? fallback.getItem(key);
      } catch {
        return fallback.getItem(key);
      }
    },
    setItem: (key, value) => {
      try {
        primary.setItem(key, value);
      } catch {
        fallback.setItem(key, value);
        return;
      }
      fallback.removeItem(key);
    },
    removeItem: (key) => {
      try {
        primary.removeItem(key);
      } catch {
        // The diverted copy below is removed either way.
      }
      fallback.removeItem(key);
    }
  };
}

function createDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis.sessionStorage !== 'undefined') {
      return guardStorage(globalThis.sessionStorage);
    }
  } catch {
    // Access to browser storage can throw when third-party storage is blocked.
  }
  return sharedMemoryFallback;
}

/** Resolve storage once at a browser-facing package boundary. */
export function resolveStorage(storage: StorageLike | undefined): StorageLike {
  return storage ? guardStorage(storage) : createDefaultStorage();
}

export const trackingKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_campaignid',
  'gad_campaignid',
  'gclid',
  'gbraid',
  'wbraid',
  'gad_source',
  'fbclid',
  'fbp',
  'fbc',
  'ttclid',
  'ttp',
  'page_url',
  'referrer',
  'user_agent'
] as const;

export type TrackingKey = (typeof trackingKeys)[number];
export type AcquisitionTracking = Partial<Record<TrackingKey, string>>;

export interface TrackingCaptureOptions {
  location?: { href?: string; search?: string } | undefined;
  cookie?: string | undefined;
  referrer?: string | undefined;
  userAgent?: string | undefined;
  now?: number | undefined;
  storage?: StorageLike | undefined;
  persistenceKey?: string | undefined;
}

function readCookie(cookie: string, name: string): string | undefined {
  for (const pair of cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    const value = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

function readPersistedTracking(storage: StorageLike, key: string): AcquisitionTracking {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return {};
    const result: AcquisitionTracking = {};
    for (const trackingKey of trackingKeys) {
      const value = Reflect.get(parsed, trackingKey);
      if (typeof value === 'string' && value.length > 0) result[trackingKey] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Capture and persist browser attribution without making network requests.
 * Explicit values take precedence over browser globals to keep callers testable.
 */
export function captureAcquisitionTracking(
  options: TrackingCaptureOptions = {}
): AcquisitionTracking {
  const pageLocation =
    options.location ??
    (typeof globalThis.location === 'undefined' ? undefined : globalThis.location);
  const cookie =
    options.cookie ??
    (typeof globalThis.document === 'undefined' ? '' : globalThis.document.cookie);
  const referrer =
    options.referrer ??
    (typeof globalThis.document === 'undefined' ? undefined : globalThis.document.referrer);
  const userAgent =
    options.userAgent ??
    (typeof globalThis.navigator === 'undefined' ? undefined : globalThis.navigator.userAgent);
  const storage = resolveStorage(options.storage);
  const persistenceKey = options.persistenceKey ?? defaultStorageKey;
  const current: AcquisitionTracking = {};
  const search = pageLocation?.search ?? '';

  try {
    const params = new URL(pageLocation?.href ?? search, 'https://moreflow.invalid').searchParams;
    for (const trackingKey of trackingKeys) {
      if (trackingKey === 'page_url' || trackingKey === 'referrer' || trackingKey === 'user_agent')
        continue;
      const value = params.get(trackingKey);
      if (value) current[trackingKey] = value;
    }
  } catch {
    // A malformed location should not prevent a public embed from continuing.
  }

  const fbp = readCookie(cookie, '_fbp');
  const fbc = readCookie(cookie, '_fbc');
  if (fbp) current.fbp = fbp;
  if (fbc) current.fbc = fbc;
  if (!current.fbc && current.fbclid) {
    current.fbc = `fb.1.${options.now ?? Date.now()}.${current.fbclid}`;
  }
  if (pageLocation?.href) current.page_url = pageLocation.href;
  if (referrer) current.referrer = referrer;
  if (userAgent) current.user_agent = userAgent;

  const tracking = { ...readPersistedTracking(storage, persistenceKey), ...current };
  storage.setItem(persistenceKey, JSON.stringify(tracking));
  return Object.freeze(tracking);
}
