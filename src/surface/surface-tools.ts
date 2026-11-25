import z from 'zod';
import type { AnyZodObject, ZodRawShape } from 'zod';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { buildToolInputSchema, limitResult } from '@decodo/sdk-ts';
import type { FlowSchema, IrSurfaceTool } from '@decodo/sdk-ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { AuthCredential } from '../auth';
import type { ScraperApiClient } from '../clients/scraper-api-client';
import { TOOLSET } from '../constants';
import { log } from '../logger';
import { ProgressExtra } from '../utils';
import { zodLimit, zodTokenLimit } from '../zod/zod-types';
import { readCrawlResults } from './crawl-results';
import { jsonSchemaToZodShape } from './json-schema-to-zod';

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

type Args = Record<string, unknown>;

type Context = {
  sapiClient: ScraperApiClient;
  auth: AuthCredential;
  tool: IrSurfaceTool;
  args: Args;
  extra?: ProgressExtra;
};

// What the IR cannot describe: inputs that never reach the API, and how a reply is shaped for a model
type Extension = {
  inputs?: ZodRawShape;
  run?: (context: Context) => Promise<Content[]>;
  present?: (data: unknown, args: Args) => Content[];
};

const MARKDOWN_CHARS = 45_000;

const text = (value: string): Content[] => [{ type: 'text', text: value }];

const json = (data: unknown): Content[] => text(JSON.stringify(data));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const withoutKeys = (value: unknown, keys: ReadonlySet<string>): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => withoutKeys(item, keys));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !keys.has(key))
      .map(([key, item]) => [key, withoutKeys(item, keys)])
  );
};

const dropping =
  (...keys: string[]): Extension['present'] =>
  data =>
    json(withoutKeys(data, new Set(keys)));

const picking =
  (...keys: string[]): Extension['present'] =>
  data =>
    json(isRecord(data) ? Object.fromEntries(keys.map(key => [key, data[key]])) : data);

const toMarkdown = (html: string): string => {
  try {
    return NodeHtmlMarkdown.translate(html, {});
  } catch {
    return html;
  }
};

const presentMarkdown: Extension['present'] = (data, { tokenLimit }) => {
  const markdown = toMarkdown(String(data ?? ''));
  const limit = (tokenLimit as number | undefined) || MARKDOWN_CHARS;

  if (markdown.length <= limit) {
    return [...text('Full website content retrieved.'), ...text(markdown)];
  }

  return [
    ...text(
      `Truncated to ${limit} of ${markdown.length} characters. Call again with a higher tokenLimit to get more.`
    ),
    ...text(markdown.slice(0, limit)),
  ];
};

type MapResponse = { results?: { content?: { links?: { url: string }[] } }[] };

const presentLinks: Extension['present'] = data =>
  json(
    ((data as MapResponse).results ?? []).flatMap(
      result => result.content?.links?.map(link => link.url) ?? []
    )
  );

const presentSearch: Extension['present'] = (data, { limit }) => {
  const { organic, ...rest } = data as { organic?: unknown[] };

  return json({ ...rest, organic: organic?.slice(0, limit as number) });
};

const EXTENSIONS: Record<string, Extension> = {
  scrape_as_markdown: { inputs: { tokenLimit: zodTokenLimit }, present: presentMarkdown },
  search: {
    inputs: { limit: zodLimit({ limitedItems: 'results to return', max: 100 }) },
    present: presentSearch,
  },
  map: { present: presentLinks },
  crawl_start: { present: picking('crawl_id', 'status', 'url') },
  crawl_cancel: { present: picking('crawl_id', 'status', 'url') },
  crawl_results: {
    inputs: {
      cursor: z
        .string()
        .describe('nextCursor from a previous crawl_results call; omit for the first pages')
        .optional(),
      limit: zodLimit({ limitedItems: 'pages to return', max: 100 }),
    },
    run: async ({ sapiClient, auth, args, extra }) =>
      text(
        await readCrawlResults({
          sapiClient,
          auth,
          crawlId: args.crawl_id as string,
          cursor: args.cursor as string | undefined,
          limit: args.limit as number,
          extra,
        })
      ),
  },
  google_search: {
    present: dropping(
      'images',
      'image_data',
      'related_searches_urls',
      'factoids',
      'people_also_buy_from',
      'what_people_are_saying'
    ),
  },
  google_ads: { present: dropping('url') },
  google_lens: { present: dropping('url_thumbnail') },
  bing_search: { present: dropping('url') },
  amazon_search: { present: dropping('suggested', 'refinements', 'amazons_choices') },
  amazon_product: { present: dropping('bullet_points', 'description') },
  amazon_pricing: { present: dropping('seller_link') },
  walmart_product: { present: dropping('specifications', 'breadcrumbs') },
};

// Before the tools came from the IR their inputs were camelCase, and agents with saved calls still
// send those names. Optional inputs are renamed; a renamed required one, such as crawlId, still
// fails validation before the call reaches this server.
const LEGACY_INPUTS: Record<string, string> = {
  crawlId: 'crawl_id',
  deliveryZip: 'delivery_zip',
  deviceType: 'device_type',
  domainFilter: 'domain_filter',
  excludePaths: 'exclude_paths',
  maxDepth: 'max_depth',
  pageFrom: 'page_from',
  selectPaths: 'select_paths',
  storeId: 'walmart_store_id',
};

const legacyValue = (name: string, value: unknown): [string, unknown] => {
  if (name === 'jsRender') {
    return ['headless', value === true ? 'html' : undefined];
  }

  if (name === 'storeId') {
    return [LEGACY_INPUTS[name], value || value === 0 ? String(value) : undefined];
  }

  return [LEGACY_INPUTS[name], value];
};

