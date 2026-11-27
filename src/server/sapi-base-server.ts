import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BundledSchema } from '@decodo/sdk-ts';
import type { FlowSchema, IrSurface } from '@decodo/sdk-ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import type { AuthenticationErrorListener } from '../clients/scraper-api-client';
import { PACKAGE_VERSION } from '../version';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TOOLSET } from '../constants';
import { log } from '../logger';
import { registerSurfaceTools } from '../surface/surface-tools';

const DEFAULT_SURFACE = 'mcp';

const resolveSurface = (
  schema: FlowSchema,
  name: string
): { schema: FlowSchema; name: string; surface: IrSurface } => {
  for (const surfaceName of [name, DEFAULT_SURFACE]) {
    for (const candidate of [schema, BundledSchema.shared]) {
      const surface = candidate.getSurface(surfaceName);

      if (surface) {
        return { schema: candidate, name: surfaceName, surface };
      }
    }
  }

  throw new Error(`The Decodo IR has no "${DEFAULT_SURFACE}" surface to build tools from.`);
};

const loggedFallbacks = new Set<string>();

const logFallback = (
  requested: string,
  resolved: { schema: FlowSchema; name: string },
  loaded: FlowSchema
) => {
  const key = `${loaded.version}:${requested}`;

  if (loggedFallbacks.has(key)) {
    return;
  }

  loggedFallbacks.add(key);
  log('warn', 'surface_fallback', {
    requested,
    surface: resolved.name,
    ir_version: loaded.version,
    bundled: resolved.schema !== loaded,
  });
};

export class ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  auth: AuthCredential;

  schema: FlowSchema;

  surface: string;

  constructor({
    auth,
    toolsets = [],
    hiddenTools = new Set(),
    visibleTools,
    onAuthenticationError,
    integrationHeader = 'mcp',
    schema = BundledSchema.shared,
  }: {
    auth: AuthCredential;
    toolsets: TOOLSET[];
    hiddenTools?: ReadonlySet<string>;
    visibleTools?: ReadonlySet<string>;
    onAuthenticationError?: AuthenticationErrorListener;
    integrationHeader?: string;
    schema?: FlowSchema;
  }) {
    this.server = new McpServer({
      name: 'decodo',
      version: PACKAGE_VERSION,
    });
    const resolved = resolveSurface(schema, integrationHeader);

    if (resolved.name !== integrationHeader || resolved.schema !== schema) {
      logFallback(integrationHeader, resolved, schema);
    }

    this.schema = resolved.schema;
    this.surface = resolved.name;
    this.sapiClient = new ScraperApiClient({
      onAuthenticationError,
      integrationHeader,
      schema: this.schema,
    });

    this.auth = auth;

    this.disableOnRegister(
      name => hiddenTools.has(name) || (visibleTools !== undefined && !visibleTools.has(name))
    );

    this.registerTools({ toolsets });

    this.registerResources();
  }

  connect(transport: StdioServerTransport | StreamableHTTPServerTransport) {
    this.server.connect(transport);
  }

  private disableOnRegister(isHidden: (name: string) => boolean) {
    const registerTool = this.server.registerTool.bind(this.server) as (
      name: string,
      ...config: unknown[]
    ) => RegisteredTool;

    this.server.registerTool = ((name: string, ...config: unknown[]) => {
      const tool = registerTool(name, ...config);

      if (isHidden(name)) {
        tool.disable();
      }

      return tool;
    }) as McpServer['registerTool'];
  }

  registerTools({ toolsets }: { toolsets: TOOLSET[] }) {
    registerSurfaceTools({
      server: this.server,
      sapiClient: this.sapiClient,
      auth: this.auth,
      schema: this.schema,
      tools: this.schema.getSurface(this.surface)?.tools ?? [],
      toolsets,
    });
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
