import type { Response } from 'express';
import {
  InvalidGrantError,
  ServerError,
  UnsupportedGrantTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { MockGrantExchange } from '../backends/mock';
import { ClientsStore } from '../clients-store';
import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from '../grant-exchange';
import { DecodoOAuthProvider, UnknownAuthorizationRequestError } from '../provider';

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

const DASHBOARD = new URL('https://dashboard.decodo.com/authorize');

const CALLBACK = new URL('https://mcp.decodo.com/oauth/callback');

const setup = (grantExchange = new MockGrantExchange()) => {
  const provider = new DecodoOAuthProvider({
    clientsStore: new ClientsStore(),
    grantExchange,
    dashboardAuthorizeUrl: DASHBOARD,
    callbackUrl: CALLBACK,
    appId: 'mcp',
  });

  const startAuthorization = async (forClient = client) => {
    const redirect = jest.fn();
    await provider.authorize(forClient, params, { redirect } as unknown as Response);
    const dashboardUrl = new URL(redirect.mock.calls[0][1] as string);

    return { dashboardUrl, upstreamState: dashboardUrl.searchParams.get('state') as string };
  };

  const approve = async (upstreamCode: string, forClient = client) => {
    const { upstreamState } = await startAuthorization(forClient);
    const clientRedirect = new URL(provider.handleCallback({ code: upstreamCode, state: upstreamState }));

    return clientRedirect.searchParams.get('code') as string;
  };

  return { provider, grantExchange, startAuthorization, approve };
};

describe('DecodoOAuthProvider.authorize', () => {
  it('sends the browser to the dashboard approval screen with the documented query', async () => {
    const { dashboardUrl } = await setup().startAuthorization();

    expect(dashboardUrl.origin + dashboardUrl.pathname).toBe('https://dashboard.decodo.com/authorize');
    expect(dashboardUrl.searchParams.get('app')).toBe('mcp');
    expect(dashboardUrl.searchParams.get('redirect_uri')).toBe(CALLBACK.href);
    expect(dashboardUrl.searchParams.get('request_id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(dashboardUrl.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('does not reuse the client state towards the dashboard', async () => {
    const { upstreamState } = await setup().startAuthorization();

    expect(upstreamState).not.toBe(params.state);
  });
});

describe('DecodoOAuthProvider.handleCallback', () => {
  it('redirects the client with a fresh code and its own state on approval', async () => {
    const { provider, startAuthorization } = setup();
    const { upstreamState } = await startAuthorization();

    const redirect = new URL(provider.handleCallback({ code: 'upstream-code', state: upstreamState }));

    expect(redirect.origin + redirect.pathname).toBe(params.redirectUri);
    expect(redirect.searchParams.get('state')).toBe(params.state);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('code')).not.toBe('upstream-code');
  });

  it('forwards a denial as access_denied', async () => {
    const { provider, startAuthorization } = setup();
    const { upstreamState } = await startAuthorization();

    const redirect = new URL(provider.handleCallback({ error: 'access_denied', state: upstreamState }));

    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe(params.state);
    expect(redirect.searchParams.has('code')).toBe(false);
  });

  it('treats a callback with neither code nor error as invalid_request', async () => {
    const { provider, startAuthorization } = setup();
    const { upstreamState } = await startAuthorization();

    const redirect = new URL(provider.handleCallback({ state: upstreamState }));

    expect(redirect.searchParams.get('error')).toBe('invalid_request');
  });

  it('rejects an unknown state instead of redirecting', () => {
    const { provider } = setup();

    expect(() => provider.handleCallback({ code: 'x', state: 'nope' })).toThrow(UnknownAuthorizationRequestError);
    expect(() => provider.handleCallback({ code: 'x' })).toThrow(UnknownAuthorizationRequestError);
  });

  it('consumes the pending authorization so the callback cannot be replayed', async () => {
    const { provider, startAuthorization } = setup();
    const { upstreamState } = await startAuthorization();
    provider.handleCallback({ code: 'x', state: upstreamState });

    expect(() => provider.handleCallback({ code: 'x', state: upstreamState })).toThrow(
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

  it('issues the scraper api key from the grant exchange as the access token', async () => {
    const grantExchange = new MockGrantExchange();
    const { provider, approve } = setup(grantExchange);
    const code = await approve(grantExchange.mint('sk-live-from-dashboard'));

    await expect(provider.exchangeAuthorizationCode(client, code, undefined, params.redirectUri)).resolves.toEqual({
      access_token: 'sk-live-from-dashboard',
      token_type: 'bearer',
      scope: 'scraping',
    });
  });

  it('spends the code on first use', async () => {
    const grantExchange = new MockGrantExchange();
    const { provider, approve } = setup(grantExchange);
    const code = await approve(grantExchange.mint('key'));

    await provider.exchangeAuthorizationCode(client, code);

    await expect(provider.exchangeAuthorizationCode(client, code)).rejects.toThrow(InvalidGrantError);
  });

  it('rejects a mismatched redirect_uri or client', async () => {
    const grantExchange = new MockGrantExchange();
    const { provider, approve } = setup(grantExchange);

    const first = await approve(grantExchange.mint('key'));
    await expect(
      provider.exchangeAuthorizationCode(client, first, undefined, 'https://attacker.example/cb')
    ).rejects.toThrow(InvalidGrantError);

    const second = await approve(grantExchange.mint('key'));
    await expect(provider.exchangeAuthorizationCode(otherClient, second)).rejects.toThrow(InvalidGrantError);
  });

  it('maps an upstream invalid_grant to invalid_grant and other failures to server_error', async () => {
    const failing = { exchange: jest.fn() };
    const { provider, approve } = setup(failing);

    failing.exchange.mockRejectedValueOnce(new GrantExchangeError(GRANT_EXCHANGE_ERROR.INVALID_GRANT, 'spent'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('a'))).rejects.toThrow(InvalidGrantError);

    failing.exchange.mockRejectedValueOnce(new GrantExchangeError(GRANT_EXCHANGE_ERROR.INVALID_CLIENT, 'bad secret'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('b'))).rejects.toThrow(ServerError);

    failing.exchange.mockRejectedValueOnce(new GrantExchangeError(GRANT_EXCHANGE_ERROR.SERVER_ERROR, 'down'));
    await expect(provider.exchangeAuthorizationCode(client, await approve('c'))).rejects.toThrow(ServerError);
  });

  it('passes the dashboard code through to the grant exchange', async () => {
    const exchange = { exchange: jest.fn().mockResolvedValue('key') };
    const { provider, approve } = setup(exchange);

    await provider.exchangeAuthorizationCode(client, await approve('dashboard-code'));

    expect(exchange.exchange).toHaveBeenCalledWith('dashboard-code');
  });

  it('does not support refresh tokens', async () => {
    await expect(setup().provider.exchangeRefreshToken()).rejects.toThrow(UnsupportedGrantTypeError);
  });
});
