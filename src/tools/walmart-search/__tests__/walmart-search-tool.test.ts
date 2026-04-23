import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WalmartSearchTool } from '../walmart-search-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('WalmartSearchTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: WalmartSearchTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new WalmartSearchTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "walmart_search"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'walmart_search',
      expect.objectContaining({ description: expect.stringContaining('Walmart') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { results: [{ title: 'Tent', price: '$49.99' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'tent' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes walmart_search target and markdown: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'backpack' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'backpack',
        target: 'walmart_search',
        markdown: true,
      }),
    });
  });

  it('strips high-char-count fields from the response', async () => {
    const mockData = {
      results: [{ title: 'Item' }],
      suggested: ['should be removed'],
      refinements: ['should be removed'],
    };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'tent' })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.suggested).toBeUndefined();
    expect(parsed.refinements).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'tent' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});

describe('WalmartSearchTool.transformResponse', () => {
  it('removes all high-char-count fields', () => {
    const tool = new WalmartSearchTool();
    const input = {
      results: [{ title: 'Item' }],
      suggested: 'remove me',
      refinements: 'remove me',
      nested: { suggested: 'nested remove' },
    };

    const { data } = tool.transformResponse({ data: input });
    const parsed = JSON.parse(data);

    expect(parsed.suggested).toBeUndefined();
    expect(parsed.refinements).toBeUndefined();
    expect(parsed.nested?.suggested).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });
});
