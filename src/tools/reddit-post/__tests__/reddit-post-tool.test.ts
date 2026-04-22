import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { RedditPostTool } from '../reddit-post-tool';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../../constants';
import mockPostData from './reddit-post.json';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

describe('RedditPostTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let tool: RedditPostTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0' }) as jest.Mocked<McpServer>;
    server.registerTool = jest.fn();
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
    tool = new RedditPostTool();
  });

  it('has social_media toolset', () => {
    expect(tool.toolset).toBe(TOOLSET.SOCIAL_MEDIA);
  });

  it('registers with correct tool name', () => {
    tool.register({ server, sapiClient, auth });

    expect(server.registerTool).toHaveBeenCalledWith(
      'reddit_post',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('calls scrape with REDDIT_POST target', async () => {
    const mockData = { title: 'Test post', comments: [] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    tool.register({ server, sapiClient, auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    const result = await handler({ url: 'https://reddit.com/r/test/comments/abc' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        url: 'https://reddit.com/r/test/comments/abc',
        target: SCRAPER_API_TARGETS.REDDIT_POST,
      }),
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('transformResponse returns valid JSON matching the input', () => {
    const { data } = tool.transformResponse({ data: mockPostData });

    expect(data.length).toBeLessThan(JSON.stringify(mockPostData).length);
  });
});
