import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AUTH_TYPE } from '../../auth';
import { OAUTH_BACKEND, oauthConfigFromEnv } from '../../oauth';
import { cookieValue } from '../../oauth/cookies';
import { PENDING_COOKIE } from '../../oauth/provider';
import { createApp } from '../app';
import { RevokedCredentials } from '../revoked-credentials';

const CLIENT_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(error => (error ? reject(error) : resolve(port)));
    });
  });

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const noRedirect = { redirect: 'manual' as const };

const location = (response: Response): URL => {
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') as string);
};

type BrowserSession = {
  dashboardUrl: URL;
  cookie: string;
};

const browser = {
  open: async (authorizeUrl: URL): Promise<BrowserSession> => {
    const response = await fetch(authorizeUrl, noRedirect);
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith(`${PENDING_COOKIE}=`));

    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Path=\/oauth\/callback/);

    return { dashboardUrl: location(response), cookie: cookieValue(setCookie, PENDING_COOKIE) as string };
  },

  decide: async (dashboardUrl: URL, decision: 'approve' | 'deny', scraperApiKey = ''): Promise<URL> => {
    const consent = await fetch(dashboardUrl);
    expect(consent.status).toBe(200);
    const html = await consent.text();
    const requestUuid = /name="request_uuid" value="([^"]+)"/.exec(html)?.[1] as string;
    expect(requestUuid).toBeTruthy();

    return location(
      await fetch(new URL('authorize/decision', dashboardUrl), {
        ...noRedirect,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ request_uuid: requestUuid, scraper_api_key: scraperApiKey, decision }),
      })
    );
  },

  callback: async (callbackUrl: URL, cookie?: string): Promise<URL> =>
    location(await fetch(callbackUrl, { ...noRedirect, headers: cookie ? { Cookie: `${PENDING_COOKIE}=${cookie}` } : {} })),

  authorize: async (authorizeUrl: URL, decision: 'approve' | 'deny' = 'approve', scraperApiKey = ''): Promise<URL> => {
    const session = await browser.open(authorizeUrl);
    return browser.callback(await browser.decide(session.dashboardUrl, decision, scraperApiKey), session.cookie);
  },
};

class TestOAuthClient implements OAuthClientProvider {
  readonly redirectUrl = CLIENT_REDIRECT;

  readonly clientMetadata = {
    client_name: 'e2e test client',
    redirect_uris: [CLIENT_REDIRECT],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
  };

  authorizationUrl?: URL;

  private information?: OAuthClientInformationMixed;

  private savedTokens?: OAuthTokens;

  private verifier = '';

  clientInformation() {
    return this.information;
  }

  saveClientInformation(information: OAuthClientInformationMixed) {
    this.information = information;
  }

  tokens() {
    return this.savedTokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this.savedTokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL) {
    this.authorizationUrl = authorizationUrl;
  }

  saveCodeVerifier(verifier: string) {
    this.verifier = verifier;
  }

  codeVerifier() {
    return this.verifier;
  }
}

