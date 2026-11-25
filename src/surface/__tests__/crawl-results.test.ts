import { AUTH_TYPE } from '../../auth';
import type { AuthCredential } from '../../auth';
import { readCrawlResults } from '../crawl-results';

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

const crawledPages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    url: `https://a.com/${i}`,
    depth: 1,
    status: 'done',
    content: `# Page ${i}`,
    crawl_status: 'https://data.decodo.com/v1/crawl/crawl-1/status',
  }));

type Result = { pages: { url: string }[]; nextCursor?: string; total?: number };

describe('readCrawlResults', () => {
  const sapiClient = { listCrawlPages: jest.fn() };

  const read = (params: { cursor?: string; limit?: number }) =>
    readCrawlResults({ sapiClient, auth, crawlId: 'crawl-1', limit: 10, ...params });

  const call = async (params: { cursor?: string; limit?: number }): Promise<Result> =>
    JSON.parse(await read(params));

  const upstreamCursorOfLastCall = () => sapiClient.listCrawlPages.mock.calls.at(-1)[0].cursor;

  beforeEach(() => {
    sapiClient.listCrawlPages.mockReset();
  });

  it('returns at most limit pages with only the fields an agent needs', async () => {
    sapiClient.listCrawlPages.mockResolvedValue({ pages: crawledPages(25), total: 25 });

    const result = await call({ limit: 10 });

    expect(result.pages).toHaveLength(10);
    expect(result.pages[0]).toEqual({
      url: 'https://a.com/0',
      depth: 1,
      status: 'done',
      content: '# Page 0',
    });
    expect(result.total).toBe(25);
  });

  it('pages through one upstream batch before moving to the next', async () => {
    sapiClient.listCrawlPages.mockResolvedValue({ pages: crawledPages(15), next: 'upstream-2' });

    const first = await call({ limit: 10 });
    const second = await call({ limit: 10, cursor: first.nextCursor });

    expect(upstreamCursorOfLastCall()).toBeUndefined();
    expect(second.pages.map(page => page.url)).toEqual(
      crawledPages(15)
        .slice(10)
        .map(page => page.url)
    );

    await call({ cursor: second.nextCursor });

    expect(upstreamCursorOfLastCall()).toBe('upstream-2');
  });

  it('omits nextCursor once the last upstream batch is used up', async () => {
    sapiClient.listCrawlPages.mockResolvedValue({ pages: crawledPages(3) });

    const result = await call({ limit: 10 });

    expect(result.nextCursor).toBeUndefined();
  });

  it('stops issuing a cursor once every page in total has been returned', async () => {
    sapiClient.listCrawlPages.mockResolvedValue({
      pages: crawledPages(4),
      next: 'upstream-2',
      total: 4,
    });

    const result = await call({ limit: 10 });

    expect(result.nextCursor).toBeUndefined();
  });

  describe('response size budget', () => {
    const MAX_RESPONSE_BYTES = 50_000;

    const pageWith = (url: string, content: string) => ({ url, depth: 1, status: 'done', content });

    type Part = {
      url: string;
      content?: string;
      contentPart?: { start: number; end: number; totalLength: number };
    };

    const walk = async (batches: Record<string, object>, limit = 10) => {
      sapiClient.listCrawlPages.mockImplementation(({ cursor }) =>
        Promise.resolve(batches[cursor ?? 'first'])
      );

      const parts: Part[] = [];
      const sizes: number[] = [];
      let cursor: string | undefined;

      do {
        const text = await read({ limit, cursor });
        const result = JSON.parse(text);
        sizes.push(Buffer.byteLength(text));
        parts.push(...result.pages);
        cursor = result.nextCursor;
      } while (cursor && sizes.length < 100);

      const contentByUrl = new Map<string, string>();
      for (const part of parts) {
        contentByUrl.set(part.url, (contentByUrl.get(part.url) ?? '') + (part.content ?? ''));
      }

      return { parts, sizes, contentByUrl };
    };

    it('stops adding pages once the next one would push the response past 50 KB', async () => {
      const pages = Array.from({ length: 10 }, (_, i) =>
        pageWith(`https://a.com/${i}`, 'x'.repeat(10_000))
      );

      const { sizes, contentByUrl } = await walk({ first: { pages, total: 10 } });

      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(sizes.length).toBeGreaterThan(1);
      expect([...contentByUrl.values()]).toEqual(pages.map(page => page.content));
    });

    it('splits one long page across calls and reassembles it exactly', async () => {
      const long = Array.from({ length: 30_000 }, (_, i) => `line ${i}\n`).join('');

      const { parts, sizes, contentByUrl } = await walk({
        first: { pages: [pageWith('https://a.com/long', long)], total: 1 },
      });

      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(contentByUrl.get('https://a.com/long')).toBe(long);
      expect(parts[0].contentPart).toEqual({
        start: 0,
        end: parts[0].content?.length,
        totalLength: long.length,
      });
      expect(parts[1].contentPart?.start).toBe(parts[0].contentPart?.end);
    });

    it('counts multibyte text by its encoded size and never splits an emoji', async () => {
      const text = 'ąčę 🙂 "quoted" '.repeat(20_000);

      const { sizes, contentByUrl } = await walk({
        first: { pages: [pageWith('https://a.com/lt', text)], total: 1 },
      });

      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(contentByUrl.get('https://a.com/lt')).toBe(text);
    });

    it('carries a split page across an upstream batch boundary', async () => {
      const long = 'y'.repeat(120_000);

      const { sizes, contentByUrl } = await walk({
        first: { pages: [pageWith('https://a.com/1', long)], next: 'b2', total: 2 },
        b2: { pages: [pageWith('https://a.com/2', 'short')], next: 'b3', total: 2 },
      });

      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(contentByUrl.get('https://a.com/1')).toBe(long);
      expect(contentByUrl.get('https://a.com/2')).toBe('short');
    });

    it.each([5, 50])(
      'stays within budget for a high limit over many %i-character pages',
      async length => {
        const pages = Array.from({ length: 1_000 }, (_, i) =>
          pageWith(`https://a.com/${i}`, 'z'.repeat(length))
        );

        const { parts, sizes } = await walk({ first: { pages, total: 1_000 } }, 1_000);

        expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
        expect(parts).toHaveLength(1_000);
      }
    );

    it('keeps page metadata within budget when limit is high', async () => {
      const pages = Array.from({ length: 2_000 }, (_, i) => ({
        url: `https://a.com/a-fairly-long-path-to-pad-the-metadata/${i}`,
        depth: 3,
        status: 'done',
      }));

      const { parts, sizes } = await walk({ first: { pages, total: 2_000 } }, 5_000);

      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
      expect(parts).toHaveLength(2_000);
    });
  });

  it.each([
    ['text that is not a cursor', 'not-a-cursor'],
    ['JSON null', Buffer.from('null').toString('base64url')],
    [
      'a string offset',
      Buffer.from('{"offset":"1","contentOffset":0,"returned":0}').toString('base64url'),
    ],
    [
      'a negative offset',
      Buffer.from('{"offset":-1,"contentOffset":0,"returned":0}').toString('base64url'),
    ],
  ])('rejects %s as a cursor before calling the API', async (_case, cursor) => {
    await expect(call({ cursor })).rejects.toThrow('Invalid cursor');
    expect(sapiClient.listCrawlPages).not.toHaveBeenCalled();
  });
});
