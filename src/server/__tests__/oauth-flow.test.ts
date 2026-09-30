import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAUTH_BACKEND, oauthConfigFromEnv } from '../../oauth';
import { createApp } from '../app';

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

/** What a person does in the browser between the MCP client's redirect and the callback. */
const browser = {
  /** Opens the authorize URL, which bounces to the mock approval screen. */
  open: async (authorizeUrl: URL) => location(await fetch(authorizeUrl, noRedirect)),

  /** Submits the approval form and follows the dashboard's redirect to our callback. */
  decide: async (dashboardUrl: URL, decision: 'approve' | 'deny', scraperApiKey = '') =>
    location(
      await fetch(new URL('authorize/decision', dashboardUrl), {
        ...noRedirect,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({
          request_id: dashboardUrl.searchParams.get('request_id') as string,
          redirect_uri: dashboardUrl.searchParams.get('redirect_uri') as string,
          state: dashboardUrl.searchParams.get('state') as string,
          subscription_id: 'sub_core_1',
          scraper_api_key: scraperApiKey,
          decision,
        }),
      })
    ),

  /** Follows our callback to wherever it sends the MCP client. */
  callback: async (callbackUrl: URL) => location(await fetch(callbackUrl, noRedirect)),

  /** The whole trip: returns the redirect the MCP client would receive. */
  authorize: async (authorizeUrl: URL, decision: 'approve' | 'deny' = 'approve', scraperApiKey = '') =>
    browser.callback(await browser.decide(await browser.open(authorizeUrl), decision, scraperApiKey)),
};

/** Minimal in-memory OAuthClientProvider, the part of Claude that talks to our authorization server. */
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

  beforeAll(async () => {
    const port = await freePort();
    origin = `http://localhost:${port}`;
    const app = createApp({
      oauth: oauthConfigFromEnv({ PUBLIC_URL: origin, OAUTH_BACKEND: OAUTH_BACKEND.MOCK, MOCK_SCRAPER_API_KEY: 'sk-live-mock' }, port),
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
    const registerClient = async () => {
      const response = await fetch(`${origin}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Claude',
          redirect_uris: [CLIENT_REDIRECT],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
        }),
      });

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
        client_id_metadata_document_supported: true,
      });
      expect(metadata.token_endpoint_auth_methods_supported).toContain('none');
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
      const response = await fetch(`${origin}/mcp`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(
        `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`
      );
    });

    it('flags a malformed Authorization header as invalid_token', async () => {
      const response = await fetch(`${origin}/mcp`, {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json', Authorization: 'Token abc' },
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
    });

    it('sends the browser to the approval screen with the documented query', async () => {
      const { client_id: clientId } = await registerClient();

      const dashboardUrl = await browser.open(authorizeUrl(clientId, pkce().challenge));

      expect(dashboardUrl.href.startsWith(`${origin}/mock/dashboard/authorize?`)).toBe(true);
      expect(dashboardUrl.searchParams.get('app')).toBe('mcp');
      expect(dashboardUrl.searchParams.get('redirect_uri')).toBe(`${origin}/oauth/callback`);

      const approvalPage = await fetch(dashboardUrl);
      expect(approvalPage.status).toBe(200);
      expect(await approvalPage.text()).toContain('Approve');
    });

    it('issues the key chosen on the approval form as the access token', async () => {
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

    it('renders an error page for a callback with an unknown state', async () => {
      const response = await fetch(`${origin}/oauth/callback?code=x&state=unknown`, noRedirect);

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
