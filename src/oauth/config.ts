import { readFileSync } from 'node:fs';
import { log } from '../logger';
import { Sealer } from './sealer';

export const OAUTH_BACKEND = {
  DECODO: 'decodo',
  MOCK: 'mock',
} as const;

export type OAuthBackendKind = (typeof OAUTH_BACKEND)[keyof typeof OAUTH_BACKEND];

export type TokenExchangeClient = {
  clientId: string;
  kid: string;
  privateKey: string;
  baseUrl: URL;
};

export type OAuthConfig = {
  publicUrl: URL;
  backend: OAuthBackendKind;
  stateSecret: string;
  dashboardAuthorizeUrl: URL;
  tokenExchange: TokenExchangeClient;
  allowedRedirectUris: string[];
  mockScraperApiKey: string;
};

export const DEFAULT_DASHBOARD_AUTHORIZE_URL = 'https://dashboard.decodo.com/scraper/token-exchange/decision';

export const DEFAULT_TOKEN_EXCHANGE_BASE_URL =
  'https://dashboard.decodo.com/subscription-api/v1/api/scraper/apikey/token-exchange';

export const DEFAULT_TOKEN_EXCHANGE_CLIENT_ID = 'scrapper-mcp';

export const CLAUDE_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
];

export const CALLBACK_PATH = '/oauth/callback';

export const MCP_PATH = '/mcp';

type Env = Record<string, string | undefined>;

const urlFromEnv = (env: Env, key: string, fallback: string): URL => {
  const value = env[key]?.trim();

  return new URL(value || fallback);
};

const listFromEnv = (env: Env, key: string): string[] =>
  (env[key] ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

const privateKeyFromEnv = (env: Env): string => {
  const file = env.TOKEN_EXCHANGE_PRIVATE_KEY_FILE?.trim();

  if (file) {
    return readFileSync(file, 'utf8');
  }

  return (env.TOKEN_EXCHANGE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
};

const stateSecretFromEnv = (env: Env): string => {
  const secret = env.OAUTH_STATE_SECRET?.trim();

  if (secret) {
    return secret;
  }

  log('warn', 'oauth.state_secret_missing', {
    message: 'OAUTH_STATE_SECRET is not set; using a random one, so sign-in only works with a single replica',
  });

  return Sealer.randomSecret();
};

export const oauthConfigFromEnv = (env: Env, port: number): OAuthConfig => ({
  publicUrl: urlFromEnv(env, 'PUBLIC_URL', `http://localhost:${port}`),
  backend: env.OAUTH_BACKEND === OAUTH_BACKEND.MOCK ? OAUTH_BACKEND.MOCK : OAUTH_BACKEND.DECODO,
  stateSecret: stateSecretFromEnv(env),
  dashboardAuthorizeUrl: urlFromEnv(env, 'DASHBOARD_AUTHORIZE_URL', DEFAULT_DASHBOARD_AUTHORIZE_URL),
  tokenExchange: {
    clientId: env.TOKEN_EXCHANGE_CLIENT_ID?.trim() || DEFAULT_TOKEN_EXCHANGE_CLIENT_ID,
    kid: env.TOKEN_EXCHANGE_KID?.trim() || '',
    privateKey: privateKeyFromEnv(env),
    baseUrl: urlFromEnv(env, 'TOKEN_EXCHANGE_BASE_URL', DEFAULT_TOKEN_EXCHANGE_BASE_URL),
  },
  allowedRedirectUris: [...CLAUDE_REDIRECT_URIS, ...listFromEnv(env, 'OAUTH_ALLOWED_REDIRECT_URIS')],
  mockScraperApiKey: env.MOCK_SCRAPER_API_KEY?.trim() || '',
});
