export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export declare function createMemoryStorage(): StorageLike;
/** Guard browser storage because embedded third-party contexts can deny it. */
export declare function guardStorage(primary: StorageLike): StorageLike;
/** Resolve storage once at a browser-facing package boundary. */
export declare function resolveStorage(storage: StorageLike | undefined): StorageLike;
export declare const trackingKeys: readonly ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_campaignid", "gad_campaignid", "gclid", "gbraid", "wbraid", "gad_source", "fbclid", "fbp", "fbc", "ttclid", "ttp", "page_url", "referrer", "user_agent"];
export type TrackingKey = (typeof trackingKeys)[number];
export type AcquisitionTracking = Partial<Record<TrackingKey, string>>;
export interface TrackingCaptureOptions {
    location?: {
        href?: string;
        search?: string;
    } | undefined;
    cookie?: string | undefined;
    referrer?: string | undefined;
    userAgent?: string | undefined;
    now?: number | undefined;
    storage?: StorageLike | undefined;
    persistenceKey?: string | undefined;
}
/**
 * Capture and persist browser attribution without making network requests.
 * Explicit values take precedence over browser globals to keep callers testable.
 */
export declare function captureAcquisitionTracking(options?: TrackingCaptureOptions): AcquisitionTracking;
