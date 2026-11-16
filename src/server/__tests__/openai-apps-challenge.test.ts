import { createServer } from 'node:net';
import type { Server } from 'node:http';
import { OAUTH_BACKEND, oauthConfigFromEnv } from '../../oauth';
import { createApp } from '../app';
import { OPENAI_APPS_CHALLENGE_PATH, openaiAppsChallengeFromEnv } from '../openai-apps-challenge';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(error => (error ? reject(error) : resolve(port)));
    });
  });

type RunningApp = { origin: string; close: () => Promise<void> };

const startApp = async (openaiAppsChallenge?: string): Promise<RunningApp> => {
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const app = createApp({
    oauth: oauthConfigFromEnv(
      {
        PUBLIC_URL: origin,
        OAUTH_BACKEND: OAUTH_BACKEND.MOCK,
        OAUTH_STATE_SECRET: 'test-secret',
        MOCK_SCRAPER_API_KEY: 'sk-live-mock',
      },
      port
    ),
    openaiAppsChallenge,
  });

  const server = await new Promise<Server>(resolve => {
    const listening = app.listen(port, () => resolve(listening));
  });

  return {
    origin,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
};

describe('openaiAppsChallengeFromEnv', () => {
  it('reads the token and trims the newline a copy-paste leaves behind', () => {
    expect(openaiAppsChallengeFromEnv(' token-123\n')).toBe('token-123');
  });

  it('treats an unset or blank value as no token, so the route stays off', () => {
    expect(openaiAppsChallengeFromEnv(undefined)).toBeUndefined();
    expect(openaiAppsChallengeFromEnv('')).toBeUndefined();
    expect(openaiAppsChallengeFromEnv('   ')).toBeUndefined();
  });
});

describe('the OpenAI domain verification challenge', () => {
  it('serves the exact token as plain text, with no JSON wrapper and no trailing newline', async () => {
    const app = await startApp('openai-apps-challenge-token');

    try {
      const response = await fetch(`${app.origin}${OPENAI_APPS_CHALLENGE_PATH}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
      await expect(response.text()).resolves.toBe('openai-apps-challenge-token');
    } finally {
      await app.close();
    }
  });

  it('needs no authorization, because OpenAI fetches it anonymously', async () => {
    const app = await startApp('openai-apps-challenge-token');

    try {
      const response = await fetch(`${app.origin}${OPENAI_APPS_CHALLENGE_PATH}`, {
        headers: { Accept: 'text/plain' },
      });

      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('404s when no token is configured, so verification never passes against an empty body', async () => {
    const app = await startApp();

    try {
      const response = await fetch(`${app.origin}${OPENAI_APPS_CHALLENGE_PATH}`);

      expect(response.status).toBe(404);
    } finally {
      await app.close();
    }
  });
});
