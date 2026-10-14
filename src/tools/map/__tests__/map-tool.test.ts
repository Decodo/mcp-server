import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { MapTool } from '../map-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

describe('MapTool', () => {
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let handler: (params: object) => Promise<{ content: { text: string }[] }>;
  let inputSchema: Record<
    string,
    { safeParse: (value: unknown) => { success: boolean; data?: unknown } }
  >;

  beforeEach(() => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, config, registered) => {
      handler = registered as typeof handler;
      inputSchema = config.inputSchema as typeof inputSchema;
      return server;
    }) as never;

    new MapTool().register({ server, sapiClient, auth });
  });

  it('renames camelCase params to their API equivalents', async () => {
    sapiClient.map = jest.fn().mockResolvedValue({ results: [] });

    await handler({
      url: 'https://a.com',
      limit: 10,
      domainFilter: 'subdomain',
      selectPaths: ['/blog/*'],
      excludePaths: ['/tag/*'],
    });

    expect(sapiClient.map).toHaveBeenCalledWith({
      auth,
      params: {
        url: 'https://a.com',
        limit: 10,
        domain_filter: 'subdomain',
        select_paths: ['/blog/*'],
        exclude_paths: ['/tag/*'],
      },
      extra: undefined,
    });
  });

  it('caps limit at 500 URLs, since the API would otherwise return up to 147700', () => {
    expect(inputSchema.limit.safeParse(500).success).toBe(true);
    expect(inputSchema.limit.safeParse(501).success).toBe(false);
    expect(inputSchema.limit.safeParse(undefined).data).toBe(10);
  });

  it('returns a flat list of URLs', async () => {
    sapiClient.map = jest.fn().mockResolvedValue({
      results: [{ content: { links: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }] } }],
    });

    const { content } = await handler({ url: 'https://a.com', limit: 10 });

    expect(JSON.parse(content[0].text)).toEqual(['https://a.com/1', 'https://a.com/2']);
  });
});
