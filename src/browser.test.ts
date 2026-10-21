import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type BrowserTracking = typeof import('./index');
const browserBundle = readFileSync(new URL('../dist/browser.js', import.meta.url), 'utf8');

describe('@moreflow/tracking browser distribution', () => {
  it('exports a classic-script global that captures and clears configured landing values', () => {
    expect(browserBundle).not.toMatch(/(?:^|\n)\s*import\s/mu);
    const context = createContext({ URL });
    runInContext(browserBundle, context, { filename: 'dist/browser.js' });
    const tracking = Reflect.get(context, 'MoreflowTracking') as BrowserTracking;
    expect(tracking.captureAcquisitionTracking).toBeTypeOf('function');
    const storage = tracking.createMemoryStorage();
    tracking.configureAcquisitionTracking({ model: 'last-touch', persistenceKey: 'browser-test' });
    const capture = (source: string) => tracking.captureAcquisitionTracking({
      storage, location: { href: `https://customer.test/?utm_source=${source}` }
    });
    expect(capture('first').utm_source).toBe('first');
    expect(capture('second').utm_source).toBe('second');
    tracking.clearAcquisitionTracking({ storage });
    expect(storage.getItem('browser-test')).toBeNull();
  });

  it('publishes browser and CDN entry points', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(manifest).toMatchObject({
      unpkg: './dist/browser.js', jsdelivr: './dist/browser.js',
      exports: { './browser': './dist/browser.js', './package.json': './package.json' }
    });
  });
});
