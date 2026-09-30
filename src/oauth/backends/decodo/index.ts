import { log } from '../../../logger';
import type { OAuthBackendFactory } from '../../backend';
import { HttpGrantExchange } from './grant-exchange';

/** The production backend: approval on dashboard.decodo.com, key issuance on api.decodo.com. */
export const createDecodoBackend: OAuthBackendFactory = (config, { fetch }) => {
  if (!config.grantExchangeSecret) {
    log('warn', 'oauth.grant_exchange_secret_missing', { grantExchangeUrl: config.grantExchangeUrl.href });
  }

  return {
    dashboardAuthorizeUrl: config.dashboardAuthorizeUrl,
    grantExchange: new HttpGrantExchange({
      url: config.grantExchangeUrl,
      secret: config.grantExchangeSecret,
      fetch,
    }),
  };
};
