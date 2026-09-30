import 'dotenv/config';
import { oauthConfigFromEnv } from './oauth';
import { createApp } from './server/app';

const port = parseInt(process.env.PORT || '3000');

const oauth = oauthConfigFromEnv(process.env, port);

createApp({ oauth, trustProxy: process.env.TRUST_PROXY === 'true' })
  .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp (issuer ${oauth.publicUrl.href})`);
  })
  .on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
