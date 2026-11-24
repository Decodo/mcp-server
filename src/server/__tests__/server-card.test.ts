import { get } from 'node:http';
import type { Server } from 'node:http';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import { OAUTH_BACKEND, oauthConfigFromEnv } from '../../oauth';
import { PACKAGE_VERSION } from '../../version';
import { createApp } from '../app';
import { SERVER_CARD_PATH } from '../server-card';

const PUBLIC_URL = 'https://mcp.decodo.com';

describe('GET /mcp/server-card', () => {
  let server: Server;
  let cardUrl: string;

  beforeAll(async () => {
    const app = createApp({
      oauth: oauthConfigFromEnv(
        { PUBLIC_URL, OAUTH_BACKEND: OAUTH_BACKEND.MOCK, OAUTH_STATE_SECRET: 'test-secret' },
        0
      ),
    });

    server = await new Promise(resolve => {
      const listening = app.listen(0, () => resolve(listening));
    });

    const { port } = server.address() as { port: number };
    cardUrl = `http://localhost:${port}${SERVER_CARD_PATH}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  });

  it('is served at the reserved path without authorization', async () => {
    expect(SERVER_CARD_PATH).toBe('/mcp/server-card');

    const response = await fetch(cardUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/mcp-server-card\+json/);
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(response.headers.get('etag')).toBeTruthy();
  });

  it('describes the server and its streamable HTTP endpoint', async () => {
    const card = await (await fetch(cardUrl)).json();

    expect(card).toMatchObject({
      $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
      name: 'com.decodo/mcp-server',
      version: PACKAGE_VERSION,
      title: 'Decodo MCP Server',
    });
    expect(card.description.length).toBeLessThanOrEqual(100);
    expect(card.remotes).toHaveLength(1);
    expect(card.remotes[0]).toMatchObject({
      type: 'streamable-http',
      url: `${PUBLIC_URL}/mcp`,
      supportedProtocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
    });
    expect(card.remotes[0].headers).toEqual([
      expect.objectContaining({
        name: 'Authorization',
        value: 'Bearer {api_key}',
        isRequired: true,
        isSecret: true,
        variables: { api_key: expect.objectContaining({ isRequired: true, isSecret: true }) },
      }),
    ]);
  });

  it('does not list tools, resources or prompts', async () => {
    const card = await (await fetch(cardUrl)).json();

    expect(card).not.toHaveProperty('tools');
    expect(card).not.toHaveProperty('resources');
    expect(card).not.toHaveProperty('prompts');
  });

  it('allows any origin, including ones the MCP endpoints reject', async () => {
    const response = await fetch(cardUrl, { headers: { Origin: 'https://example.com' } });

    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-expose-headers')).toBe('ETag');
  });

  it('answers preflight requests for conditional fetches', async () => {
    const response = await fetch(cardUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'If-None-Match',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET');
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type,If-None-Match');
  });

  it('returns 304 when the client already has the current card', async () => {
    const etag = (await fetch(cardUrl)).headers.get('etag') as string;

    // fetch adds "Cache-Control: no-cache" to conditional requests, which forces a full 200
    const status = await new Promise<number | undefined>((resolve, reject) => {
      get(cardUrl, { headers: { 'If-None-Match': etag } }, response => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject);
    });

    expect(status).toBe(304);
  });
});
