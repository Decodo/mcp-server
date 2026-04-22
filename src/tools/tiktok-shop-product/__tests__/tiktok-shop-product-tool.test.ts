import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TiktokShopProductTool } from '../tiktok-shop-product-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('TiktokShopProductTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: TiktokShopProductTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new TiktokShopProductTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "tiktok_shop_product"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'tiktok_shop_product',
      expect.objectContaining({ description: expect.stringContaining('TikTok Shop') }),
      expect.any(Function)
    );
  });

  it('passes tiktok_shop_product target and markdown: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ product_id: '1731541214379741272' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        product_id: '1731541214379741272',
        target: 'tiktok_shop_product',
        markdown: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ product_id: '1731541214379741272' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