const isLegacy = (name: string): boolean => name === 'jsRender' || name in LEGACY_INPUTS;

const fromLegacy = (input: Args): Args => {
  const renamed: Args = Object.fromEntries(
    Object.entries(input).filter(([name]) => !isLegacy(name))
  );

  for (const [name, value] of Object.entries(input).filter(([name]) => isLegacy(name))) {
    const [current, currentValue] = legacyValue(name, value);

    if (currentValue !== undefined) {
      renamed[current] = currentValue;
    }
  }

  return renamed;
};

const capReply = (tool: IrSurfaceTool, content: Content[]): Content[] => {
  const max = tool.limits?.maxResultChars;

  if (max === undefined || content.every(item => item.type !== 'text' || item.text.length <= max)) {
    return content;
  }

  return [
    ...text('Truncated to fit the reply size limit.'),
    ...content.map(item =>
      item.type === 'text' ? { ...item, text: item.text.slice(0, max) } : item
    ),
  ];
};

const returnsImage = (tool: IrSurfaceTool): boolean => tool.fixed?.headless === 'png';

const presentAsIs = (tool: IrSurfaceTool, data: unknown): Content[] => {
  if (returnsImage(tool) && typeof data === 'string') {
    return [{ type: 'image', data, mimeType: 'image/png' }];
  }

  const { text: shown, truncated } = limitResult(tool.limits, data);

  return truncated
    ? [...text('Truncated to fit the reply size limit.'), ...text(shown)]
    : text(shown);
};

const annotationsOf = (schema: FlowSchema, tool: IrSurfaceTool): ToolAnnotations => ({
  title: tool.title ?? tool.name,
  readOnlyHint:
    tool.step !== 'start' &&
    tool.step !== 'cancel' &&
    schema.getFlow(tool.flow)?.pattern !== 'batch',
  destructiveHint: tool.step === 'cancel',
  ...(tool.step === 'cancel' && { idempotentHint: true }),
  openWorldHint: true,
});

type BuiltTool = { inputs: AnyZodObject; listed: AnyZodObject; annotations: ToolAnnotations };

const LEGACY_TARGETS = new Set(Object.values(LEGACY_INPUTS));

const listedInputs = (inputs: AnyZodObject): AnyZodObject =>
  z
    .object(
      Object.fromEntries(
        Object.entries(inputs.shape as ZodRawShape).map(([name, input]) => [
          name,
          LEGACY_TARGETS.has(name) ? input.optional() : input,
        ])
      )
    )
    .passthrough();

const builtTools = new WeakMap<FlowSchema, Map<IrSurfaceTool, BuiltTool>>();
const reportedSkips = new WeakMap<FlowSchema, Set<string>>();

const buildTool = (schema: FlowSchema, tool: IrSurfaceTool): BuiltTool => {
  const cache = builtTools.get(schema) ?? new Map<IrSurfaceTool, BuiltTool>();
  builtTools.set(schema, cache);

  const cached = cache.get(tool);

  if (cached) {
    return cached;
  }

  const inputs = z.object({
    ...jsonSchemaToZodShape(buildToolInputSchema(schema, tool)),
    ...EXTENSIONS[tool.name]?.inputs,
  });
  const built = { inputs, listed: listedInputs(inputs), annotations: annotationsOf(schema, tool) };
  cache.set(tool, built);

  return built;
};

const reportSkip = (schema: FlowSchema, tool: IrSurfaceTool, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const reported = reportedSkips.get(schema) ?? new Set<string>();
  reportedSkips.set(schema, reported);

  if (reported.has(`${tool.name}:${message}`)) {
    return;
  }

  reported.add(`${tool.name}:${message}`);
  log('error', 'tool_registration_skipped', {
    tool: tool.name,
    ir_version: schema.version,
    message,
  });
};

const registerTool = ({
  server,
  sapiClient,
  auth,
  schema,
  tool,
}: Omit<Context, 'args' | 'extra'> & { server: McpServer; schema: FlowSchema }) => {
  const extension = EXTENSIONS[tool.name] ?? {};
  const clientOnly = Object.keys(extension.inputs ?? {});
  const { inputs, listed, annotations } = buildTool(schema, tool);

  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: listed,
      annotations,
    },
    async (received: Args, extra: ProgressExtra) => {
      const input = inputs.parse(fromLegacy(received));

      if (extension.run) {
        return { content: await extension.run({ sapiClient, auth, tool, args: input, extra }) };
      }

      const args = Object.fromEntries(
        Object.entries(input).filter(([name]) => !clientOnly.includes(name))
      );
      const data = await sapiClient.runSurfaceTool({ auth, tool, args, extra });

      return {
        content: extension.present
          ? capReply(tool, extension.present(data, input))
          : presentAsIs(tool, data),
      };
    }
  );
};

export const registerSurfaceTools = ({
  server,
  sapiClient,
  auth,
  schema,
  tools,
  toolsets,
}: {
  server: McpServer;
  sapiClient: ScraperApiClient;
  auth: AuthCredential;
  schema: FlowSchema;
  tools: IrSurfaceTool[];
  toolsets: TOOLSET[];
}) => {
  const shown = tools.filter(
    tool => toolsets.length === 0 || toolsets.includes(tool.group as TOOLSET)
  );

  for (const tool of shown) {
    try {
      registerTool({ server, sapiClient, auth, schema, tool });
    } catch (error) {
      reportSkip(schema, tool, error);
    }
  }
};
