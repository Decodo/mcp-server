import 'dotenv/config';

import { exit } from 'process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperAPIMCPServer } from './sapi-mcp-server';

if (process.env.ENABLE_MCPS_LOGGER) {
  import('mcps-logger/console');
}

const parseEnvsOrExit = (): { sapiUsername: string; sapiPassword: string; decodoApiKey?: string } => {
  const requiredEnvs = ['SCRAPER_API_USERNAME', 'SCRAPER_API_PASSWORD'];

  for (const envKey of requiredEnvs) {
    if (!process.env[envKey]) {
      exit(`env ${envKey} missing`);
    }
  }

  return {
    sapiUsername: process.env['SCRAPER_API_USERNAME'] as string,
    sapiPassword: process.env['SCRAPER_API_PASSWORD'] as string,
    decodoApiKey: process.env['DECODO_API_KEY'],
  };
};

async function main() {
  const transport = new StdioServerTransport();

  // if there are no envs, some MCP clients will fail silently
  const { sapiUsername, sapiPassword, decodoApiKey } = parseEnvsOrExit();

  const sapiMcpServer = new ScraperAPIMCPServer({
    sapiUsername,
    sapiPassword,
    decodoApiKey,
  });
  await sapiMcpServer.connect(transport);

  console.error('MCP Server running on stdio');
}

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
