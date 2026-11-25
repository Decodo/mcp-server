#!/usr/bin/env node
import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperAPIStdioServer } from './server/sapi-stdio-server';
import { parseStdioEnv } from './server/stdio-env';
import { loadFlowSchema } from './surface/load-schema';
import type { StdioEnv } from './server/stdio-env';
import { resolveToolsets } from './utils';

// if there are no envs, some MCP clients will fail silently
const parseEnvsOrExit = (): StdioEnv => {
  try {
    return parseStdioEnv(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
};

const main = async () => {
  const transport = new StdioServerTransport();

  const { auth, integrationHeader, hiddenTools } = parseEnvsOrExit();
  const schema = await loadFlowSchema({ preferCache: true });

  const sapiMcpServer = new ScraperAPIStdioServer({
    auth,
    toolsets: resolveToolsets(process.env.TOOLSETS),
    hiddenTools,
    integrationHeader,
    schema,
  });
  await sapiMcpServer.connect(transport);

  console.error(`MCP Server running on stdio (auth: ${auth.type})`);
};

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
