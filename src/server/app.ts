import cors from 'cors';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { credentialFromAuthHeader } from '../auth';
import { createOAuth } from '../oauth';
import type { OAuthConfig } from '../oauth';
import { resolveToolsets } from '../utils';
import { corsOptions } from './cors';
import { RevokedCredentials } from './revoked-credentials';
import { ScraperAPIHttpServer } from './sapi-http-server';

type FetchLike = typeof fetch;

const wwwAuthenticate = (resourceMetadataUrl: string, error?: string): string =>
  error
    ? `Bearer error="${error}", resource_metadata="${resourceMetadataUrl}"`
    : `Bearer resource_metadata="${resourceMetadataUrl}"`;

export const createApp = ({
  oauth: oauthConfig,
  trustProxy = false,
  revokedCredentials = new RevokedCredentials(),
  fetch,
}: {
  oauth: OAuthConfig;
  trustProxy?: boolean;
  revokedCredentials?: RevokedCredentials;
  fetch?: FetchLike;
}): express.Express => {
  const app = express();
  const oauth = createOAuth(oauthConfig, { fetch });

  app.set('trust proxy', trustProxy);

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use(oauth.router);

  app.get('/mcp', (_req, res) => {
    res.status(200).send('server up, use POST /mcp to see available tools');
  });

  app.post('/mcp', async (req, res) => {
    const auth = req.headers.authorization;

    if (!auth) {
      res.set('WWW-Authenticate', wwwAuthenticate(oauth.resourceMetadataUrl));
      res.status(401).send('Unauthorized');
      return;
    }

    const credential = credentialFromAuthHeader(auth);

    if (!credential) {
      res.set('WWW-Authenticate', wwwAuthenticate(oauth.resourceMetadataUrl, 'invalid_token'));
      res.status(401).send("Valid 'Basic' or 'Bearer' authorization required");
      return;
    }

    if (revokedCredentials.has(credential)) {
      res.set('WWW-Authenticate', wwwAuthenticate(oauth.resourceMetadataUrl, 'invalid_token'));
      res.status(401).send('The Scraping API rejected this credential; sign in again');
      return;
    }

    const toolsets = resolveToolsets(req.query.toolsets as string);

    const server = new ScraperAPIHttpServer({
      toolsets,
      auth: credential,
      onAuthenticationError: rejected => revokedCredentials.add(rejected),
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: false,
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
  });

  return app;
};
