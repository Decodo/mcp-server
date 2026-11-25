import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FlowSchema } from '@decodo/sdk-ts';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';
import { TOOLSET } from '../constants';
import { STDIO_INTEGRATION_HEADER } from './stdio-env';

export class ScraperAPIStdioServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor({
    auth,
    toolsets = [],
    hiddenTools,
    integrationHeader = STDIO_INTEGRATION_HEADER,
    schema,
  }: {
    auth: AuthCredential;
    toolsets: TOOLSET[];
    hiddenTools?: ReadonlySet<string>;
    integrationHeader?: string;
    schema?: FlowSchema;
  }) {
    super({ auth, toolsets, hiddenTools, integrationHeader, schema });
  }
}
