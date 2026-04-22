import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { YoutubeSearchTool } from '../youtube-search-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('YoutubeSearchTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: YoutubeSearchTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new YoutubeSearchTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "youtube_search"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'youtube_search',
      expect.objectContaining({ description: expect.stringContaining('YouTube') }),
      expect.any(Function)
    );
  });

  it('passes youtube_search target to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'How to care for chinchillas' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'How to care for chinchillas',
        target: 'youtube_search',
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'How to care for chinchillas' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
