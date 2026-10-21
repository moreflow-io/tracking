export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** The storage key `captureAcquisitionTracking` persists under by default. */
export declare const acquisitionTrackingStorageKey = "moreflow:acquisition:v1";
export declare function createMemoryStorage(): StorageLike;
/** Guard browser storage because embedded third-party contexts can deny it. */
export declare function guardStorage(primary: StorageLike): StorageLike;
/** Where `captureAcquisitionTracking` keeps values when no `storage` is passed. */
export type AcquisitionTrackingPersistence = 'session' | 'local';
/**
 * Resolve storage once at a browser-facing package boundary. Without `storage`
 * it uses `sessionStorage` (or `localStorage` for `'local'`) in a browser, and
 * a fresh, call-scoped memory storage where there is no `window`.
 */
export declare function resolveStorage(storage: StorageLike | undefined, persistence?: AcquisitionTrackingPersistence | undefined): StorageLike;
export declare const trackingKeys: readonly ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_campaignid', 'gad_campaignid', 'gclid', 'gbraid', 'wbraid', 'gad_source', 'fbclid', 'fbp', 'fbc', 'ttclid', 'ttp', 'page_url', 'referrer', 'user_agent'];
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
    location?: {
        href?: string;
        search?: string;
    } | undefined;
    cookie?: string | undefined;
    referrer?: string | undefined;
    userAgent?: string | undefined;
    now?: number | undefined;
    /** Replaces the storage `persistence` selects. */
    storage?: StorageLike | undefined;
}
/**
 * Set the persistence, model, TTL and key every later capture uses, including
 * the ones `@moreflow/forms`, `@moreflow/meetings` and `@moreflow/chatbots`
 * make with `acquisitionTracking: true`. Call it once at startup; each call
 * replaces the previous settings, and options passed to a single capture still
 * win. It stores no visitor data and captures nothing by itself.
 */
export declare function configureAcquisitionTracking(config?: AcquisitionTrackingConfig): void;
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
export declare function captureAcquisitionTracking(captureOptions?: TrackingCaptureOptions): AcquisitionTracking;
/**
 * Remove the persisted acquisition values, for example when a visitor withdraws
 * consent. Without `storage` it clears the key in both `sessionStorage` and
 * `localStorage`, and values captured into the page-lived memory fallback too.
 */
export declare function clearAcquisitionTracking(clearOptions?: Pick<TrackingCaptureOptions, 'storage' | 'persistenceKey'>): void;
