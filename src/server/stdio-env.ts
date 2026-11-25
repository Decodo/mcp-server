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

export const parseStdioEnv = (env: Env): StdioEnv => {
  const value = env.SCRAPER_API_TOKEN?.trim();
  const auth = value ? credentialFromValue(value) : undefined;

  if (!auth) {
    throw new Error('env SCRAPER_API_TOKEN missing: set your API key or basic auth token');
  }

  return {
    auth,
    integrationHeader: env.DECODO_INTEGRATION_HEADER?.trim() || STDIO_INTEGRATION_HEADER,
    hiddenTools: hiddenToolsFromEnv(env.HIDDEN_TOOLS),
  };
};
