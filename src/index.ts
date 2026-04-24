#!/usr/bin/env node
import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperAPIStdioServer } from './server/sapi-stdio-server';
import { resolveToolsets } from './utils';

const parseEnvsOrExit = () => {
  const envs = ['SCRAPER_API_TOKEN'];

  for (const envKey of envs) {
    if (!process.env[envKey]) {
      console.error(`env ${envKey} missing`);
      process.exit(1);
    }
  }

  return {
    sapiAuth: process.env['SCRAPER_API_TOKEN'] as string,
  };
};

const main = async () => {
  const transport = new StdioServerTransport();

  // if there are no envs, some MCP clients will fail silently
  const { sapiAuth } = parseEnvsOrExit();

  const sapiMcpServer = new ScraperAPIStdioServer({
    auth: sapiAuth,
    toolsets: resolveToolsets(process.env.TOOLSETS),
  });
  await sapiMcpServer.connect(transport);

  console.error('MCP Server running on stdio');
};

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
