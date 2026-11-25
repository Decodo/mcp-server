import 'dotenv/config';
import { oauthConfigFromEnv } from './oauth';
import { createApp } from './server/app';
import { hiddenToolsFromEnv } from './server/hidden-tools';
import { IR_TTL_MS, loadFlowSchema } from './surface/load-schema';
import { trustProxyFromEnv } from './server/trust-proxy';

const port = parseInt(process.env.PORT || '3000');

const oauth = oauthConfigFromEnv(process.env, port);

const main = async () => {
  let schema = await loadFlowSchema();

  setInterval(() => {
    void loadFlowSchema({ fallback: schema, ttlMs: 0 }).then(next => {
      if (next.version !== schema.version) {
        schema = next;
      }
    });
  }, IR_TTL_MS).unref();

  createApp({
    oauth,
    trustProxy: trustProxyFromEnv(process.env.TRUST_PROXY),
    hiddenTools: hiddenToolsFromEnv(process.env.HIDDEN_TOOLS),
    schema: () => schema,
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
};

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
