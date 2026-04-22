import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AmazonProductTool } from '../amazon-product-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('AmazonProductTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: AmazonProductTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new AmazonProductTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "amazon_product"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'amazon_product',
      expect.objectContaining({ description: expect.stringContaining('Amazon') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { results: { title: 'Product Title', price: '$29.99' } };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'B09H74FXNW' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes amazon_product target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'B09H74FXNW', geo: '10001' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'B09H74FXNW',
        geo: '10001',
        target: 'amazon_product',
        parse: true,
      }),
    });
  });

  it('strips high-char-count fields from the response', async () => {
    const mockData = {
      results: { title: 'Product' },
      bullet_points: ['should be removed'],
      description: 'should be removed',
    };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'B09H74FXNW' })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.bullet_points).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.results).toBeDefined();
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

describe('AmazonProductTool.transformResponse', () => {
  it('removes all high-char-count fields', () => {
    const tool = new AmazonProductTool();
    const input = {
      results: { title: 'Product' },
      bullet_points: 'remove me',
      description: 'remove me',
      nested: { bullet_points: 'nested remove' },
    };

    const { data } = tool.transformResponse({ data: input });
    const parsed = JSON.parse(data);

    expect(parsed.bullet_points).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.nested?.bullet_points).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });
});
