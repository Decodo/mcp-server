import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScreenshotTool } from '../tools/screenshot-tool';
import { ScrapingMCPParams } from '../types';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../clients/scraper-api-client');

const MockedMcpServer = McpServer as jest.MockedClass<typeof McpServer>;
const MockedScraperApiClient = ScraperApiClient as jest.MockedClass<typeof ScraperApiClient>;

describe('ScreenshotTool', () => {
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

    ScreenshotTool.register({ server, sapiClient, getAuthToken: () => auth });
  });

  it('registers a tool named "screenshot"', () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      'screenshot',
      expect.objectContaining({ description: expect.stringContaining('screenshot') }),
      expect.any(Function)
    );
  });

  it('returns an image/png content block', async () => {
    const base64png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: base64png });

    const result = await registeredHandler({ url: 'https://example.com' }) as { content: { type: string; data: string; mimeType: string }[] };

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'image',
      data: base64png,
      mimeType: 'image/png',
    });
  });

  it('passes headless: "png" to the scraper', async () => {
    sapiClient.scrape = jest.fn().mockResolvedValue({ data: '' });

    await registeredHandler({ url: 'https://example.com', geo: 'us' });

    expect(sapiClient.scrape).toHaveBeenCalledWith({
      auth,
      scrapingParams: { url: 'https://example.com', geo: 'us', headless: 'png' },
    });
  });

  it('propagates scraper errors', async () => {
    sapiClient.scrape = jest.fn().mockRejectedValue(new Error('Scraper API request failed (401): Authentication failed.'));

    await expect(registeredHandler({ url: 'https://example.com' })).rejects.toThrow(
      'Scraper API request failed (401): Authentication failed.'
    );
  });
});
