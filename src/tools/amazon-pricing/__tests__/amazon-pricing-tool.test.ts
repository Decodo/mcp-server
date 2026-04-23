import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AmazonPricingTool } from '../amazon-pricing-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('AmazonPricingTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: AmazonPricingTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new AmazonPricingTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "amazon_pricing"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'amazon_pricing',
      expect.objectContaining({ description: expect.stringContaining('Amazon') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { results: { pricing: [{ price: '$29.99', seller: 'Amazon' }] } };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'B09H74FXNW' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes amazon_pricing target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'B09H74FXNW', geo: '10001' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'B09H74FXNW',
        geo: '10001',
        target: 'amazon_pricing',
        parse: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'B09H74FXNW' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
