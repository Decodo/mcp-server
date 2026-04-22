import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AmazonSellersTool } from '../amazon-sellers-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('AmazonSellersTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: AmazonSellersTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new AmazonSellersTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "amazon_sellers"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'amazon_sellers',
      expect.objectContaining({ description: expect.stringContaining('Amazon') }),
      expect.any(Function)
    );
  });

  it('passes amazon_sellers target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'A1R0Z7FJGTKESH' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'A1R0Z7FJGTKESH',
        target: 'amazon_sellers',
        parse: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'A1R0Z7FJGTKESH' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
