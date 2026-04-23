import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { YoutubeSubtitlesTool } from '../youtube-subtitles-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('YoutubeSubtitlesTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: YoutubeSubtitlesTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new YoutubeSubtitlesTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "youtube_subtitles"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'youtube_subtitles',
      expect.objectContaining({ description: expect.stringContaining('YouTube') }),
      expect.any(Function)
    );
  });

  it('passes youtube_subtitles target to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'L8zSWbQN-v8' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'L8zSWbQN-v8',
        target: 'youtube_subtitles',
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'L8zSWbQN-v8' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
