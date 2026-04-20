import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { GoogleSearchParsedTool } from '../google-search-parsed-tool';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('GoogleSearchParsedTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: GoogleSearchParsedTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new GoogleSearchParsedTool();
    tool.register({ server, sapiClient, getAuthToken: () => auth });
  });

  it('registers a tool named "google_search_parsed"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'google_search_parsed',
      expect.objectContaining({ description: expect.stringContaining('Google') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with JSON stringified data', async () => {
    const mockData = { organic: [{ title: 'Result', url: 'https://example.com' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'shoes' })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  it('passes google_search target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'shoes', geo: 'us', locale: 'en-us' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'shoes',
        geo: 'us',
        locale: 'en-us',
        target: 'google_search',
        parse: true,
      }),
    });
  });

  it('strips high-char-count fields from the response', async () => {
    const mockData = {
      organic: [{ title: 'Result' }],
      images: ['should be removed'],
      image_data: ['should be removed'],
      related_searches_urls: ['should be removed'],
      factoids: ['should be removed'],
      people_also_buy_from: ['should be removed'],
      what_people_are_saying: ['should be removed'],
    };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({ query: 'shoes' })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.images).toBeUndefined();
    expect(parsed.image_data).toBeUndefined();
    expect(parsed.related_searches_urls).toBeUndefined();
    expect(parsed.factoids).toBeUndefined();
    expect(parsed.people_also_buy_from).toBeUndefined();
    expect(parsed.what_people_are_saying).toBeUndefined();
    expect(parsed.organic).toBeDefined();
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

describe('GoogleSearchParsedTool.transformResponse', () => {
  it('removes all high-char-count fields including nested ones', () => {
    const tool = new GoogleSearchParsedTool();
    const input = {
      organic: [{ title: 'Result' }],
      images: 'remove me',
      image_data: 'remove me',
      related_searches_urls: 'remove me',
      factoids: 'remove me',
      people_also_buy_from: 'remove me',
      what_people_are_saying: 'remove me',
      nested: { images: 'nested remove' },
    };

    const { data } = tool.transformResponse({ data: input });
    const parsed = JSON.parse(data);

    expect(parsed.images).toBeUndefined();
    expect(parsed.nested?.images).toBeUndefined();
    expect(parsed.organic).toBeDefined();
  });
});
