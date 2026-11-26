import { BundledSchema } from '@decodo/sdk-ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AUTH_TYPE } from '../../auth';
import { hiddenToolsFromEnv } from '../hidden-tools';
import { ScraperAPIBaseServer } from '../sapi-base-server';

const surfaceSize = (name: string) => BundledSchema.shared.getSurface(name)?.tools.length;

describe('hiddenToolsFromEnv', () => {
  it('hides nothing when unset or empty, since each surface in the IR already picks its tools', () => {
    expect(hiddenToolsFromEnv(undefined).size).toBe(0);
    expect(hiddenToolsFromEnv('').size).toBe(0);
    expect(hiddenToolsFromEnv(' , ').size).toBe(0);
  });

  it('reads a comma-separated list', () => {
    expect([...hiddenToolsFromEnv(' chatgpt, google_ads ,')]).toEqual(['chatgpt', 'google_ads']);
  });
});

describe('hidden tools on a connected server', () => {
  const connect = async ({
    hiddenTools,
    visibleTools,
    integrationHeader,
  }: {
    hiddenTools?: ReadonlySet<string>;
    visibleTools?: ReadonlySet<string>;
    integrationHeader?: string;
  } = {}) => {
    const { server } = new ScraperAPIBaseServer({
      auth: { type: AUTH_TYPE.API_KEY, value: 'key' },
      toolsets: [],
      hiddenTools,
      visibleTools,
      integrationHeader,
    });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    return client;
  };

  const listedNames = async (client: Client) =>
    (await client.listTools()).tools.map(tool => tool.name);

  it('leaves hidden tools out of tools/list', async () => {
    const names = await listedNames(await connect({ hiddenTools: new Set(['chatgpt']) }));

    expect(names).not.toContain('chatgpt');
    expect(names).toContain('google_search');
    expect(names).toHaveLength(surfaceSize('mcp')! - 1);
  });

  it('refuses a call to a hidden tool', async () => {
    const client = await connect({ hiddenTools: new Set(['chatgpt']) });

    const result = await client.callTool({ name: 'chatgpt', arguments: { prompt: 'hi' } });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('disabled');
  });

  it('lists every tool of the surface when nothing is hidden', async () => {
    const names = await listedNames(await connect({ integrationHeader: 'mcp-hosted' }));

    expect(names).toHaveLength(surfaceSize('mcp-hosted')!);
  });

  it('lists only the allowed tools when given an allow-list', async () => {
    const names = await listedNames(await connect({ visibleTools: new Set(['search', 'map']) }));

    expect(names.sort()).toEqual(['map', 'search']);
  });

  it('accepts the legacy crawlId for an input the IR requires', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ crawl_id: 'crawl-1', status: 'done' }), {
        headers: { 'content-type': 'application/json' },
      })
    );
    const client = await connect();
    const crawlStatus = (await client.listTools()).tools.find(tool => tool.name === 'crawl_status');

    const result = await client.callTool({
      name: 'crawl_status',
      arguments: { crawlId: 'crawl-1' },
    });
    const missing = await client.callTool({ name: 'crawl_status', arguments: {} });

    fetchMock.mockRestore();

    expect(crawlStatus?.inputSchema.required).toEqual(['crawl_id']);
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ crawl_id: 'crawl-1', status: 'done' }) },
    ]);
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toContain('crawl_id');
  });
});
