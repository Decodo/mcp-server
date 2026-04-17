import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { RedditSubredditTool } from '../tools/reddit-subreddit-tool';
import { SCRAPER_API_TARGETS, TOOLSET } from '../constants';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../clients/scraper-api-client');

describe('RedditSubredditTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0' }) as jest.Mocked<McpServer>;
    server.registerTool = jest.fn();
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
  });

  it('has social_media toolset', () => {
    expect(RedditSubredditTool.toolset).toBe(TOOLSET.SOCIAL_MEDIA);
  });

  it('registers with correct tool name', () => {
    RedditSubredditTool.register({ server, sapiClient, getAuthToken: () => auth });

    expect(server.registerTool).toHaveBeenCalledWith(
      'reddit_subreddit',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('calls scrape with REDDIT_SUBREDDIT target', async () => {
    const mockData = { posts: [{ title: 'Post 1' }, { title: 'Post 2' }] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    RedditSubredditTool.register({ server, sapiClient, getAuthToken: () => auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    const result = await handler({ url: 'https://reddit.com/r/programming' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        url: 'https://reddit.com/r/programming',
        target: SCRAPER_API_TARGETS.REDDIT_SUBREDDIT,
      }),
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });
});
