import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';

export class ScraperAPIHttpServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor() {
    super();
  }
}
