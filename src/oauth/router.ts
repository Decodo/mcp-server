import express from 'express';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { createOAuthMetadata, mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { log } from '../logger';
import { CALLBACK_PATH } from './config';
import { cookieValue } from './cookies';
import { DecodoOAuthProvider, PENDING_COOKIE, UnknownAuthorizationRequestError } from './provider';
import { callbackQueryFrom } from './provider';

const RESOURCE_NAME = 'Decodo MCP Server';

const DOCUMENTATION_URL = new URL('https://github.com/Decodo/mcp-server#readme');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const RATE_LIMITS = {
  register: { windowMs: RATE_LIMIT_WINDOW_MS, max: 500 },
  token: { windowMs: RATE_LIMIT_WINDOW_MS, max: 2_000 },
  authorize: { windowMs: RATE_LIMIT_WINDOW_MS, max: 200 },
};

const errorPage = (message: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Decodo sign-in</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem;">
<h1>Sign-in could not be completed</h1>
<p>${message}</p>
</body></html>`;

const buildOAuthMetadata = ({
  provider,
  issuerUrl,
}: {
  provider: DecodoOAuthProvider;
  issuerUrl: URL;
}): OAuthMetadata => ({
  ...createOAuthMetadata({ provider, issuerUrl, serviceDocumentationUrl: DOCUMENTATION_URL }),
  grant_types_supported: ['authorization_code'],
  token_endpoint_auth_methods_supported: ['none'],
  client_id_metadata_document_supported: true,
});

export const oauthRouter = ({
  provider,
  issuerUrl,
  resourceServerUrl,
}: {
  provider: DecodoOAuthProvider;
  issuerUrl: URL;
  resourceServerUrl: URL;
}): express.Router => {
  const metadata = buildOAuthMetadata({ provider, issuerUrl });
  const router = express.Router();

  router.use(new URL(metadata.authorization_endpoint).pathname, authorizationHandler({ provider, rateLimit: RATE_LIMITS.authorize }));
  router.use(new URL(metadata.token_endpoint).pathname, tokenHandler({ provider, rateLimit: RATE_LIMITS.token }));

  if (metadata.registration_endpoint) {
    router.use(
      new URL(metadata.registration_endpoint).pathname,
      clientRegistrationHandler({ clientsStore: provider.clientsStore, rateLimit: RATE_LIMITS.register })
    );
  }

  router.use(
    mcpAuthMetadataRouter({
      oauthMetadata: metadata,
      resourceServerUrl,
      resourceName: RESOURCE_NAME,
      serviceDocumentationUrl: DOCUMENTATION_URL,
    })
  );

  router.get(CALLBACK_PATH, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    try {
      const redirect = provider.handleCallback({
        query: callbackQueryFrom(req.query),
        pendingCookie: cookieValue(req.headers.cookie, PENDING_COOKIE),
        res,
      });

      res.redirect(302, redirect);
    } catch (error) {
      if (error instanceof UnknownAuthorizationRequestError) {
        res.status(400).send(errorPage(error.message));
        return;
      }

      log('error', 'oauth.callback.failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).send(errorPage('Something went wrong on our side. Try connecting again.'));
    }
  });

  return router;
};
