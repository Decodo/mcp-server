import { createHash } from 'node:crypto';
import type { Response } from 'express';
import {
  InvalidGrantError,
  InvalidRequestError,
  ServerError,
  UnsupportedGrantTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthBackend } from '../backend';
import { ClientsStore } from '../clients-store';
import { CLAUDE_REDIRECT_URIS } from '../config';
import {
  DecodoOAuthProvider,
  MAX_CODE_CHALLENGE_LENGTH,
  MAX_PENDING_COOKIE_LENGTH,
  MAX_STATE_LENGTH,
  PENDING_COOKIE,
  UnknownAuthorizationRequestError,
  callbackQueryFrom,
} from '../provider';
import { Sealer } from '../sealer';
import { TOKEN_EXCHANGE_ERROR, TokenExchangeError } from '../token-exchange';

const client: OAuthClientInformationFull = {
  client_id: 'client-1',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  token_endpoint_auth_method: 'none',
};

const otherClient: OAuthClientInformationFull = { ...client, client_id: 'client-2' };

const params = {
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  codeChallenge: 'challenge-123',
  scopes: ['scraping'],
  state: 'client-state',
};

const DASHBOARD = 'https://dashboard.decodo.com/authorize';

const CALLBACK = new URL('https://mcp.decodo.com/oauth/callback');

const fakeResponse = () => {
  const res = { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
  return { res, asResponse: res as unknown as Response };
};

const setup = (exchange: jest.Mock = jest.fn()) => {
  const sealer = new Sealer('secret');
  const backend: OAuthBackend & { authorizationUrl: jest.Mock } = {
    authorizationUrl: jest.fn(async ({ state, codeChallenge }) => {
      const url = new URL(DASHBOARD);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', codeChallenge);
      return url;
    }),
    exchange,
  };
  const provider = new DecodoOAuthProvider({
    clientsStore: new ClientsStore({ sealer, allowedRedirectUris: CLAUDE_REDIRECT_URIS }),
    backend,
    sealer,
    callbackUrl: CALLBACK,
  });

  const startAuthorization = async (forClient = client) => {
    const { res, asResponse } = fakeResponse();
    await provider.authorize(forClient, params, asResponse);
    const [, cookie, cookieOptions] = res.cookie.mock.calls[0];
    const dashboardUrl = new URL(res.redirect.mock.calls[0][1] as string);

    return { cookie: cookie as string, cookieOptions, dashboardUrl, upstreamState: dashboardUrl.searchParams.get('state') as string };
  };

  const approve = async (upstreamCode: string, forClient = client) => {
    const { cookie, upstreamState } = await startAuthorization(forClient);
    const { asResponse } = fakeResponse();
    const clientRedirect = new URL(
      provider.handleCallback({ query: { code: upstreamCode, state: upstreamState }, pendingCookie: cookie, res: asResponse })
    );

    return clientRedirect.searchParams.get('code') as string;
  };

  return { provider, backend, startAuthorization, approve };
};

describe('DecodoOAuthProvider.authorize', () => {
  it('sends the browser where the backend says, with a fresh state and PKCE challenge', async () => {
    const { backend, startAuthorization } = setup();
    const { dashboardUrl } = await startAuthorization();

    expect(dashboardUrl.origin + dashboardUrl.pathname).toBe(DASHBOARD);
    const [{ state, codeChallenge }] = backend.authorizationUrl.mock.calls[0];
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toBe(params.state);
  });

  it('parks the pending authorization in an http-only, lax cookie scoped to the callback', async () => {
    const { cookie, cookieOptions } = await setup().startAuthorization();

    expect(cookie).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cookieOptions).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/oauth/callback' });
  });

  it('refuses a client state longer than proxies can carry back', async () => {
    const { provider } = setup();

    await expect(
      provider.authorize(client, { ...params, state: 'x'.repeat(MAX_STATE_LENGTH + 1) }, fakeResponse().asResponse)
    ).rejects.toThrow(InvalidRequestError);
  });

  it('refuses an over-long code_challenge or scope before contacting the backend', async () => {
    const { provider, backend } = setup();

    await expect(
      provider.authorize(client, { ...params, codeChallenge: 'c'.repeat(MAX_CODE_CHALLENGE_LENGTH + 1) }, fakeResponse().asResponse)
    ).rejects.toThrow(InvalidRequestError);
    await expect(
      provider.authorize(client, { ...params, scopes: ['s'.repeat(300)] }, fakeResponse().asResponse)
    ).rejects.toThrow(InvalidRequestError);
    expect(backend.authorizationUrl).not.toHaveBeenCalled();
  });

  it('refuses a request whose pending cookie would not fit a proxy header', async () => {
    const { provider, backend, startAuthorization } = setup();
    const longRedirect = `https://claude.ai/api/mcp/auth_callback?${'q'.repeat(1_000)}`;
    const wide = { ...client, redirect_uris: [longRedirect] };

    await expect(
      provider.authorize(wide, { ...params, redirectUri: longRedirect, state: 's'.repeat(MAX_STATE_LENGTH) }, fakeResponse().asResponse)
    ).rejects.toThrow(InvalidRequestError);
    expect(backend.authorizationUrl).not.toHaveBeenCalled();

    const { cookie } = await startAuthorization();
    expect(cookie.length).toBeLessThanOrEqual(MAX_PENDING_COOKIE_LENGTH);
  });

  it('uses a fresh state and verifier per attempt', async () => {
    const { backend, startAuthorization } = setup();
    await startAuthorization();
    await startAuthorization();

    const [[first], [second]] = backend.authorizationUrl.mock.calls;
    expect(first.state).not.toBe(second.state);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
  });
});

