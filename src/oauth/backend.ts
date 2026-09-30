import type express from 'express';
import type { OAuthConfig } from './config';
import type { GrantExchange } from './grant-exchange';

/**
 * What the provider needs from whoever runs login, consent and key issuance.
 * The real backend is the dashboard plus api.decodo.com; the mock is an in-process stand-in.
 */
export type OAuthBackend = {
  /** Approval screen the browser is sent to. */
  dashboardAuthorizeUrl: URL;
  grantExchange: GrantExchange;
  /** Routes the backend serves itself, if any; the mock hosts its own approval screen. */
  router?: express.Router;
};

export type OAuthBackendFactory = (
  config: OAuthConfig,
  context: { callbackUrl: URL; fetch?: typeof fetch }
) => OAuthBackend;
