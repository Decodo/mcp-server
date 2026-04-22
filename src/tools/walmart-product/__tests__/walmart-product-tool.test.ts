import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WalmartProductTool } from '../walmart-product-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('WalmartProductTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: WalmartProductTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new WalmartProductTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "walmart_product"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'walmart_product',
      expect.objectContaining({ description: expect.stringContaining('Walmart') }),
      expect.any(Function)
    );
  });

  it('passes walmart_product target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ product_id: '15296401808' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        product_id: '15296401808',
        target: 'walmart_product',
        parse: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ product_id: '15296401808' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
