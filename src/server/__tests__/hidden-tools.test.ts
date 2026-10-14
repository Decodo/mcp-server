import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AUTH_TYPE } from '../../auth';
import { DIRECTORY_HIDDEN_TOOLS, hiddenToolsFromEnv } from '../hidden-tools';
import { ScraperAPIBaseServer } from '../sapi-base-server';

describe('hiddenToolsFromEnv', () => {
  it('hides the directory list when unset', () => {
    expect([...hiddenToolsFromEnv(undefined)]).toEqual(DIRECTORY_HIDDEN_TOOLS);
  });

  it('hides nothing when set to an empty value, so every tool can be re-enabled by config', () => {
    expect(hiddenToolsFromEnv('').size).toBe(0);
    expect(hiddenToolsFromEnv(' , ').size).toBe(0);
  });

  it('reads a comma-separated list', () => {
    expect([...hiddenToolsFromEnv(' chatgpt, perplexity ,')]).toEqual(['chatgpt', 'perplexity']);
  });
});

describe('hidden tools on a connected server', () => {
  const connect = async (hiddenTools?: ReadonlySet<string>) => {
    const { server } = new ScraperAPIBaseServer({
      auth: { type: AUTH_TYPE.API_KEY, value: 'key' },
      toolsets: [],
      hiddenTools,
    });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    return client;
  };

  const listedNames = async (client: Client) =>
    (await client.listTools()).tools.map(tool => tool.name);

  it('leaves hidden tools out of tools/list', async () => {
    const names = await listedNames(await connect(new Set(DIRECTORY_HIDDEN_TOOLS)));

    for (const hidden of DIRECTORY_HIDDEN_TOOLS) {
      expect(names).not.toContain(hidden);
    }
    expect(names).toContain('google_search');
    expect(names).toHaveLength(
      ScraperAPIBaseServer.allTools.length - DIRECTORY_HIDDEN_TOOLS.length
    );
  });

  it('refuses a call to a hidden tool', async () => {
    const client = await connect(new Set(['chatgpt']));

    const result = await client.callTool({ name: 'chatgpt', arguments: { prompt: 'hi' } });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('disabled');
  });

  it('lists every tool when nothing is hidden', async () => {
    const names = await listedNames(await connect());

    expect(names).toHaveLength(ScraperAPIBaseServer.allTools.length);
  });
});
