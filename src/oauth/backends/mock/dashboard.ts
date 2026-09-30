import express from 'express';
import type { MockGrantExchange } from './grant-exchange';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

const MOCK_SUBSCRIPTIONS = [
  { id: 'sub_core_1', label: 'Web Scraping API Core' },
  { id: 'sub_advanced_1', label: 'Web Scraping API Advanced' },
];

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
  input, select { width: 100%; padding: .5rem; font: inherit; box-sizing: border-box; }
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
 * Stand-in for the dashboard approval screen described in the OAuth design doc.
 * It skips login, sessions and CSRF: its only job is to exercise the redirect
 * contract (`code`/`state` on approve, `error=access_denied` on deny) end to end.
 */
export const mockDashboardRouter = ({
  grantExchange,
  callbackUrl,
  defaultScraperApiKey,
}: {
  grantExchange: MockGrantExchange;
  callbackUrl: URL;
  defaultScraperApiKey: string;
}): express.Router => {
  const router = express.Router();

  router.use(express.urlencoded({ extended: false }));

  router.get('/authorize', (req, res) => {
    const { app, request_id: requestId, redirect_uri: redirectUri, state } = req.query;

    if (
      typeof app !== 'string' ||
      typeof requestId !== 'string' ||
      typeof redirectUri !== 'string' ||
      typeof state !== 'string'
    ) {
      res.status(400).send(page('<h1>Bad request</h1><p>Missing app, request_id, redirect_uri or state.</p>'));
      return;
    }

    if (redirectUri !== callbackUrl.href) {
      res.status(400).send(page('<h1>Unknown redirect_uri</h1><p>This application is not allowed to use that callback.</p>'));
      return;
    }

    const options = MOCK_SUBSCRIPTIONS.map(
      subscription => `<option value="${subscription.id}">${subscription.label}</option>`
    ).join('');

    res.status(200).send(
      page(`
<div class="banner">Mock approval screen. The real one lives on dashboard.decodo.com.</div>
<h1>Allow <code>${escapeHtml(app)}</code> to use your Scraping API subscription?</h1>
<form method="post" action="authorize/decision">
  <input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
  <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
  <input type="hidden" name="state" value="${escapeHtml(state)}">
  <label for="subscription_id">Subscription</label>
  <select id="subscription_id" name="subscription_id">${options}</select>
  <label for="scraper_api_key">Scraping API key to issue</label>
  <input id="scraper_api_key" name="scraper_api_key" value="${escapeHtml(defaultScraperApiKey)}" placeholder="Paste a real key to make the tools work">
  <div class="actions">
    <button type="submit" name="decision" value="approve">Approve</button>
    <button type="submit" name="decision" value="deny">Deny</button>
  </div>
</form>`)
    );
  });

  router.post('/authorize/decision', (req, res) => {
    const { redirect_uri: redirectUri, state, decision, scraper_api_key: scraperApiKey } = req.body ?? {};

    if (typeof redirectUri !== 'string' || typeof state !== 'string' || redirectUri !== callbackUrl.href) {
      res.status(400).send(page('<h1>Bad request</h1><p>Missing or unknown redirect_uri.</p>'));
      return;
    }

    const redirect = new URL(redirectUri);
    redirect.searchParams.set('state', state);

    if (decision === 'approve') {
      const key = typeof scraperApiKey === 'string' && scraperApiKey.trim() ? scraperApiKey.trim() : defaultScraperApiKey;
      redirect.searchParams.set('code', grantExchange.mint(key));
    } else {
      redirect.searchParams.set('error', 'access_denied');
    }

    res.redirect(302, redirect.href);
  });

  return router;
};
