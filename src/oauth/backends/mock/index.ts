import express from 'express';
import { log } from '../../../logger';
import type { OAuthBackendFactory } from '../../backend';
import { mockDashboardRouter } from './dashboard';
import { MockGrantExchange } from './grant-exchange';

export const MOCK_DASHBOARD_PATH = '/mock/dashboard';

/**
 * Runs the approval screen and the grant exchange inside this process, for local
 * development and end-to-end tests while the real backend does not exist.
 */
export const createMockBackend: OAuthBackendFactory = (config, { callbackUrl }) => {
  const grantExchange = new MockGrantExchange();
  const dashboardAuthorizeUrl = new URL(`${MOCK_DASHBOARD_PATH}/authorize`, config.publicUrl);
  const router = express.Router();

  router.use(
    MOCK_DASHBOARD_PATH,
    mockDashboardRouter({ grantExchange, callbackUrl, defaultScraperApiKey: config.mockScraperApiKey })
  );

  log('warn', 'oauth.mock_backend', { dashboardAuthorizeUrl: dashboardAuthorizeUrl.href });

  return { dashboardAuthorizeUrl, grantExchange, router };
};

export { MockGrantExchange } from './grant-exchange';
