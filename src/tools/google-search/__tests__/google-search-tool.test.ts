import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { GoogleSearchTool } from '../google-search-tool';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('GoogleSearchTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: GoogleSearchTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new GoogleSearchTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "google_search"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'google_search',
      expect.objectContaining({ description: expect.stringContaining('Google') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { results: [{ title: 'Search Result', url: 'https://example.com' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'test search' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes google_search target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'test', geo: 'us' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'test',
        geo: 'us',
        target: 'google_search',
        parse: true,
      }),
    });
  });

  it('strips high-char-count fields from the response', async () => {
    const mockData = {
      results: [{ title: 'Item' }],
      images: ['should be removed'],
      image_data: ['should be removed'],
      related_searches_urls: ['should be removed'],
    };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'test' })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.images).toBeUndefined();
    expect(parsed.image_data).toBeUndefined();
    expect(parsed.related_searches_urls).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'test' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});

describe('GoogleSearchTool.transformResponse', () => {
  it('removes all high-char-count fields', () => {
    const tool = new GoogleSearchTool();
    const input = {
      results: [{ title: 'Item' }],
      images: 'remove me',
      image_data: 'remove me',
      factoids: 'remove me',
      nested: { images: 'nested remove' },
    };

    const { data } = tool.transformResponse({ data: input });
    const parsed = JSON.parse(data);

    expect(parsed.images).toBeUndefined();
    expect(parsed.image_data).toBeUndefined();
    expect(parsed.factoids).toBeUndefined();
    expect(parsed.nested?.images).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });
});
