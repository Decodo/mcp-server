import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import express from 'express';
import { log } from '../../../logger';
import type { OAuthBackendFactory } from '../../backend';
import { DecodoBackend } from '../decodo';
import { mockDashboardRouter } from './dashboard';
import { MockSubscriptionApi, mockSubscriptionApiRouter } from './subscription-api';

export const MOCK_PATH = '/mock';

const MOCK_CLIENT = { clientId: 'mcp-mock', kid: 'mock-key' };

export const createMockBackend: OAuthBackendFactory = (config, { callbackUrl, fetch }) => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const dashboardAuthorizeUrl = new URL(`${MOCK_PATH}/dashboard/authorize`, config.publicUrl);
  const baseUrl = new URL(`${MOCK_PATH}/subscription-api/token-exchange`, config.publicUrl);

  const api = new MockSubscriptionApi(createPublicKey(publicKey), { ...MOCK_CLIENT, redirectUri: callbackUrl.href });

  const router = express.Router();
  router.use(`${MOCK_PATH}/dashboard`, mockDashboardRouter({ api, defaultScraperApiKey: config.mockScraperApiKey }));
  router.use(`${MOCK_PATH}/subscription-api`, mockSubscriptionApiRouter(api));

  const backend = new DecodoBackend({
    client: { ...MOCK_CLIENT, privateKey, baseUrl },
    dashboardAuthorizeUrl,
    callbackUrl,
    issuer: config.publicUrl.host,
    fetch,
  });

  log('warn', 'oauth.mock_backend', { dashboardAuthorizeUrl: dashboardAuthorizeUrl.href });

  return {
    authorizationUrl: authorization => backend.authorizationUrl(authorization),
    exchange: params => backend.exchange(params),
    router,
  };
};
