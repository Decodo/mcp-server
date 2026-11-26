import { credentialFromValue } from '../auth';
import type { AuthCredential } from '../auth';
import { hiddenToolsFromEnv } from './hidden-tools';

export const STDIO_INTEGRATION_HEADER = 'mcp';

export type StdioEnv = {
  auth: AuthCredential;
  integrationHeader: string;
  hiddenTools: ReadonlySet<string>;
};

type Env = Record<string, string | undefined>;

const CREDENTIAL_ENVS = ['SCRAPER_API_KEY', 'SCRAPER_API_TOKEN'];

export const parseStdioEnv = (env: Env): StdioEnv => {
  const value = CREDENTIAL_ENVS.map(name => env[name]?.trim()).find(Boolean);
  const auth = value ? credentialFromValue(value) : undefined;

  if (!auth) {
    throw new Error(
      'env SCRAPER_API_KEY missing: set your API key (SCRAPER_API_TOKEN, with an API key or basic auth token, is also accepted)'
    );
  }

  return {
    auth,
    integrationHeader: env.DECODO_INTEGRATION_HEADER?.trim() || STDIO_INTEGRATION_HEADER,
    hiddenTools: hiddenToolsFromEnv(env.HIDDEN_TOOLS),
  };
};
