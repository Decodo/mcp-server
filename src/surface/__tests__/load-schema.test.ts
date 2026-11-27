import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BundledSchema } from '@decodo/sdk-ts';
import { loadFlowSchema } from '../load-schema';

const fixture = JSON.parse(readFileSync(join(__dirname, '../__fixtures__/flows-ir.json'), 'utf-8'));

const cacheHomeWith = (fetchedAt: number, ir = fixture) => {
  const home = mkdtempSync(join(tmpdir(), 'decodo-mcp-test-'));
  mkdirSync(join(home, 'decodo-mcp'));
  writeFileSync(
    join(home, 'decodo-mcp', 'decodo.ir.json'),
    JSON.stringify({
      fetchedAt,
      resolvedUrl: 'https://example.com/ir.json',
      latest: true,
      ir,
    })
  );

  return home;
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('loadFlowSchema', () => {
  it('starts from a stale cached IR without waiting and refreshes it in the background', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    const env = { XDG_CACHE_HOME: cacheHomeWith(0) };

    const schema = await loadFlowSchema({ env, preferCache: true });

    expect(schema.version).toBe(fixture.version);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('keeps the fallback when nothing loads', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    const log = jest.fn();
    const env = { XDG_CACHE_HOME: mkdtempSync(join(tmpdir(), 'decodo-mcp-test-')) };

    await expect(loadFlowSchema({ env, log })).resolves.toBe(BundledSchema.shared);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Could not load the Decodo IR'));
  });

  it('uses the bundled IR over a cached one older than it', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    const env = { XDG_CACHE_HOME: cacheHomeWith(Date.now(), { ...fixture, version: '1.0.0' }) };

    await expect(loadFlowSchema({ env, preferCache: true })).resolves.toBe(BundledSchema.shared);
  });

  it('checks for a newer IR on every refresh when the TTL is zero', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    const env = { XDG_CACHE_HOME: cacheHomeWith(Date.now()) };

    await loadFlowSchema({ env, ttlMs: 0, log: () => undefined });

    expect(mockFetch).toHaveBeenCalled();
  });
});
