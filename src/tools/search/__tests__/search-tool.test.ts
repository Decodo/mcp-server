import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AUTH_TYPE } from '../../../auth';
import type { AuthCredential } from '../../../auth';
import { ScraperApiClient } from '../../../clients/scraper-api-client';
import { SearchTool } from '../search-tool';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('../../../clients/scraper-api-client');

const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

const organic = Array.from({ length: 15 }, (_, rank) => ({ rank, link: `https://r${rank}.com` }));

describe('SearchTool', () => {
  let sapiClient: jest.Mocked<ScraperApiClient>;
  let handler: (params: object) => Promise<{ content: { text: string }[] }>;

  beforeEach(() => {
    const server = new McpServer({ name: 'test', version: '0.0.0' }) as jest.Mocked<McpServer>;
    sapiClient = new ScraperApiClient() as jest.Mocked<ScraperApiClient>;

    server.registerTool = jest.fn((_name, _config, registered) => {
      handler = registered as typeof handler;
      return server;
    }) as never;

    new SearchTool().register({ server, sapiClient, auth });
  });

  it('sends the query without the MCP-only limit', async () => {
    sapiClient.search = jest.fn().mockResolvedValue({ organic });

    await handler({ query: 'mcp', geo: 'us', limit: 10 });

    expect(sapiClient.search).toHaveBeenCalledWith({
      auth,
      params: { query: 'mcp', geo: 'us' },
      extra: undefined,
    });
  });

  it('keeps only the first limit organic results', async () => {
    sapiClient.search = jest.fn().mockResolvedValue({ organic, answer_box: { a: 1 } });

    const { content } = await handler({ query: 'mcp', limit: 3 });
    const data = JSON.parse(content[0].text);

    expect(data.organic.map((r: { rank: number }) => r.rank)).toEqual([0, 1, 2]);
    expect(data.answer_box).toEqual({ a: 1 });
  });

  it('throws the upstream message when the search failed', async () => {
    sapiClient.search = jest.fn().mockResolvedValue({ status: 'failed', message: 'bad query' });

    await expect(handler({ query: 'mcp', limit: 10 })).rejects.toThrow('Search failed: bad query');
  });
});
