import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';
import { TOOLSET } from '../constants';

export class ScraperAPIStdioServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor({ auth, toolsets = [] }: { auth: AuthCredential; toolsets: TOOLSET[] }) {
    super({ auth, toolsets });
  }
}
