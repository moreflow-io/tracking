import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acquisitionTrackingStorageKey,
  captureAcquisitionTracking,
  clearAcquisitionTracking,
  configureAcquisitionTracking,
  createMemoryStorage,
  resolveStorage,
  type StorageLike
} from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  configureAcquisitionTracking();
});

const day = 86_400_000;

function stubBrowser() {
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('sessionStorage', sessionStorage);
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('document', { cookie: '', referrer: 'https://google.test/' });
  vi.stubGlobal('navigator', { userAgent: 'MoreflowTestUA/1.0' });
  return { sessionStorage, localStorage };
}

describe('@moreflow/tracking', () => {
  it('captures and persists acquisition signals without losing cookie identifiers', () => {
    const storage = createMemoryStorage();
    const first = captureAcquisitionTracking({
      location: {
        href: 'https://example.test/meeting?utm_source=google&gclid=click-1&fbclid=meta-1'
      },
      cookie: '_fbp=fb.1.123.456; _fbc=fb.1.123.meta-1',
      referrer: 'https://google.test/',
      storage
    });

    expect(first).toMatchObject({
      utm_source: 'google',
      gclid: 'click-1',
      fbclid: 'meta-1',
      fbp: 'fb.1.123.456',
      fbc: 'fb.1.123.meta-1',
      referrer: 'https://google.test/'
    });

    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/meeting' }, storage })
    ).toMatchObject({ gclid: 'click-1', utm_source: 'google' });
  });

  it('uses the in-memory fallback when embedded storage is unavailable', () => {
    const blockedStorage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };
    const storage = resolveStorage(blockedStorage);

    expect(() => storage.setItem('key', 'value')).not.toThrow();
    expect(storage.getItem('key')).toBe('value');
  });

  it('captures document referrer and navigator user agent without configuration', () => {
    vi.stubGlobal('document', { cookie: '', referrer: 'https://google.test/' });
    vi.stubGlobal('navigator', { userAgent: 'MoreflowTestUA/1.0' });

    const tracking = captureAcquisitionTracking({
      location: { href: 'https://example.test/meeting' },
      storage: createMemoryStorage()
    });

    expect(tracking.referrer).toBe('https://google.test/');
    expect(tracking.user_agent).toBe('MoreflowTestUA/1.0');
  });

  it('clears the persisted values so the next capture starts empty', () => {
    const storage = createMemoryStorage();
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=google' },
      storage
    });
    expect(storage.getItem(acquisitionTrackingStorageKey)).toContain('google');

    clearAcquisitionTracking({ storage });

    expect(storage.getItem(acquisitionTrackingStorageKey)).toBeNull();
    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/' }, storage })
    ).not.toHaveProperty('utm_source');
  });

  it('clears a value that was diverted to the memory fallback', () => {
    vi.stubGlobal('window', {});
    const blockedStorage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?gclid=click-1' },
      storage: blockedStorage
    });
    expect(resolveStorage(blockedStorage).getItem(acquisitionTrackingStorageKey)).toContain(
      'click-1'
    );

    clearAcquisitionTracking({ storage: blockedStorage });

    expect(resolveStorage(blockedStorage).getItem(acquisitionTrackingStorageKey)).toBeNull();
  });

  it('keeps the landing page, referrer and campaign across route changes (first-touch)', () => {
    const storage = createMemoryStorage();
    const landing = captureAcquisitionTracking({
      location: { href: 'https://example.test/landing?utm_source=google&gclid=click-1' },
      referrer: 'https://google.test/',
      storage,
      now: 1_000
    });

    const afterRouteChange = captureAcquisitionTracking({
      location: { href: 'https://example.test/pricing?utm_source=newsletter' },
      referrer: 'https://example.test/landing',
      storage,
      now: 2_000
    });

    expect(afterRouteChange).toEqual(landing);
    expect(afterRouteChange).toMatchObject({
      page_url: 'https://example.test/landing?utm_source=google&gclid=click-1',
      referrer: 'https://google.test/',
      utm_source: 'google',
      gclid: 'click-1'
    });
  });

  it('replaces the whole visit only when a new campaign arrives (last-touch)', () => {
    const storage = createMemoryStorage();
    const options = { storage, model: 'last-touch' as const };
    captureAcquisitionTracking({
      ...options,
      location: { href: 'https://example.test/a?utm_source=google&gclid=click-1' },
      referrer: 'https://google.test/'
    });

    expect(
      captureAcquisitionTracking({
        ...options,
        location: { href: 'https://example.test/b' },
        referrer: 'https://example.test/a'
      })
    ).toMatchObject({
      page_url: 'https://example.test/a?utm_source=google&gclid=click-1',
      referrer: 'https://google.test/',
      gclid: 'click-1'
    });

    const nextCampaign = captureAcquisitionTracking({
      ...options,
      location: { href: 'https://example.test/c?utm_source=meta&fbclid=meta-1' },
      referrer: 'https://facebook.test/',
      userAgent: 'MoreflowTestUA/1.0',
      now: 5_000
    });
    expect(nextCampaign).toEqual({
      utm_source: 'meta',
      fbclid: 'meta-1',
      fbc: 'fb.1.5000.meta-1',
      page_url: 'https://example.test/c?utm_source=meta&fbclid=meta-1',
      referrer: 'https://facebook.test/',
      user_agent: 'MoreflowTestUA/1.0'
    });
  });

  it('follows the current browser for Meta cookies and the user agent', () => {
    const storage = createMemoryStorage();
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?fbclid=meta-1' },
      userAgent: 'OldUA',
      storage,
      now: 1_000
    });

    expect(
      captureAcquisitionTracking({
        location: { href: 'https://example.test/next' },
        cookie: '_fbp=fb.1.2.3; _fbc=fb.1.2.meta-1',
        userAgent: 'NewUA',
        storage
      })
    ).toMatchObject({ fbp: 'fb.1.2.3', fbc: 'fb.1.2.meta-1', user_agent: 'NewUA', fbclid: 'meta-1' });
  });

  it('starts a new visit once the stored one is older than ttlDays', () => {
    const storage = createMemoryStorage();
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=google' },
      storage,
      ttlDays: 30,
      now: 0
    });

    expect(
      captureAcquisitionTracking({
        location: { href: 'https://example.test/?utm_source=bing' },
        storage,
        ttlDays: 30,
        now: 29 * day
      })
    ).toMatchObject({ utm_source: 'google' });
    expect(
      captureAcquisitionTracking({
        location: { href: 'https://example.test/?utm_source=bing' },
        storage,
        ttlDays: 30,
        now: 31 * day
      })
    ).toMatchObject({ utm_source: 'bing' });
  });

  it('treats a stored record without a capture time as expired when ttlDays is set', () => {
    const storage = createMemoryStorage();
    storage.setItem(acquisitionTrackingStorageKey, JSON.stringify({ utm_source: 'legacy' }));

    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/' }, storage })
    ).toMatchObject({ utm_source: 'legacy' });
    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/' }, storage, ttlDays: 7 })
    ).not.toHaveProperty('utm_source');
  });

  it("persists to localStorage with persistence: 'local'", () => {
    const { sessionStorage, localStorage } = stubBrowser();

    captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=google' },
      persistence: 'local'
    });

    expect(localStorage.getItem(acquisitionTrackingStorageKey)).toContain('google');
    expect(sessionStorage.getItem(acquisitionTrackingStorageKey)).toBeNull();
  });

  it('applies configureAcquisitionTracking to later captures, with per-call options winning', () => {
    const { sessionStorage, localStorage } = stubBrowser();
    configureAcquisitionTracking({
      persistence: 'local',
      model: 'last-touch',
      persistenceKey: 'site:acquisition'
    });

    captureAcquisitionTracking({ location: { href: 'https://example.test/?utm_source=google' } });
    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/?utm_source=bing' } })
    ).toMatchObject({ utm_source: 'bing' });
    expect(localStorage.getItem('site:acquisition')).toContain('bing');

    captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=meta' },
      persistence: 'session'
    });
    expect(sessionStorage.getItem('site:acquisition')).toContain('meta');

    clearAcquisitionTracking();
    expect(localStorage.getItem('site:acquisition')).toBeNull();
    expect(sessionStorage.getItem('site:acquisition')).toBeNull();
  });

  it('never carries values from one server-side capture into the next', () => {
    vi.stubGlobal('window', undefined);
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=visitor-a&gclid=click-a' }
    });

    const next = captureAcquisitionTracking({ location: { href: 'https://example.test/' } });
    expect(next.page_url).toBe('https://example.test/');
    expect(next).not.toHaveProperty('utm_source');
    expect(next).not.toHaveProperty('gclid');
  });

  it('keeps blocked-storage fallbacks per call on a server', () => {
    vi.stubGlobal('window', undefined);
    const blockedStorage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined
    };
    captureAcquisitionTracking({
      location: { href: 'https://example.test/?gclid=click-a' },
      storage: blockedStorage
    });

    expect(
      captureAcquisitionTracking({ location: { href: 'https://example.test/' }, storage: blockedStorage })
    ).not.toHaveProperty('gclid');
  });
});
