import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AmazonSearchParsedTool } from '../amazon-search-parsed-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('AmazonSearchParsedTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: AmazonSearchParsedTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new AmazonSearchParsedTool();
    tool.register({ server, sapiClient, getAuthToken: () => auth });
  });

  it('registers a tool named "amazon_search"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'amazon_search',
      expect.objectContaining({ description: expect.stringContaining('Amazon') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { results: [{ title: 'Toothbrush', price: '$5.99' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'toothbrush' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes amazon_search target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'shoes', geo: 'us' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'shoes',
        geo: 'us',
        target: 'amazon_search',
        parse: true,
      }),
    });
  });

  it('strips high-char-count fields from the response', async () => {
    const mockData = {
      results: [{ title: 'Item' }],
      suggested: ['should be removed'],
      amazons_choices: ['should be removed'],
      refinements: ['should be removed'],
    };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'shoes' })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.suggested).toBeUndefined();
    expect(parsed.amazons_choices).toBeUndefined();
    expect(parsed.refinements).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'shoes' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});

describe('AmazonSearchParsedTool.transformResponse', () => {
  it('removes all high-char-count fields', () => {
    const tool = new AmazonSearchParsedTool();
    const input = {
      results: [{ title: 'Item' }],
      suggested: 'remove me',
      amazons_choices: 'remove me',
      refinements: 'remove me',
      nested: { suggested: 'nested remove' },
    };

    const { data } = tool.transformResponse({ data: input });
    const parsed = JSON.parse(data);

    expect(parsed.suggested).toBeUndefined();
    expect(parsed.amazons_choices).toBeUndefined();
    expect(parsed.refinements).toBeUndefined();
    expect(parsed.nested?.suggested).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });
});
