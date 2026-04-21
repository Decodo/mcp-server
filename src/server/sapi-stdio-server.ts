import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';
import { TOOLSET } from '../constants';

export class ScraperAPIStdioServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor({
    sapiUsername,
    sapiPassword,
    toolsets = [],
  }: {
    sapiUsername: string;
    sapiPassword: string;
    toolsets: TOOLSET[];
  }) {
    super({ toolsets });

    this.setAuthToken(Buffer.from(`${sapiUsername}:${sapiPassword}`).toString('base64'));
  }
}
