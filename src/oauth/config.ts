export const OAUTH_BACKEND = {
  DECODO: 'decodo',
  MOCK: 'mock',
} as const;

export type OAuthBackendKind = (typeof OAUTH_BACKEND)[keyof typeof OAUTH_BACKEND];

export type OAuthConfig = {
  /** Public origin of this server; used as the OAuth issuer and to build callback URLs. */
  publicUrl: URL;
  /** Identifies this application on the dashboard approval screen (`?app=`). */
  appId: string;
  backend: OAuthBackendKind;
  /** Dashboard approval screen the browser is sent to. */
  dashboardAuthorizeUrl: URL;
  /** Backend endpoint that turns a one-time grant code into a Scraping API key. */
  grantExchangeUrl: URL;
  /** Service credential presented to the grant exchange endpoint. */
  grantExchangeSecret: string;
  /** Scraping API key the mock backend hands out when the approval form leaves the key empty. */
  mockScraperApiKey: string;
};

export const DEFAULT_DASHBOARD_AUTHORIZE_URL = 'https://dashboard.decodo.com/authorize';

export const DEFAULT_GRANT_EXCHANGE_URL = 'https://api.decodo.com/api/v1/grants/exchange';

export const CALLBACK_PATH = '/oauth/callback';

export const MCP_PATH = '/mcp';

type Env = Record<string, string | undefined>;

const urlFromEnv = (env: Env, key: string, fallback: string): URL => {
  const value = env[key]?.trim();

  return new URL(value || fallback);
};

export const oauthConfigFromEnv = (env: Env, port: number): OAuthConfig => ({
  publicUrl: urlFromEnv(env, 'PUBLIC_URL', `http://localhost:${port}`),
  appId: env.OAUTH_APP_ID?.trim() || 'mcp',
  backend: env.OAUTH_BACKEND === OAUTH_BACKEND.MOCK ? OAUTH_BACKEND.MOCK : OAUTH_BACKEND.DECODO,
  dashboardAuthorizeUrl: urlFromEnv(env, 'DASHBOARD_AUTHORIZE_URL', DEFAULT_DASHBOARD_AUTHORIZE_URL),
  grantExchangeUrl: urlFromEnv(env, 'GRANT_EXCHANGE_URL', DEFAULT_GRANT_EXCHANGE_URL),
  grantExchangeSecret: env.GRANT_EXCHANGE_SECRET?.trim() || '',
  mockScraperApiKey: env.MOCK_SCRAPER_API_KEY?.trim() || '',
});
