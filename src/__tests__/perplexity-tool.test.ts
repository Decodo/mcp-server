import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { PerplexityTool } from '../tools/perplexity-tool';
import { SCRAPER_API_TARGETS, TOOLSET } from '../constants';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../clients/scraper-api-client');

describe('PerplexityTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0' }) as jest.Mocked<McpServer>;
    server.registerTool = jest.fn();
    sapiClient = new ScraperApiClient({ auth: 'test' }) as jest.Mocked<ScraperApiClient>;
  });

  it('has ai toolset', () => {
    expect(PerplexityTool.toolset).toBe(TOOLSET.AI);
  });

  it('registers with correct tool name', () => {
    PerplexityTool.register({ server, sapiClient });

    expect(server.registerTool).toHaveBeenCalledWith(
      'perplexity',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('calls scrape with PERPLEXITY target and parse: true', async () => {
    const mockData = { answer: 'Perplexity response with sources', sources: ['url1', 'url2'] };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    PerplexityTool.register({ server, sapiClient });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    const result = await handler({ prompt: 'What is MCP?' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      scrapingParams: expect.objectContaining({
        prompt: 'What is MCP?',
        target: SCRAPER_API_TARGETS.PERPLEXITY,
        parse: true,
      }),
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('passes geo parameter when provided', async () => {
    const mockData = { answer: 'Local response' };
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: mockData });

    PerplexityTool.register({ server, sapiClient });

    const handler = (server.registerTool as jest.Mock).mock.calls[0][2];
    await handler({ prompt: 'Weather today', geo: 'United States' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      scrapingParams: expect.objectContaining({
        prompt: 'Weather today',
        geo: 'United States',
        target: SCRAPER_API_TARGETS.PERPLEXITY,
        parse: true,
      }),
    });
  });
});
