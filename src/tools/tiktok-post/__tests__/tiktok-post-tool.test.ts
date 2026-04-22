import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../../constants';
import { TiktokPostTool } from '../tiktok-post-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

describe('TiktokPostTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let tool: TiktokPostTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0' }) as jest.Mocked<McpServer>;
    server.registerTool = jest.fn();
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
    tool = new TiktokPostTool();
  });

  it('has social_media toolset', () => {
    expect(tool.toolset).toBe(TOOLSET.SOCIAL_MEDIA);
  });

  it('registers with correct tool name', () => {
    tool.register({ server, sapiClient, auth });

    expect(server.registerTool).toHaveBeenCalledWith(
      'tiktok_post',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('calls scrape with TIKTOK_POST target', async () => {
    const mockData = { desc: 'caption', stats: {} };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    tool.register({ server, sapiClient, auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    const url = 'https://www.tiktok.com/@nba/video/7393013274725403950';
    const result = await handler({ url });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        url,
        target: SCRAPER_API_TARGETS.TIKTOK_POST,
      }),
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('forwards xhr when provided', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    tool.register({ server, sapiClient, auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    await handler({
      url: 'https://www.tiktok.com/@user/video/1',
      xhr: true,
    });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        xhr: true,
        target: SCRAPER_API_TARGETS.TIKTOK_POST,
      }),
    });
  });
});
