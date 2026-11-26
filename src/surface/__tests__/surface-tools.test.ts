import z from 'zod';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { BundledSchema, RemoteSchema } from '@decodo/sdk-ts';
import type { FlowSchema, IrSurfaceTool } from '@decodo/sdk-ts';
import { AUTH_TYPE } from '../../auth';
import type { AuthCredential } from '../../auth';
import { TOOLSET } from '../../constants';
import { ScraperApiClient } from '../../clients/scraper-api-client';
import { registerSurfaceTools } from '../surface-tools';

type Handler = (input: Record<string, unknown>, extra?: unknown) => Promise<{ content: unknown[] }>;

const FIXTURE_URL = pathToFileURL(join(__dirname, '../__fixtures__/flows-ir.json')).href;
const apiKey: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'key' };

let schema: FlowSchema;
let surface: IrSurfaceTool[];

beforeAll(async () => {
  schema = await RemoteSchema.load({ url: FIXTURE_URL });
  surface = schema.getSurface('mcp')?.tools ?? [];
});

const register = ({ auth = apiKey, toolsets = [] as TOOLSET[] } = {}) => {
  const handlers = new Map<string, Handler>();
  const configs = new Map<string, { inputSchema: Record<string, unknown>; annotations: unknown }>();
  const server = {
    registerTool: jest.fn((name: string, config, handler: Handler) => {
      handlers.set(name, handler);
      configs.set(name, config);
    }),
  };
  const sapiClient = new ScraperApiClient({ schema });
  const runSurfaceTool = jest.spyOn(sapiClient, 'runSurfaceTool');

  registerSurfaceTools({
    server: server as never,
    sapiClient,
    auth,
    schema,
    tools: surface,
    toolsets,
  });

  return { handlers, configs, runSurfaceTool };
};

