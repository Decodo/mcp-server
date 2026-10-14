import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { CrawlStartTool } from '../crawl-start-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

describe('CrawlStartTool', () => {
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let handler: (params: object) => Promise<{ content: { text: string }[] }>;
  let inputSchema: Record<string, { safeParse: (value: unknown) => { success: boolean } }>;

  beforeEach(() => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, config, registered) => {
      handler = registered as typeof handler;
      inputSchema = config.inputSchema as typeof inputSchema;
      return server;
    }) as never;

    new CrawlStartTool().register({ server, sapiClient, auth });
  });

  it('starts a markdown crawl with API param names', async () => {
    sapiClient.startCrawl = jest.fn().mockResolvedValue({ crawl_id: 'crawl-1' });

    await handler({ url: 'https://a.com', limit: 10, maxDepth: 2 });

    expect(sapiClient.startCrawl).toHaveBeenCalledWith({
      auth,
      params: expect.objectContaining({
        url: 'https://a.com',
        limit: 10,
        max_depth: 2,
        output: 'markdown',
      }),
      extra: undefined,
    });
  });

  it('caps limit at 100 pages so an agent cannot start an oversized crawl', () => {
    expect(inputSchema.limit.safeParse(100).success).toBe(true);
    expect(inputSchema.limit.safeParse(101).success).toBe(false);
  });

  it.each([0, 10001])('rejects maxDepth %s, which the API refuses', maxDepth => {
    expect(inputSchema.maxDepth.safeParse(maxDepth).success).toBe(false);
  });

  it('returns the crawl id and status without the result URLs', async () => {
    sapiClient.startCrawl = jest.fn().mockResolvedValue({
      crawl_id: 'crawl-1',
      status: 'pending',
      url: 'https://a.com',
      results_content: 'https://data.decodo.com/v1/crawl/crawl-1?type=content',
    });

    const { content } = await handler({ url: 'https://a.com', limit: 10 });

    expect(JSON.parse(content[0].text)).toEqual({
      crawl_id: 'crawl-1',
      status: 'pending',
      url: 'https://a.com',
    });
  });
});
