import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';

export class ScraperAPIStdioServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor({ sapiUsername, sapiPassword }: { sapiUsername: string; sapiPassword: string }) {
    super();

    this.setAuthToken(Buffer.from(`${sapiUsername}:${sapiPassword}`).toString('base64'));
  }
}
