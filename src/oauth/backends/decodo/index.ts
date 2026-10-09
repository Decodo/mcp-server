import type { KeyObject } from 'node:crypto';
import { ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { log } from '../../../logger';
import type { OAuthBackend, OAuthBackendFactory, UpstreamAuthorization } from '../../backend';
import type { TokenExchangeClient } from '../../config';
import { TokenExchangeError } from '../../token-exchange';
import { parsePrivateKey, requestJwtClaims, signRequestJwt } from './request-jwt';
import { HttpTokenExchange } from './token-exchange';

type FetchLike = typeof fetch;

export const DASHBOARD_QUERY = {
  REQUEST_UUID: 'request_uuid',
} as const;

export class DecodoBackend implements OAuthBackend {
  private readonly privateKey?: KeyObject;

  private readonly tokenExchange: HttpTokenExchange;

  private readonly client: TokenExchangeClient;

  private readonly dashboardAuthorizeUrl: URL;

  private readonly callbackUrl: URL;

  private readonly issuer: string;

  constructor({
    client,
    dashboardAuthorizeUrl,
    callbackUrl,
    issuer,
    fetch,
  }: {
    client: TokenExchangeClient;
    dashboardAuthorizeUrl: URL;
    callbackUrl: URL;
    issuer: string;
    fetch?: FetchLike;
  }) {
    this.client = client;
    this.dashboardAuthorizeUrl = dashboardAuthorizeUrl;
    this.callbackUrl = callbackUrl;
    this.issuer = issuer;
    this.tokenExchange = new HttpTokenExchange({ baseUrl: client.baseUrl, clientId: client.clientId, fetch });

    if (client.privateKey && client.kid) {
      this.privateKey = parsePrivateKey(client.privateKey);
    } else {
      log('warn', 'oauth.token_exchange_client_incomplete', {
        message: 'TOKEN_EXCHANGE_PRIVATE_KEY and TOKEN_EXCHANGE_KID are required for sign-in',
      });
    }
  }

  async authorizationUrl({ state, codeChallenge }: UpstreamAuthorization): Promise<URL> {
    if (!this.privateKey) {
      throw new ServerError('sign-in is not configured on this server');
    }

    const request = signRequestJwt({
      privateKey: this.privateKey,
      kid: this.client.kid,
      claims: requestJwtClaims({
        issuer: this.issuer,
        clientId: this.client.clientId,
        redirectUri: this.callbackUrl.href,
        state,
        codeChallenge,
      }),
    });

    let pending;

    try {
      pending = await this.tokenExchange.createRequest(request);
    } catch (error) {
      if (error instanceof TokenExchangeError) {
        log('error', 'oauth.token_exchange.request_failed', { error: error.message });
        throw new ServerError('could not start sign-in with the Decodo backend');
      }

      throw error;
    }

    const url = new URL(this.dashboardAuthorizeUrl);
    url.searchParams.set(DASHBOARD_QUERY.REQUEST_UUID, pending.uuid);

    return url;
  }

  exchange(params: { code: string; codeVerifier: string }): Promise<string> {
    return this.tokenExchange.exchange(params);
  }
}

export const createDecodoBackend: OAuthBackendFactory = (config, { callbackUrl, fetch }) =>
  new DecodoBackend({
    client: config.tokenExchange,
    dashboardAuthorizeUrl: config.dashboardAuthorizeUrl,
    callbackUrl,
    issuer: config.publicUrl.host,
    fetch,
  });
