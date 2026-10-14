import 'dotenv/config';
import { oauthConfigFromEnv } from './oauth';
import { createApp } from './server/app';
import { hiddenToolsFromEnv } from './server/hidden-tools';
import { trustProxyFromEnv } from './server/trust-proxy';

const port = parseInt(process.env.PORT || '3000');

const oauth = oauthConfigFromEnv(process.env, port);

createApp({
  oauth,
  trustProxy: trustProxyFromEnv(process.env.TRUST_PROXY),
  hiddenTools: hiddenToolsFromEnv(process.env.HIDDEN_TOOLS),
})
  .listen(port, () => {
    console.log(
      `Demo MCP Server running on http://localhost:${port}/mcp (issuer ${oauth.publicUrl.href})`
    );
  })
  .on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
