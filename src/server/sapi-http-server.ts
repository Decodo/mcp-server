import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import type { AuthenticationErrorListener } from '../clients/scraper-api-client';
import { ScraperAPIBaseServer } from './sapi-base-server';
import { TOOLSET } from '../constants';

export class ScraperAPIHttpServer extends ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  constructor({
    toolsets = [],
    auth,
    onAuthenticationError,
  }: {
    toolsets: TOOLSET[];
    auth: AuthCredential;
    onAuthenticationError?: AuthenticationErrorListener;
  }) {
    super({ auth, toolsets, onAuthenticationError });
  }
}
