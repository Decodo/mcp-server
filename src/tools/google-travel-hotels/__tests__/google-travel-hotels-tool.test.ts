import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GoogleTravelHotelsTool } from '../google-travel-hotels-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('GoogleTravelHotelsTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: GoogleTravelHotelsTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new GoogleTravelHotelsTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "google_travel_hotels"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'google_travel_hotels',
      expect.objectContaining({ description: expect.stringContaining('Google') }),
      expect.any(Function)
    );
  });

  it('passes google_travel_hotels target and markdown: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'trivago' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'trivago',
        target: 'google_travel_hotels',
        markdown: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'trivago' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