describe('callbackQueryFrom', () => {
  it('keeps only single string parameters and bounds their length', () => {
    expect(callbackQueryFrom({ code: ['a', 'b'], state: 's', error: { nested: true }, extra: 'x' })).toEqual({ state: 's' });
    expect(callbackQueryFrom({ code: '', state: 's' })).toEqual({ state: 's' });
    expect(callbackQueryFrom({ error: 'access_denied', error_description: 'x'.repeat(5_000), state: 's' })).toEqual({
      error: 'access_denied',
      error_description: 'x'.repeat(512),
      state: 's',
    });
  });
});

describe('DecodoOAuthProvider.handleCallback', () => {
  it('redirects the client with a sealed code and its own state on approval', async () => {
    const { provider, startAuthorization } = setup();
    const { cookie, upstreamState } = await startAuthorization();
    const { res, asResponse } = fakeResponse();

    const redirect = new URL(
      provider.handleCallback({ query: { code: 'upstream-code', state: upstreamState }, pendingCookie: cookie, res: asResponse })
    );

    expect(redirect.origin + redirect.pathname).toBe(params.redirectUri);
    expect(redirect.searchParams.get('state')).toBe(params.state);
    expect(redirect.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{60,}$/);
    expect(redirect.searchParams.get('code')).not.toContain('upstream-code');
    expect(res.clearCookie).toHaveBeenCalledWith(PENDING_COOKIE, expect.anything());
  });

  it('forwards a denial as access_denied', async () => {
    const { provider, startAuthorization } = setup();
    const { cookie, upstreamState } = await startAuthorization();

    const redirect = new URL(
      provider.handleCallback({ query: { error: 'access_denied', state: upstreamState }, pendingCookie: cookie, res: fakeResponse().asResponse })
    );

    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe(params.state);
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  it('treats a callback with neither code nor error as invalid_request', async () => {
    const { provider, startAuthorization } = setup();
    const { cookie, upstreamState } = await startAuthorization();

    const redirect = new URL(
      provider.handleCallback({ query: { state: upstreamState }, pendingCookie: cookie, res: fakeResponse().asResponse })
    );

    expect(redirect.searchParams.get('error')).toBe('invalid_request');
  });

  it('rejects a missing cookie, a foreign cookie or a state that does not match it', async () => {
    const { provider, startAuthorization } = setup();
    const { cookie, upstreamState } = await startAuthorization();
    const { asResponse } = fakeResponse();

    expect(() => provider.handleCallback({ query: { code: 'x', state: upstreamState }, res: asResponse })).toThrow(
      UnknownAuthorizationRequestError
    );
    expect(() =>
      provider.handleCallback({ query: { code: 'x', state: 'other-state' }, pendingCookie: cookie, res: asResponse })
    ).toThrow(UnknownAuthorizationRequestError);
    expect(() =>
      provider.handleCallback({ query: { code: 'x', state: upstreamState }, pendingCookie: 'garbage', res: asResponse })
    ).toThrow(UnknownAuthorizationRequestError);
    expect(() => provider.handleCallback({ query: { code: 'x' }, pendingCookie: cookie, res: asResponse })).toThrow(
      UnknownAuthorizationRequestError
    );
  });
});

describe('DecodoOAuthProvider code exchange', () => {
  it('returns the stored code challenge for the issuing client only', async () => {
    const { provider, approve } = setup();
    const code = await approve('upstream');

    await expect(provider.challengeForAuthorizationCode(client, code)).resolves.toBe(params.codeChallenge);
    await expect(provider.challengeForAuthorizationCode(otherClient, code)).rejects.toThrow(InvalidGrantError);
    await expect(provider.challengeForAuthorizationCode(client, 'unknown')).rejects.toThrow(InvalidGrantError);
  });

  it('redeems the upstream code with the verifier matching the challenge it sent', async () => {
    const exchange = jest.fn().mockResolvedValue('sk-live-from-backend');
    const { provider, backend, approve } = setup(exchange);
    const code = await approve('dashboard-code');

    await expect(provider.exchangeAuthorizationCode(client, code, undefined, params.redirectUri)).resolves.toEqual({
      access_token: 'sk-live-from-backend',
      token_type: 'bearer',
      scope: 'scraping',
    });

    const [{ code: upstreamCode, codeVerifier }] = exchange.mock.calls[0];
    const [{ codeChallenge }] = backend.authorizationUrl.mock.calls[0];
    expect(upstreamCode).toBe('dashboard-code');
    expect(createHash('sha256').update(codeVerifier).digest('base64url')).toBe(codeChallenge);
  });

  it('rejects a mismatched redirect_uri or client', async () => {
    const exchange = jest.fn().mockResolvedValue('key');
    const { provider, approve } = setup(exchange);

    await expect(
      provider.exchangeAuthorizationCode(client, await approve('a'), undefined, 'https://attacker.example/cb')
    ).rejects.toThrow(InvalidGrantError);
    await expect(provider.exchangeAuthorizationCode(otherClient, await approve('b'))).rejects.toThrow(InvalidGrantError);
    expect(exchange).not.toHaveBeenCalled();
  });

  it('maps an upstream invalid_grant to invalid_grant and other failures to server_error', async () => {
    const exchange = jest.fn();
    const { provider, approve } = setup(exchange);

    exchange.mockRejectedValueOnce(new TokenExchangeError(TOKEN_EXCHANGE_ERROR.INVALID_GRANT, 'spent'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('a'))).rejects.toThrow(InvalidGrantError);

    exchange.mockRejectedValueOnce(new TokenExchangeError(TOKEN_EXCHANGE_ERROR.INVALID_CLIENT, 'wrong client'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('b'))).rejects.toThrow(ServerError);

    exchange.mockRejectedValueOnce(new TokenExchangeError(TOKEN_EXCHANGE_ERROR.SERVER_ERROR, 'down'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('c'))).rejects.toThrow(ServerError);
  });

  it('does not support refresh tokens', async () => {
    await expect(setup().provider.exchangeRefreshToken()).rejects.toThrow(UnsupportedGrantTypeError);
  });
});
