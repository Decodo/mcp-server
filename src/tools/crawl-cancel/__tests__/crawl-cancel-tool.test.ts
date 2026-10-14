import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { CrawlCancelTool } from '../crawl-cancel-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

describe('CrawlCancelTool', () => {
  it('cancels the given crawl and returns its new status', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    const sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
    let handler: (params: object) => Promise<{ content: { text: string }[] }> = jest.fn();

    server.registerTool = jest.fn((_name, _config, registered) => {
      handler = registered as typeof handler;
      return server;
    }) as never;

    new CrawlCancelTool().register({ server, sapiClient, auth });

    sapiClient.cancelCrawl = jest.fn().mockResolvedValue({
      crawl_id: 'crawl-1',
      status: 'cancelled',
      url: 'https://a.com',
      results_content: 'https://data.decodo.com/v1/crawl/crawl-1?type=content',
    });

    const { content } = await handler({ crawlId: 'crawl-1' });

    expect(sapiClient.cancelCrawl).toHaveBeenCalledWith({
      auth,
      crawlId: 'crawl-1',
      extra: undefined,
    });
    expect(JSON.parse(content[0].text)).toEqual({
      crawl_id: 'crawl-1',
      status: 'cancelled',
      url: 'https://a.com',
    });
  });
});