describe('OAuth against the mock backend', () => {
  let server: Server;
  let origin: string;
  const revokedCredentials = new RevokedCredentials();

  beforeAll(async () => {
    const port = await freePort();
    origin = `http://localhost:${port}`;
    const app = createApp({
      oauth: oauthConfigFromEnv(
        { PUBLIC_URL: origin, OAUTH_BACKEND: OAUTH_BACKEND.MOCK, OAUTH_STATE_SECRET: 'test-secret', MOCK_SCRAPER_API_KEY: 'sk-live-mock' },
        port
      ),
      revokedCredentials,
    });
    server = await new Promise(resolve => {
      const listening = app.listen(port, () => resolve(listening));
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  describe('end to end with the MCP SDK client', () => {
    const mcpUrl = () => new URL('/mcp', origin);

    it('connects with the server URL only: discovery, registration, sign-in, token, tools', async () => {
      const authProvider = new TestOAuthClient();
      const client = new Client({ name: 'e2e', version: '0.0.0' });

      const first = new StreamableHTTPClientTransport(mcpUrl(), { authProvider });
      await expect(client.connect(first)).rejects.toBeInstanceOf(UnauthorizedError);
      await first.close();

      expect(authProvider.clientInformation()?.client_id).toBeTruthy();
      expect(authProvider.authorizationUrl?.origin).toBe(origin);
      expect(authProvider.authorizationUrl?.pathname).toBe('/authorize');

      const clientRedirect = await browser.authorize(authProvider.authorizationUrl as URL);
      expect(clientRedirect.origin + clientRedirect.pathname).toBe(CLIENT_REDIRECT);

      const second = new StreamableHTTPClientTransport(mcpUrl(), { authProvider });
      await second.finishAuth(clientRedirect.searchParams.get('code') as string);
      expect(authProvider.tokens()).toEqual({ access_token: 'sk-live-mock', token_type: 'bearer' });

      await client.connect(second);
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toContain('scrape_as_markdown');

      await client.close();
    });

    it('surfaces a denial to the client as access_denied', async () => {
      const authProvider = new TestOAuthClient();
      const client = new Client({ name: 'e2e', version: '0.0.0' });
      const transport = new StreamableHTTPClientTransport(mcpUrl(), { authProvider });

      await expect(client.connect(transport)).rejects.toBeInstanceOf(UnauthorizedError);
      await transport.close();

      const clientRedirect = await browser.authorize(authProvider.authorizationUrl as URL, 'deny');

      expect(clientRedirect.searchParams.get('error')).toBe('access_denied');
      expect(clientRedirect.searchParams.get('state')).toBe(authProvider.authorizationUrl?.searchParams.get('state'));
    });
  });

  describe('HTTP contract', () => {
    const register = (body: object) =>
      fetch(`${origin}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Claude',
          redirect_uris: [CLIENT_REDIRECT],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          ...body,
        }),
      });

    const registerClient = async () => {
      const response = await register({});

      expect(response.status).toBe(201);

      return (await response.json()) as { client_id: string };
    };

    const authorizeUrl = (clientId: string, challenge: string) => {
      const url = new URL('/authorize', origin);
      url.search = form({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: CLIENT_REDIRECT,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'claude-state',
        resource: `${origin}/mcp`,
      });

      return url;
    };

    const requestToken = (fields: Record<string, string>) =>
      fetch(`${origin}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form(fields),
      });

    const postMcp = (authorization?: string) =>
      fetch(`${origin}/mcp`, {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      });

    it('advertises authorization server metadata with PKCE, registration and client id metadata documents', async () => {
      const response = await fetch(`${origin}/.well-known/oauth-authorization-server`);
      const metadata = await response.json();

      expect(response.status).toBe(200);
      expect(metadata).toMatchObject({
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code'],
        token_endpoint_auth_methods_supported: ['none'],
        client_id_metadata_document_supported: true,
      });
    });

    it('advertises protected resource metadata for /mcp', async () => {
      const response = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        resource: `${origin}/mcp`,
        authorization_servers: [`${origin}/`],
      });
    });

    it('answers an unauthenticated /mcp call with 401 pointing at the resource metadata', async () => {
      const response = await postMcp();

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(
        `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`
      );
    });

    it('flags a malformed Authorization header as invalid_token', async () => {
      const response = await postMcp('Token abc');

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
    });

    it('answers a credential the Scraping API has rejected with 401 so the client signs in again', async () => {
      revokedCredentials.add({ type: AUTH_TYPE.API_KEY, value: 'sk-live-dead' });

      const response = await postMcp('Bearer sk-live-dead');

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
      expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    });

    it('refuses to register a redirect uri outside the allowlist', async () => {
      const response = await register({ redirect_uris: [CLIENT_REDIRECT, 'https://evil.example/cb'] });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'invalid_client_metadata' });
    });

    it('refuses to register a confidential client', async () => {
      const response = await register({ token_endpoint_auth_method: 'client_secret_post' });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'invalid_client_metadata' });
    });

    it('registers the signed request with the backend and sends the browser to the consent page with its uuid', async () => {
      const { client_id: clientId } = await registerClient();

      const { dashboardUrl } = await browser.open(authorizeUrl(clientId, pkce().challenge));

      expect(dashboardUrl.href.startsWith(`${origin}/mock/dashboard/authorize?`)).toBe(true);
      expect(dashboardUrl.searchParams.get('request_uuid')).toMatch(/^[0-9a-f-]{36}$/);
      expect(dashboardUrl.searchParams.has('request')).toBe(false);

      const consent = await fetch(dashboardUrl);
      expect(consent.status).toBe(200);
      expect(await consent.text()).toContain('Approve');
    });

    it('issues the key chosen on the consent screen as the access token', async () => {
      const { client_id: clientId } = await registerClient();
      const { verifier, challenge } = pkce();

      const clientRedirect = await browser.authorize(authorizeUrl(clientId, challenge), 'approve', 'sk-live-from-form');
      expect(clientRedirect.searchParams.get('state')).toBe('claude-state');

      const tokenResponse = await requestToken({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: clientRedirect.searchParams.get('code') as string,
        code_verifier: verifier,
        redirect_uri: CLIENT_REDIRECT,
      });

      expect(tokenResponse.status).toBe(200);
      await expect(tokenResponse.json()).resolves.toEqual({ access_token: 'sk-live-from-form', token_type: 'bearer' });
    });

    it('accepts a previously rejected key again once a new sign-in issues it', async () => {
      revokedCredentials.add({ type: AUTH_TYPE.API_KEY, value: 'sk-live-back' });
      expect((await postMcp('Bearer sk-live-back')).status).toBe(401);

      const { client_id: clientId } = await registerClient();
      const { verifier, challenge } = pkce();
      const clientRedirect = await browser.authorize(authorizeUrl(clientId, challenge), 'approve', 'sk-live-back');
      const tokenResponse = await requestToken({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: clientRedirect.searchParams.get('code') as string,
        code_verifier: verifier,
        redirect_uri: CLIENT_REDIRECT,
      });
      expect(tokenResponse.status).toBe(200);

      expect((await postMcp('Bearer sk-live-back')).status).not.toBe(401);
    });

    it('rejects a wrong PKCE verifier and does not spend the code', async () => {
      const { client_id: clientId } = await registerClient();
      const { verifier, challenge } = pkce();
      const clientRedirect = await browser.authorize(authorizeUrl(clientId, challenge));
      const code = clientRedirect.searchParams.get('code') as string;

      const wrong = await requestToken({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: 'wrong' });
      expect(wrong.status).toBe(400);
      await expect(wrong.json()).resolves.toMatchObject({ error: 'invalid_grant' });

      const right = await requestToken({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier });
      expect(right.status).toBe(200);
    });

    it('spends the code on first use', async () => {
      const { client_id: clientId } = await registerClient();
      const { verifier, challenge } = pkce();
      const code = (await browser.authorize(authorizeUrl(clientId, challenge))).searchParams.get('code') as string;

      expect((await requestToken({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier })).status).toBe(200);

      const again = await requestToken({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier });
      expect(again.status).toBe(400);
      await expect(again.json()).resolves.toMatchObject({ error: 'invalid_grant' });
    });

    it('renders an error page when the callback arrives without the pending cookie', async () => {
      const { client_id: clientId } = await registerClient();
      const session = await browser.open(authorizeUrl(clientId, pkce().challenge));
      const callbackUrl = await browser.decide(session.dashboardUrl, 'approve');

      const response = await fetch(callbackUrl, noRedirect);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('unknown or has expired');
    });

    it('rejects an authorization request from an unregistered client', async () => {
      const response = await fetch(`${origin}/authorize?${form({ client_id: 'ghost', redirect_uri: CLIENT_REDIRECT })}`, noRedirect);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'invalid_client' });
    });

    it('keeps Basic and Bearer header access on /mcp', async () => {
      const initialize = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
      });

      for (const authorization of ['Basic dXNlcjpwYXNz', 'Bearer sk-live-mock']) {
        const response = await fetch(`${origin}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: authorization },
          body: initialize,
        });

        expect(response.status).toBe(200);
        await response.body?.cancel();
      }
    });
  });
});
