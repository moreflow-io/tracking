export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The storage key `captureAcquisitionTracking` persists under by default. */
export const acquisitionTrackingStorageKey = 'moreflow:acquisition:v1';

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

// One page-lived fallback shared by every helper call in a browser, so values
// diverted away from a failing storage stay visible to later calls on the page.
// Never used without `window`: on a server one module instance serves many
// visitors, and a shared fallback would leak one request's values into the next.
const sharedMemoryFallback = createMemoryStorage();

function hasWindow(): boolean {
  return typeof globalThis.window !== 'undefined';
}

function memoryFallback(): StorageLike {
  return hasWindow() ? sharedMemoryFallback : createMemoryStorage();
}

/** Guard browser storage because embedded third-party contexts can deny it. */
export function guardStorage(primary: StorageLike): StorageLike {
  const fallback = memoryFallback();
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

/** Where `captureAcquisitionTracking` keeps values when no `storage` is passed. */
export type AcquisitionTrackingPersistence = 'session' | 'local';

function createDefaultStorage(persistence: AcquisitionTrackingPersistence = 'session'): StorageLike {
  if (!hasWindow()) return createMemoryStorage();
  try {
    const browserStorage =
      persistence === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    if (typeof browserStorage !== 'undefined') return guardStorage(browserStorage);
  } catch {
    // Access to browser storage can throw when third-party storage is blocked.
  }
  return sharedMemoryFallback;
}

/**
 * Resolve storage once at a browser-facing package boundary. Without `storage`
 * it uses `sessionStorage` (or `localStorage` for `'local'`) in a browser, and
 * a fresh, call-scoped memory storage where there is no `window`.
 */
export function resolveStorage(
  storage: StorageLike | undefined,
  persistence?: AcquisitionTrackingPersistence | undefined
): StorageLike {
  return storage ? guardStorage(storage) : createDefaultStorage(persistence);
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

/**
 * Which visit the captured values describe.
 *
 * - `'first-touch'` (default): the first capture is kept. Later captures never
 *   replace its campaign parameters, landing `page_url`, or `referrer`.
 * - `'last-touch'`: a capture whose URL carries campaign parameters (any UTM
 *   parameter or ad click id) replaces the stored visit as a whole. Captures
 *   without them, such as client-side route changes, keep the stored visit.
 *
 * In both models the browser identifiers `fbp`, `fbc` and `user_agent` follow
 * the current browser.
 */
export type AcquisitionTrackingModel = 'first-touch' | 'last-touch';

/** Settings `configureAcquisitionTracking` applies to every later capture. */
export interface AcquisitionTrackingConfig {
  /** `'session'` (default) keeps values for the tab; `'local'` keeps them across visits. */
  persistence?: AcquisitionTrackingPersistence | undefined;
  model?: AcquisitionTrackingModel | undefined;
  /** Drop stored values older than this many days. Unset keeps them as long as the storage does. */
  ttlDays?: number | undefined;
  persistenceKey?: string | undefined;
}

export interface TrackingCaptureOptions extends AcquisitionTrackingConfig {
  location?: { href?: string; search?: string } | undefined;
  cookie?: string | undefined;
  referrer?: string | undefined;
  userAgent?: string | undefined;
  now?: number | undefined;
  /** Replaces the storage `persistence` selects. */
  storage?: StorageLike | undefined;
}

// Kept on globalThis under a registered symbol, so every copy of this package
// on a page (the app's own, and the ones bundled into the forms, chatbots and
// meetings script-tag builds) reads the same settings. It holds settings only,
// never visitor values.
const configSymbol = Symbol.for('@moreflow/tracking/config');

function configuredDefaults(): AcquisitionTrackingConfig {
  const config: unknown = Reflect.get(globalThis, configSymbol);
  return config && typeof config === 'object' ? (config as AcquisitionTrackingConfig) : {};
}

/**
 * Set the persistence, model, TTL and key every later capture uses, including
 * the ones `@moreflow/forms`, `@moreflow/meetings` and `@moreflow/chatbots`
 * make with `acquisitionTracking: true`. Call it once at startup; each call
 * replaces the previous settings, and options passed to a single capture still
 * win. It stores no visitor data and captures nothing by itself.
 */
export function configureAcquisitionTracking(config: AcquisitionTrackingConfig = {}): void {
  Reflect.set(globalThis, configSymbol, Object.freeze({ ...config }));
}

function resolveCaptureOptions(options: TrackingCaptureOptions): TrackingCaptureOptions {
  const defaults = configuredDefaults();
  return {
    ...options,
    persistence: options.persistence ?? defaults.persistence,
    model: options.model ?? defaults.model,
    ttlDays: options.ttlDays ?? defaults.ttlDays,
    persistenceKey: options.persistenceKey ?? defaults.persistenceKey
  };
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

const contextKeys = new Set<TrackingKey>(['page_url', 'referrer', 'user_agent']);
const cookieKeys = new Set<TrackingKey>(['fbp', 'fbc']);
/** Keys read from the landing URL: UTM parameters and ad click ids. */
const campaignKeys = trackingKeys.filter((key) => !contextKeys.has(key) && !cookieKeys.has(key));
/** Keys that describe the visit, as opposed to the browser. */
const touchKeys: readonly TrackingKey[] = [...campaignKeys, 'page_url', 'referrer'];

const capturedAtKey = 'captured_at';
const dayMs = 86_400_000;

interface PersistedTracking {
  tracking: AcquisitionTracking;
  capturedAt: number | undefined;
}

function readPersistedTracking(storage: StorageLike, key: string): PersistedTracking | undefined {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return undefined;
    const tracking: AcquisitionTracking = {};
    for (const trackingKey of trackingKeys) {
      const value = Reflect.get(parsed, trackingKey);
      if (typeof value === 'string' && value.length > 0) tracking[trackingKey] = value;
    }
    const capturedAt = Reflect.get(parsed, capturedAtKey);
    return {
      tracking,
      capturedAt: typeof capturedAt === 'number' && Number.isFinite(capturedAt) ? capturedAt : undefined
    };
  } catch {
    return undefined;
  }
}

function isExpired(persisted: PersistedTracking, ttlDays: number | undefined, now: number): boolean {
  if (ttlDays === undefined || !Number.isFinite(ttlDays) || ttlDays <= 0) return false;
  // A record without a capture time predates the TTL, so its age is unknown.
  if (persisted.capturedAt === undefined) return true;
  return now - persisted.capturedAt > ttlDays * dayMs;
}

function readCampaignParams(pageLocation: TrackingCaptureOptions['location']): AcquisitionTracking {
  const params: AcquisitionTracking = {};
  try {
    const searchParams = new URL(
      pageLocation?.href ?? pageLocation?.search ?? '',
      'https://moreflow.invalid'
    ).searchParams;
    for (const trackingKey of campaignKeys) {
      const value = searchParams.get(trackingKey);
      if (value) params[trackingKey] = value;
    }
  } catch {
    // A malformed location should not prevent a public embed from continuing.
  }
  return params;
}

function pick(tracking: AcquisitionTracking, keys: readonly TrackingKey[]): AcquisitionTracking {
  const picked: AcquisitionTracking = {};
  for (const key of keys) {
    const value = tracking[key];
    if (value) picked[key] = value;
  }
  return picked;
}

/**
 * Capture and persist browser attribution without making network requests.
 * Explicit values take precedence over browser globals to keep callers testable.
 * Safe to call on every route change: the stored visit only changes as the
 * `model` describes. Options left out fall back to `configureAcquisitionTracking`.
 *
 * Without `window` (server rendering) nothing is persisted between calls, so
 * one request's values never reach another.
 *
 * It reads Meta's `_fbp`/`_fbc` cookies and writes browser storage, which in the
 * EU needs the visitor's consent: call it only after the visitor agreed.
 */
export function captureAcquisitionTracking(
  captureOptions: TrackingCaptureOptions = {}
): AcquisitionTracking {
  const options = resolveCaptureOptions(captureOptions);
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
  const now = options.now ?? Date.now();
  const storage = resolveStorage(options.storage, options.persistence);
  const persistenceKey = options.persistenceKey ?? acquisitionTrackingStorageKey;

  const stored = readPersistedTracking(storage, persistenceKey);
  const persisted = stored && !isExpired(stored, options.ttlDays, now) ? stored : undefined;
  const campaign = readCampaignParams(pageLocation);
  const newTouch =
    !persisted || (options.model === 'last-touch' && Object.keys(campaign).length > 0);

  const touch: AcquisitionTracking = newTouch
    ? {
        ...campaign,
        ...(pageLocation?.href ? { page_url: pageLocation.href } : {}),
        ...(referrer ? { referrer } : {})
      }
    : pick(persisted?.tracking ?? {}, touchKeys);
  const previous = persisted?.tracking ?? {};
  const derivedFbc = touch.fbclid ? `fb.1.${now}.${touch.fbclid}` : undefined;
  const fbp = readCookie(cookie, '_fbp') ?? previous.fbp;
  // Meta's cookie wins; a new touch's click id beats one derived for an older visit.
  const fbc =
    readCookie(cookie, '_fbc') ?? (newTouch ? derivedFbc : undefined) ?? previous.fbc ?? derivedFbc;
  const currentUserAgent = userAgent || previous.user_agent;

  const tracking: AcquisitionTracking = {
    ...touch,
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(currentUserAgent ? { user_agent: currentUserAgent } : {})
  };
  const capturedAt = newTouch ? now : persisted?.capturedAt;
  storage.setItem(
    persistenceKey,
    JSON.stringify({ ...tracking, ...(capturedAt !== undefined ? { [capturedAtKey]: capturedAt } : {}) })
  );
  return Object.freeze(tracking);
}

/**
 * Remove the persisted acquisition values, for example when a visitor withdraws
 * consent. Without `storage` it clears the key in both `sessionStorage` and
 * `localStorage`, and values captured into the page-lived memory fallback too.
 */
export function clearAcquisitionTracking(
  clearOptions: Pick<TrackingCaptureOptions, 'storage' | 'persistenceKey'> = {}
): void {
  const persistenceKey =
    clearOptions.persistenceKey ?? configuredDefaults().persistenceKey ?? acquisitionTrackingStorageKey;
  if (clearOptions.storage) {
    resolveStorage(clearOptions.storage).removeItem(persistenceKey);
    return;
  }
  resolveStorage(undefined, 'session').removeItem(persistenceKey);
  resolveStorage(undefined, 'local').removeItem(persistenceKey);
}
