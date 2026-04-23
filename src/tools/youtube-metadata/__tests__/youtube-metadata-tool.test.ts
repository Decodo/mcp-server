import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { YoutubeMetadataTool } from '../youtube-metadata-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('YoutubeMetadataTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: YoutubeMetadataTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new YoutubeMetadataTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "youtube_metadata"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'youtube_metadata',
      expect.objectContaining({ description: expect.stringContaining('YouTube') }),
      expect.any(Function)
    );
  });

  it('passes youtube_metadata target to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'dFu9aKJoqGg' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'dFu9aKJoqGg',
        target: 'youtube_metadata',
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'dFu9aKJoqGg' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