describe('registerSurfaceTools', () => {
  it('registers every tool of the surface under its IR name', () => {
    const { handlers } = register();

    expect([...handlers.keys()]).toEqual(surface.map(tool => tool.name));
  });

  it("keeps only the tools of the chosen toolsets, using each tool's group", () => {
    const { handlers } = register({ toolsets: [TOOLSET.SEARCH] });

    expect([...handlers.keys()]).toEqual(['search', 'google_search', 'bing_search']);
  });

  it('adds client-only inputs and keeps them out of the API request', async () => {
    const { handlers, configs, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue({ organic: [{ title: 'a' }, { title: 'b' }] });

    const reply = await handlers.get('search')!({ query: 'coffee', limit: 1 });

    expect(Object.keys((configs.get('search')!.inputSchema as z.AnyZodObject).shape)).toEqual([
      'query',
      'geo',
      'locale',
      'page',
      'limit',
    ]);
    expect(runSurfaceTool).toHaveBeenCalledWith(
      expect.objectContaining({ args: { query: 'coffee' } })
    );
    expect(reply.content).toEqual([
      { type: 'text', text: JSON.stringify({ organic: [{ title: 'a' }] }) },
    ]);
  });

  it('accepts the camelCase input names the tools had before the IR', async () => {
    const { handlers, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue({ results: [] });

    await handlers.get('map')!({
      url: 'https://a.com',
      selectPaths: ['^/blog'],
      domainFilter: 'all',
      domain_filter: 'domain',
    });
    await handlers.get('scrape_as_markdown')!({ url: 'https://a.com', jsRender: true });
    await handlers.get('google_search')!({ query: 'coffee', jsRender: false });

    expect(runSurfaceTool.mock.calls.map(([{ args }]) => args)).toEqual([
      expect.objectContaining({ select_paths: ['^/blog'], domain_filter: 'all' }),
      { url: 'https://a.com', headless: 'html' },
      { query: 'coffee' },
    ]);
  });

  it("caps a formatted reply at the tool's reply size limit", async () => {
    let handler: Handler | undefined;
    const sapiClient = new ScraperApiClient({ schema });
    jest
      .spyOn(sapiClient, 'runSurfaceTool')
      .mockResolvedValue({ results: { organic: [{ title: 'x'.repeat(100) }] } });
    registerSurfaceTools({
      server: { registerTool: (_: string, __: unknown, h: Handler) => (handler = h) } as never,
      sapiClient,
      auth: apiKey,
      schema,
      tools: [
        { ...surface.find(tool => tool.name === 'google_search')!, limits: { maxResultChars: 20 } },
      ],
      toolsets: [],
    });

    const reply = await handler!({ query: 'coffee' });

    expect(reply.content).toEqual([
      { type: 'text', text: 'Truncated to fit the reply size limit.' },
      { type: 'text', text: '{"results":{"organic' },
    ]);
  });

  it('rejects a legacy value the current input does not accept', async () => {
    const { handlers, runSurfaceTool } = register();

    await expect(
      handlers.get('map')!({ url: 'https://a.com', domainFilter: 'everywhere' })
    ).rejects.toThrow();
    expect(runSurfaceTool).not.toHaveBeenCalled();
  });

  it('marks cancel destructive and start not read-only', () => {
    const { configs } = register();

    expect(configs.get('crawl_cancel')!.annotations).toMatchObject({
      destructiveHint: true,
      readOnlyHint: false,
    });
    expect(configs.get('crawl_start')!.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(configs.get('crawl_status')!.annotations).toMatchObject({ readOnlyHint: true });
  });

  it('turns HTML into Markdown for scrape_as_markdown', async () => {
    const { handlers, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue('<h1>Title</h1>');

    const reply = await handlers.get('scrape_as_markdown')!({ url: 'https://example.com' });

    expect(reply.content).toEqual([
      { type: 'text', text: 'Full website content retrieved.' },
      { type: 'text', text: '# Title' },
    ]);
  });

  it.each([0, -100, 1.5])('rejects tokenLimit %p', async tokenLimit => {
    const { handlers, runSurfaceTool } = register();

    await expect(
      handlers.get('scrape_as_markdown')!({ url: 'https://example.com', tokenLimit })
    ).rejects.toThrow();
    expect(runSurfaceTool).not.toHaveBeenCalled();
  });

  it('cuts the Markdown to tokenLimit and says how long it was', async () => {
    const { handlers, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue(`<p>${'a'.repeat(100)}</p>`);

    const reply = await handlers.get('scrape_as_markdown')!({
      url: 'https://example.com',
      tokenLimit: 10,
    });

    expect(reply.content).toEqual([
      {
        type: 'text',
        text: 'Truncated to 10 of 100 characters. Call again with a higher tokenLimit to get more.',
      },
      { type: 'text', text: 'a'.repeat(10) },
    ]);
    expect(runSurfaceTool).toHaveBeenCalledWith(
      expect.objectContaining({ args: { url: 'https://example.com' } })
    );
  });

  it('returns the page as-is when it cannot be turned into Markdown', async () => {
    const { handlers, runSurfaceTool } = register();
    const translate = jest.spyOn(NodeHtmlMarkdown, 'translate').mockImplementation(() => {
      throw new Error('bad html');
    });
    runSurfaceTool.mockResolvedValue('<p>raw</p>');

    const reply = await handlers.get('scrape_as_markdown')!({ url: 'https://example.com' });
    translate.mockRestore();

    expect(reply.content.at(-1)).toEqual({ type: 'text', text: '<p>raw</p>' });
  });

  it('lists only the URLs a map found', async () => {
    const { handlers, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue({
      results: [{ content: { links: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }] } }],
    });

    const reply = await handlers.get('map')!({ url: 'https://a.com' });

    expect(reply.content).toEqual([
      { type: 'text', text: JSON.stringify(['https://a.com/1', 'https://a.com/2']) },
    ]);
  });

  it('drops long, rarely useful fields anywhere in a parsed page', async () => {
    const { handlers, runSurfaceTool } = register();
    runSurfaceTool.mockResolvedValue({
      results: { organic: [{ title: 'a', images: ['x'] }], images: ['y'], factoids: [] },
    });

    const reply = await handlers.get('google_search')!({ query: 'coffee' });

    expect(reply.content).toEqual([
      { type: 'text', text: JSON.stringify({ results: { organic: [{ title: 'a' }] } }) },
    ]);
  });

  it('skips a tool it cannot build, registers the rest and reports the skip once', () => {
    const write = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const broken = { ...surface[0], name: 'broken', flow: 'no_such_flow' };
    const registerAll = () => {
      const handlers = new Map<string, Handler>();
      registerSurfaceTools({
        server: {
          registerTool: (name: string, _: unknown, handler: Handler) => handlers.set(name, handler),
        } as never,
        sapiClient: new ScraperApiClient({ schema }),
        auth: apiKey,
        schema,
        tools: [broken, ...surface],
        toolsets: [],
      });

      return handlers;
    };

    const first = registerAll();
    const second = registerAll();
    const skips = write.mock.calls
      .map(([line]) => String(line))
      .filter(line => line.includes('tool_registration_skipped'));
    write.mockRestore();

    expect([...first.keys()]).toEqual(surface.map(tool => tool.name));
    expect([...second.keys()]).toEqual(surface.map(tool => tool.name));
    expect(skips).toHaveLength(1);
    expect(JSON.parse(skips[0])).toMatchObject({ tool: 'broken' });
  });

  it('marks a tool that starts a batch as not read-only', () => {
    let annotations: unknown;
    registerSurfaceTools({
      server: {
        registerTool: (_: string, config: { annotations: unknown }) =>
          (annotations = config.annotations),
      } as never,
      sapiClient: new ScraperApiClient({ schema }),
      auth: apiKey,
      schema,
      tools: [{ name: 'batch', description: 'Batch', flow: 'task_batch' }],
      toolsets: [],
    });

    expect(annotations).toMatchObject({ readOnlyHint: false });
  });

  it('leaves out an empty legacy storeId', async () => {
    const bundled = BundledSchema.shared;
    const walmart = bundled.getSurface('mcp')!.tools.find(tool => tool.name === 'walmart_search')!;
    const sapiClient = new ScraperApiClient({ schema: bundled });
    const runSurfaceTool = jest.spyOn(sapiClient, 'runSurfaceTool').mockResolvedValue({});
    let handler: Handler | undefined;
    registerSurfaceTools({
      server: { registerTool: (_: string, __: unknown, h: Handler) => (handler = h) } as never,
      sapiClient,
      auth: apiKey,
      schema: bundled,
      tools: [walmart],
      toolsets: [],
    });

    await handler!({ query: 'tent', storeId: null });
    await handler!({ query: 'tent', storeId: 42 });

    expect(runSurfaceTool.mock.calls[0][0].args).not.toHaveProperty('walmart_store_id');
    expect(runSurfaceTool.mock.calls[1][0].args).toMatchObject({ walmart_store_id: '42' });
  });
});

describe('tools without an extension', () => {
  const unknownTool = (overrides: Partial<IrSurfaceTool>): IrSurfaceTool => ({
    ...surface.find(tool => tool.name === 'google_search')!,
    name: 'new_tool',
    ...overrides,
  });

  const registerOne = (tool: IrSurfaceTool) => {
    let handler: Handler | undefined;
    const sapiClient = new ScraperApiClient({ schema });
    const runSurfaceTool = jest.spyOn(sapiClient, 'runSurfaceTool');
    registerSurfaceTools({
      server: { registerTool: (_: string, __: unknown, h: Handler) => (handler = h) } as never,
      sapiClient,
      auth: apiKey,
      schema,
      tools: [tool],
      toolsets: [],
    });

    return { handler: handler!, runSurfaceTool };
  };

  it("caps the reply by the tool's limits and says it was cut", async () => {
    const { handler, runSurfaceTool } = registerOne(
      unknownTool({ limits: { maxTextChars: 3, maxResultChars: 1000 } })
    );
    runSurfaceTool.mockResolvedValue({ answer: 'abcdef' });

    const reply = await handler({ query: 'coffee' });

    expect(reply.content).toEqual([
      { type: 'text', text: 'Truncated to fit the reply size limit.' },
      { type: 'text', text: JSON.stringify({ answer: 'abc' }) },
    ]);
  });

  it('returns a PNG screenshot as an image', async () => {
    const { handler, runSurfaceTool } = registerOne({
      ...surface.find(tool => tool.name === 'screenshot')!,
      name: 'full_page_screenshot',
    });
    runSurfaceTool.mockResolvedValue('iVBORw0KGgo=');

    const reply = await handler({ url: 'https://example.com' });

    expect(reply.content).toEqual([{ type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' }]);
  });
});
