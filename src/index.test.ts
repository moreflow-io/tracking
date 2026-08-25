import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureAcquisitionTracking,
  createMemoryStorage,
  resolveStorage,
  type StorageLike
} from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
});
