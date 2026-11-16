import cors from 'cors';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { credentialFromAuthHeader, credentialFromValue } from '../auth';
import { createOAuth } from '../oauth';
import { CLAUDE_PATH, MCP_PATH } from '../oauth/config';
import type { OAuthConfig } from '../oauth';
import { resolveToolsets } from '../utils';
import { CLAUDE_TOOLS } from './claude-tools';
import { corsOptions } from './cors';
import { RevokedCredentials } from './revoked-credentials';
import { ScraperAPIHttpServer } from './sapi-http-server';
import type { TrustProxy } from './trust-proxy';

type FetchLike = typeof fetch;

const wwwAuthenticate = (resourceMetadataUrl: string, error?: string): string =>
  error
    ? `Bearer error="${error}", resource_metadata="${resourceMetadataUrl}"`
    : `Bearer resource_metadata="${resourceMetadataUrl}"`;

export const createApp = ({
  oauth: oauthConfig,
  trustProxy = false,
  revokedCredentials = new RevokedCredentials(),
  hiddenTools = new Set(),
  fetch,
}: {
  oauth: OAuthConfig;
  trustProxy?: TrustProxy;
  revokedCredentials?: RevokedCredentials;
  hiddenTools?: ReadonlySet<string>;
  fetch?: FetchLike;
}): express.Express => {
  const app = express();
  const oauth = createOAuth(oauthConfig, {
    fetch,
    onTokenIssued: scraperApiKey => {
      const credential = credentialFromValue(scraperApiKey);

      if (credential) {
        revokedCredentials.remove(credential);
      }
    },
  });

  app.set('trust proxy', trustProxy);

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use(oauth.router);

  const serveMcp =
    (
      path: string,
      tools: { hiddenTools?: ReadonlySet<string>; visibleTools?: ReadonlySet<string> }
    ): express.RequestHandler =>
    async (req, res) => {
      const resourceMetadataUrl = oauth.resourceMetadataUrl(path);
      const auth = req.headers.authorization;

      if (!auth) {
        res.set('WWW-Authenticate', wwwAuthenticate(resourceMetadataUrl));
        res.status(401).send('Unauthorized');
        return;
      }

      const credential = credentialFromAuthHeader(auth);

      if (!credential) {
        res.set('WWW-Authenticate', wwwAuthenticate(resourceMetadataUrl, 'invalid_token'));
        res.status(401).send("Valid 'Basic' or 'Bearer' authorization required");
        return;
      }

      if (revokedCredentials.has(credential)) {
        res.set('WWW-Authenticate', wwwAuthenticate(resourceMetadataUrl, 'invalid_token'));
        res.status(401).send('The Scraping API rejected this credential; sign in again');
        return;
      }

      const toolsets = tools.visibleTools ? [] : resolveToolsets(req.query.toolsets as string);

      const server = new ScraperAPIHttpServer({
        toolsets,
        ...tools,
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
    };

  for (const path of [MCP_PATH, CLAUDE_PATH]) {
    app.get(path, (_req, res) => {
      res.status(200).send(`server up, use POST ${path} to see available tools`);
    });
  }

  app.post(MCP_PATH, serveMcp(MCP_PATH, { hiddenTools }));

  app.post(CLAUDE_PATH, serveMcp(CLAUDE_PATH, { visibleTools: CLAUDE_TOOLS }));

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
  });

  return app;
};
