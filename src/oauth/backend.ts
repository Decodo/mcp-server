import type express from 'express';
import type { OAuthConfig } from './config';

export type UpstreamAuthorization = {
  state: string;
  codeChallenge: string;
};

export interface OAuthBackend {
  authorizationUrl(authorization: UpstreamAuthorization): Promise<URL>;
  exchange(params: { code: string; codeVerifier: string }): Promise<string>;
  router?: express.Router;
}

export type OAuthBackendFactory = (
  config: OAuthConfig,
  context: { callbackUrl: URL; fetch?: typeof fetch }
) => OAuthBackend;
