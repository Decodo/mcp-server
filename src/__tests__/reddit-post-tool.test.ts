import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { RedditPostTool } from '../tools/reddit-post-tool';
import { ScrapingMCPParams } from '../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('RedditPostTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    RedditPostTool.register({ server, sapiClient, getAuthToken: () => auth });
  });

  it('registers a tool named "reddit_post"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'reddit_post',
      expect.objectContaining({ description: expect.stringContaining('Reddit') }),
      expect.any(Function)
    );
  });

  it('returns a text content block with pretty-printed JSON', async () => {
    const mockData = { title: 'Test post', comments: [{ body: 'Great post!' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    const result = (await registeredHandler({
      url: 'https://www.reddit.com/r/test/comments/abc123/',
    })) as { content: { type: string; text: string }[] };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe(JSON.stringify(mockData, null, 2));
  });

  it('passes reddit_post target to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    const postUrl = 'https://www.reddit.com/r/horseracing/comments/1nsrn3/';
    await registeredHandler({ url: postUrl });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        url: postUrl,
        target: 'reddit_post',
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(
      registeredHandler({ url: 'https://www.reddit.com/r/test/comments/abc123/' })
    ).rejects.toThrow('Scraper API request failed (401): Authentication failed.');
  });
});
