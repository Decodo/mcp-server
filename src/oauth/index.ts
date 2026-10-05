import express from 'express';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthBackendFactory } from './backend';
import { createDecodoBackend } from './backends/decodo';
import { createMockBackend } from './backends/mock';
import { ClientsStore } from './clients-store';
import { CALLBACK_PATH, MCP_PATH, OAUTH_BACKEND } from './config';
import type { OAuthBackendKind, OAuthConfig } from './config';
import { DecodoOAuthProvider } from './provider';
import { oauthRouter } from './router';
import { Sealer } from './sealer';

export { OAUTH_BACKEND, oauthConfigFromEnv } from './config';
export type { OAuthConfig } from './config';

const BACKENDS: Record<OAuthBackendKind, OAuthBackendFactory> = {
  [OAUTH_BACKEND.DECODO]: createDecodoBackend,
  [OAUTH_BACKEND.MOCK]: createMockBackend,
};

export type OAuth = {
  router: express.Router;
  resourceMetadataUrl: string;
};

type FetchLike = typeof fetch;

export const createOAuth = (config: OAuthConfig, { fetch }: { fetch?: FetchLike } = {}): OAuth => {
  const callbackUrl = new URL(CALLBACK_PATH, config.publicUrl);
  const resourceServerUrl = new URL(MCP_PATH, config.publicUrl);
  const sealer = new Sealer(config.stateSecret);
  const backend = BACKENDS[config.backend](config, { callbackUrl, fetch });

  const provider = new DecodoOAuthProvider({
    clientsStore: new ClientsStore({ sealer, allowedRedirectUris: config.allowedRedirectUris, fetch }),
    backend,
    sealer,
    callbackUrl,
  });

  const router = express.Router();

  if (backend.router) {
    router.use(backend.router);
  }

  router.use(oauthRouter({ provider, issuerUrl: config.publicUrl, resourceServerUrl }));

  return {
    router,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  };
};
