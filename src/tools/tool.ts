import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { TOOLSET } from '../constants';

export type ToolClass = {
  readonly toolset: TOOLSET;
  register: (args: {
    server: McpServer;
    sapiClient: ScraperApiClient;
    getAuthToken: () => string;
  }) => void;
};
