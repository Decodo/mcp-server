import express from 'express';
import { DASHBOARD_QUERY } from '../decodo';
import { MockRequestError } from './subscription-api';
import type { MockSubscriptionApi } from './subscription-api';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

const page = (body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Decodo mock approval</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
  .banner { background: #fff3cd; border: 1px solid #ffe69c; padding: .75rem 1rem; border-radius: .5rem; margin-bottom: 1.5rem; }
  label { display: block; margin: 1rem 0 .25rem; font-weight: 600; }
  input { width: 100%; padding: .5rem; font: inherit; box-sizing: border-box; }
  .actions { display: flex; gap: .75rem; margin-top: 1.5rem; }
  button { padding: .6rem 1.2rem; font: inherit; border-radius: .4rem; border: 1px solid #999; background: #fff; cursor: pointer; }
  button[value=approve] { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
</style>
</head>
<body>
${body}
</body>
</html>`;

/**
 * Stand-in for the dashboard consent page. The MCP server has already registered the
 * request with the mock subscription-api; this page looks it up by `request_uuid`,
 * skips login and sessions, and performs the redirect the real dashboard does after
 * the decision.
 */
export const mockDashboardRouter = ({
  api,
  defaultScraperApiKey,
}: {
  api: MockSubscriptionApi;
  defaultScraperApiKey: string;
}): express.Router => {
  const router = express.Router();

  router.use(express.urlencoded({ extended: false }));

  router.get('/authorize', (req, res) => {
    const uuid = req.query[DASHBOARD_QUERY.REQUEST_UUID];
    const pending = typeof uuid === 'string' ? api.pendingRequest(uuid) : undefined;

    if (!pending) {
      res.status(400).send(page('<h1>Invalid request</h1><p>This connection request is unknown or has expired.</p>'));
      return;
    }

    res.status(200).send(
      page(`
<div class="banner">Mock consent page. The real one lives on dashboard.decodo.com.</div>
<h1>Allow <strong>${escapeHtml(pending.client_id)}</strong> to use your Scraping API key?</h1>
<form method="post" action="authorize/decision">
  <input type="hidden" name="request_uuid" value="${escapeHtml(pending.uuid)}">
  <label for="scraper_api_key">Scraping API key to release</label>
  <input id="scraper_api_key" name="scraper_api_key" value="${escapeHtml(defaultScraperApiKey)}" placeholder="Paste a real key to make the tools work">
  <div class="actions">
    <button type="submit" name="decision" value="approve">Approve</button>
    <button type="submit" name="decision" value="deny">Deny</button>
  </div>
</form>`)
    );
  });

  router.post('/authorize/decision', (req, res) => {
    const { request_uuid: uuid, decision, scraper_api_key: scraperApiKey } = req.body ?? {};

    if (typeof uuid !== 'string' || typeof decision !== 'string') {
      res.status(400).send(page('<h1>Bad request</h1><p>Missing request_uuid or decision.</p>'));
      return;
    }

    const key = typeof scraperApiKey === 'string' && scraperApiKey.trim() ? scraperApiKey.trim() : defaultScraperApiKey;

    let decided;

    try {
      decided = api.decide({ uuid, decision, scraperApiKey: key });
    } catch (error) {
      const detail = error instanceof MockRequestError ? error.message : 'unexpected error';
      res.status(409).send(page(`<h1>Request can no longer be decided</h1><p>${escapeHtml(detail)}</p>`));
      return;
    }

    const redirect = new URL(decided.redirectUri);
    redirect.searchParams.set('state', decided.state);

    if (decided.code) {
      redirect.searchParams.set('code', decided.code);
    } else {
      redirect.searchParams.set('error', decided.error as string);
    }

    res.redirect(302, redirect.href);
  });

  return router;
};
