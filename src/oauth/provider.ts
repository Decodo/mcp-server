import { randomBytes, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
  ServerError,
  UnsupportedGrantTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { log } from '../logger';
import type { ClientsStore } from './clients-store';
import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from './grant-exchange';
import type { GrantExchange } from './grant-exchange';
import { TtlStore } from './ttl-store';

const PENDING_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;

/** What the MCP client asked for, parked while the user is on the dashboard. */
type PendingAuthorization = {
  requestId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  state?: string;
};

/** A code handed to the MCP client, carrying the dashboard's code it can be traded for. */
type IssuedAuthorizationCode = Omit<PendingAuthorization, 'state'> & {
  upstreamCode: string;
};

export type CallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

export class UnknownAuthorizationRequestError extends Error {
  constructor() {
    super('This sign-in request is unknown or has expired. Start again from your MCP client.');
    this.name = 'UnknownAuthorizationRequestError';
  }
}

const GRANT_ERROR_TO_OAUTH_ERROR = {
  [GRANT_EXCHANGE_ERROR.INVALID_GRANT]: InvalidGrantError,
  [GRANT_EXCHANGE_ERROR.INVALID_CLIENT]: ServerError,
  [GRANT_EXCHANGE_ERROR.SERVER_ERROR]: ServerError,
};

/**
 * OAuth 2.1 authorization server for the hosted MCP server.
 *
 * Login and consent happen on the Decodo dashboard; this provider only brokers between
 * the MCP client and the dashboard, then trades the dashboard's grant code for a
 * Scraping API key. That key is returned as the access token, so `/mcp` keeps
 * treating `Bearer` tokens as Scraping API keys and OAuth clients need no extra path.
 */
export class DecodoOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: ClientsStore;

  private readonly grantExchange: GrantExchange;

  private readonly dashboardAuthorizeUrl: URL;

  private readonly callbackUrl: URL;

  private readonly appId: string;

  private readonly pending = new TtlStore<PendingAuthorization>(PENDING_AUTHORIZATION_TTL_MS);

  private readonly codes = new TtlStore<IssuedAuthorizationCode>(AUTHORIZATION_CODE_TTL_MS);

  constructor({
    clientsStore,
    grantExchange,
    dashboardAuthorizeUrl,
    callbackUrl,
    appId,
  }: {
    clientsStore: ClientsStore;
    grantExchange: GrantExchange;
    dashboardAuthorizeUrl: URL;
    callbackUrl: URL;
    appId: string;
  }) {
    this.clientsStore = clientsStore;
    this.grantExchange = grantExchange;
    this.dashboardAuthorizeUrl = dashboardAuthorizeUrl;
    this.callbackUrl = callbackUrl;
    this.appId = appId;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const requestId = randomUUID();
    const upstreamState = randomBytes(32).toString('base64url');

    this.pending.set(upstreamState, {
      requestId,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      state: params.state,
    });

    const url = new URL(this.dashboardAuthorizeUrl);
    url.searchParams.set('app', this.appId);
    url.searchParams.set('request_id', requestId);
    url.searchParams.set('redirect_uri', this.callbackUrl.href);
    url.searchParams.set('state', upstreamState);

    log('info', 'oauth.authorize', { clientId: client.client_id, requestId });

    res.redirect(302, url.href);
  }

  /**
   * Handles the browser coming back from the dashboard and returns where to send it next:
   * the MCP client's redirect URI with either a code or an error.
   */
  handleCallback(query: CallbackQuery): string {
    const pending = query.state ? this.pending.take(query.state) : undefined;

    if (!pending) {
      throw new UnknownAuthorizationRequestError();
    }

    const redirect = new URL(pending.redirectUri);

    if (pending.state) {
      redirect.searchParams.set('state', pending.state);
    }

    if (query.error || !query.code) {
      const error = query.error || InvalidRequestError.errorCode;
      redirect.searchParams.set('error', error);

      if (query.error_description) {
        redirect.searchParams.set('error_description', query.error_description);
      }

      log('info', 'oauth.callback.denied', { requestId: pending.requestId, error });

      return redirect.href;
    }

    const code = randomBytes(32).toString('base64url');

    this.codes.set(code, {
      requestId: pending.requestId,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scopes: pending.scopes,
      upstreamCode: query.code,
    });

    redirect.searchParams.set('code', code);

    log('info', 'oauth.callback.approved', { requestId: pending.requestId });

    return redirect.href;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const issued = this.codes.get(authorizationCode);

    if (!issued || issued.clientId !== client.client_id) {
      throw new InvalidGrantError('unknown or expired authorization code');
    }

    return issued.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    const issued = this.codes.take(authorizationCode);

    if (!issued || issued.clientId !== client.client_id) {
      throw new InvalidGrantError('unknown or expired authorization code');
    }

    if (redirectUri && redirectUri !== issued.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the authorization request');
    }

    const scraperApiKey = await this.exchangeUpstream(issued);

    log('info', 'oauth.token.issued', { requestId: issued.requestId, clientId: client.client_id });

    return {
      access_token: scraperApiKey,
      token_type: 'bearer',
      scope: issued.scopes.length > 0 ? issued.scopes.join(' ') : undefined,
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new UnsupportedGrantTypeError('refresh tokens are not issued; reconnect to get a new key');
  }

  /**
   * Access tokens are Scraping API keys, which only the Scraping API can validate.
   * Nothing on this server gates on the result; `/mcp` forwards the key as-is.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!token.trim()) {
      throw new InvalidTokenError('empty access token');
    }

    return { token, clientId: 'unknown', scopes: [] };
  }

  private async exchangeUpstream(issued: IssuedAuthorizationCode): Promise<string> {
    try {
      return await this.grantExchange.exchange(issued.upstreamCode);
    } catch (error) {
      if (error instanceof GrantExchangeError) {
        log('warn', 'oauth.grant_exchange.failed', { requestId: issued.requestId, code: error.code, error: error.message });
        throw new GRANT_ERROR_TO_OAUTH_ERROR[error.code](error.message);
      }

      throw error;
    }
  }
}
