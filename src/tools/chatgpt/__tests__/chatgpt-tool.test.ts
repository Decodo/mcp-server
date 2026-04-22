import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ChatGPTTool } from '../chatgpt-tool';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../../constants';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

describe('ChatGPTTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let tool: ChatGPTTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0' }) as jest.Mocked<McpServer>;
    server.registerTool = jest.fn();
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;
    tool = new ChatGPTTool();
  });

  it('has ai toolset', () => {
    expect(tool.toolset).toBe(TOOLSET.AI);
  });

  it('registers with correct tool name', () => {
    tool.register({ server, sapiClient, auth });

    expect(server.registerTool).toHaveBeenCalledWith(
      'chatgpt',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('calls scrape with CHATGPT target and parse: true', async () => {
    const mockData = { response: 'Hello! How can I help you?' };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    tool.register({ server, sapiClient, auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    const result = await handler({ prompt: 'What is TypeScript?' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        prompt: 'What is TypeScript?',
        target: SCRAPER_API_TARGETS.CHATGPT,
        parse: true,
      }),
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('passes search parameter when provided', async () => {
    const mockData = { response: 'Search results...' };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    tool.register({ server, sapiClient, auth });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    await handler({ prompt: 'Latest news', search: true });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        prompt: 'Latest news',
        search: true,
        target: SCRAPER_API_TARGETS.CHATGPT,
        parse: true,
      }),
    });
  });
});
