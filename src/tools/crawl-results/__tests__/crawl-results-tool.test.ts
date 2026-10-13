import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { CrawlResultsTool } from '../crawl-results-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

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

describe('CrawlResultsTool', () => {
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let handler: (params: object) => Promise<{ content: { text: string }[] }>;

  const call = async (params: object): Promise<Result> => {
    const { content } = await handler({ crawlId: 'crawl-1', limit: 10, ...params });
    return JSON.parse(content[0].text);
  };

  const upstreamCursorOfLastCall = () =>
    (sapiClient.listCrawlPages as jest.Mock).mock.calls.at(-1)[0].cursor;

  beforeEach(() => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, registered) => {
      handler = registered as typeof handler;
      return server;
    }) as never;

    new CrawlResultsTool().register({ server, sapiClient, auth });
  });

  it('returns at most limit pages with only the fields an agent needs', async () => {
    sapiClient.listCrawlPages = jest.fn().mockResolvedValue({ pages: crawledPages(25), total: 25 });

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
    sapiClient.listCrawlPages = jest
      .fn()
      .mockResolvedValue({ pages: crawledPages(15), next: 'upstream-2' });

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
    sapiClient.listCrawlPages = jest.fn().mockResolvedValue({ pages: crawledPages(3) });

    const result = await call({ limit: 10 });

    expect(result.nextCursor).toBeUndefined();
  });

  it('rejects a cursor it did not issue', async () => {
    await expect(call({ cursor: 'not-a-cursor' })).rejects.toThrow('Invalid cursor');
  });
});
