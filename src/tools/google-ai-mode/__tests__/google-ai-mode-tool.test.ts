import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GoogleAiModeTool } from '../google-ai-mode-tool';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { ScrapingMCPParams } from '../../../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('GoogleAiModeTool', () => {
  let server: jest.Mocked<McpServer>;
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let registeredHandler: (params: ScrapingMCPParams) => Promise<unknown>;
  let tool: GoogleAiModeTool;
  const auth = 'dGVzdDp0ZXN0';

  beforeEach(() => {
    server = new MockedMcpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new MockedScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, handler) => {
      registeredHandler = handler as typeof registeredHandler;
      return server;
    });

    tool = new GoogleAiModeTool();
    tool.register({ server, sapiClient, auth });
  });

  it('registers a tool named "google_ai_mode"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'google_ai_mode',
      expect.objectContaining({ description: expect.stringContaining('Google AI Mode') }),
      expect.any(Function)
    );
  });

  it('passes google_ai_mode target and parse: true to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: {} });

    await registeredHandler({ query: 'What are the top three dog breeds?' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: expect.objectContaining({
        query: 'What are the top three dog breeds?',
        target: 'google_ai_mode',
        parse: true,
      }),
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest
      .fn()
      .mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ query: 'What are the top three dog breeds?' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
