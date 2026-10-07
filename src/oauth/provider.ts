import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
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
import type { OAuthBackend } from './backend';
import type { ClientsStore } from './clients-store';
import type { Sealer } from './sealer';
import { TOKEN_EXCHANGE_ERROR, TokenExchangeError } from './token-exchange';

export const PENDING_COOKIE = 'decodo_oauth_pending';

const PENDING_TTL_MS = 10 * 60 * 1000;

const CODE_TTL_MS = 60 * 1000;

const SEAL = {
  PENDING: 'pending',
  CODE: 'code',
} as const;

type PendingAuthorization = {
  requestId: string;
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  clientState?: string;
};

type IssuedAuthorizationCode = Pick<
  PendingAuthorization,
  'requestId' | 'clientId' | 'redirectUri' | 'codeChallenge' | 'scopes' | 'codeVerifier'
> & {
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

const EXCHANGE_ERROR_TO_OAUTH_ERROR = {
  [TOKEN_EXCHANGE_ERROR.INVALID_GRANT]: InvalidGrantError,
  [TOKEN_EXCHANGE_ERROR.INVALID_CLIENT]: ServerError,
  [TOKEN_EXCHANGE_ERROR.SERVER_ERROR]: ServerError,
};

const randomToken = (): string => randomBytes(32).toString('base64url');

const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export class DecodoOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: ClientsStore;

  private readonly backend: OAuthBackend;

  private readonly sealer: Sealer;

  private readonly cookieOptions: CookieOptions;

  private readonly onTokenIssued?: (scraperApiKey: string) => void;

  constructor({
    clientsStore,
    backend,
    sealer,
    callbackUrl,
    onTokenIssued,
  }: {
    clientsStore: ClientsStore;
    backend: OAuthBackend;
    sealer: Sealer;
    callbackUrl: URL;
    onTokenIssued?: (scraperApiKey: string) => void;
  }) {
    this.clientsStore = clientsStore;
    this.backend = backend;
    this.sealer = sealer;
    this.onTokenIssued = onTokenIssued;
    this.cookieOptions = {
      httpOnly: true,
      secure: callbackUrl.protocol === 'https:',
      sameSite: 'lax',
      path: callbackUrl.pathname,
      maxAge: PENDING_TTL_MS,
    };
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const pending: PendingAuthorization = {
      requestId: randomToken(),
      state: randomToken(),
      codeVerifier: randomToken(),
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      clientState: params.state,
    };

    const url = await this.backend.authorizationUrl({
      state: pending.state,
      codeChallenge: pkceChallenge(pending.codeVerifier),
    });

    log('info', 'oauth.authorize', { clientId: client.client_id, requestId: pending.requestId });

    res.cookie(PENDING_COOKIE, this.sealer.seal(SEAL.PENDING, pending, PENDING_TTL_MS), this.cookieOptions);
    res.redirect(302, url.href);
  }

  handleCallback({ query, pendingCookie, res }: { query: CallbackQuery; pendingCookie?: string; res: Response }): string {
    const pending = pendingCookie ? this.sealer.unseal<PendingAuthorization>(SEAL.PENDING, pendingCookie) : undefined;

    if (!pending || !query.state || query.state !== pending.state) {
      throw new UnknownAuthorizationRequestError();
    }

    res.clearCookie(PENDING_COOKIE, this.cookieOptions);

    const redirect = new URL(pending.redirectUri);

    if (pending.clientState) {
      redirect.searchParams.set('state', pending.clientState);
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

    const issued: IssuedAuthorizationCode = {
      requestId: pending.requestId,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scopes: pending.scopes,
      codeVerifier: pending.codeVerifier,
      upstreamCode: query.code,
    };

    redirect.searchParams.set('code', this.sealer.seal(SEAL.CODE, issued, CODE_TTL_MS));

    log('info', 'oauth.callback.approved', { requestId: pending.requestId });

    return redirect.href;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    return this.issuedCode(client, authorizationCode).codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    const issued = this.issuedCode(client, authorizationCode);

    if (redirectUri && redirectUri !== issued.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the authorization request');
    }

    const scraperApiKey = await this.redeem(issued);

    log('info', 'oauth.token.issued', { requestId: issued.requestId, clientId: client.client_id });
    this.onTokenIssued?.(scraperApiKey);

    return {
      access_token: scraperApiKey,
      token_type: 'bearer',
      scope: issued.scopes.length > 0 ? issued.scopes.join(' ') : undefined,
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new UnsupportedGrantTypeError('refresh tokens are not issued; reconnect to get a new key');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!token.trim()) {
      throw new InvalidTokenError('empty access token');
    }

    return { token, clientId: 'unknown', scopes: [] };
  }

  private issuedCode(client: OAuthClientInformationFull, authorizationCode: string): IssuedAuthorizationCode {
    const issued = this.sealer.unseal<IssuedAuthorizationCode>(SEAL.CODE, authorizationCode);

    if (!issued || issued.clientId !== client.client_id) {
      throw new InvalidGrantError('unknown or expired authorization code');
    }

    return issued;
  }

  private async redeem(issued: IssuedAuthorizationCode): Promise<string> {
    try {
      return await this.backend.exchange({ code: issued.upstreamCode, codeVerifier: issued.codeVerifier });
    } catch (error) {
      if (error instanceof TokenExchangeError) {
        log('warn', 'oauth.token_exchange.failed', { requestId: issued.requestId, code: error.code, error: error.message });
        throw new EXCHANGE_ERROR_TO_OAUTH_ERROR[error.code](error.message);
      }

      throw error;
    }
  }
}
