import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { CrawlStatusTool } from '../crawl-status-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

describe('CrawlStatusTool', () => {
  it('returns the crawl status for the given crawl id', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    const sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
    let handler: (params: object) => Promise<{ content: { text: string }[] }> = jest.fn();

    server.registerTool = jest.fn((_name, _config, registered) => {
      handler = registered as typeof handler;
      return server;
    }) as never;

    new CrawlStatusTool().register({ server, sapiClient, auth });

    const status = { crawl_id: 'crawl-1', status: 'done', completed: 10 };
    sapiClient.getCrawlStatus = jest.fn().mockResolvedValue(status);

    const { content } = await handler({ crawlId: 'crawl-1' });

    expect(sapiClient.getCrawlStatus).toHaveBeenCalledWith({
      auth,
      crawlId: 'crawl-1',
      extra: undefined,
    });
    expect(JSON.parse(content[0].text)).toEqual(status);
  });
});
