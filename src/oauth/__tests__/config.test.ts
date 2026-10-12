import { oauthConfigFromEnv } from '../config';

const base = { OAUTH_STATE_SECRET: 'secret' };

describe('oauthConfigFromEnv', () => {
  it('names the variable when a url is invalid', () => {
    expect(() => oauthConfigFromEnv({ ...base, PUBLIC_URL: 'not a url' }, 3000)).toThrow('PUBLIC_URL');
    expect(() => oauthConfigFromEnv({ ...base, DASHBOARD_AUTHORIZE_URL: '/relative' }, 3000)).toThrow(
      'DASHBOARD_AUTHORIZE_URL'
    );
  });

  it('names the variable when the private key file cannot be read', () => {
    expect(() => oauthConfigFromEnv({ ...base, TOKEN_EXCHANGE_PRIVATE_KEY_FILE: '/nonexistent/key.pem' }, 3000)).toThrow(
      'TOKEN_EXCHANGE_PRIVATE_KEY_FILE'
    );
  });
});
