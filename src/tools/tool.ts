import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { TOOLSET } from '../constants';

export type ToolRegistrationArgs = {
  server: McpServer;
  sapiClient: ScraperApiClient;
  auth: AuthCredential;
};

export abstract class Tool {
  abstract toolset: TOOLSET;

  abstract register(args: ToolRegistrationArgs): void;

  abstract transformResponse({
    data,
    tokenLimit,
  }: {
    data: string | object;
    tokenLimit?: number;
  }): { data: string; isTruncated?: boolean };
}
