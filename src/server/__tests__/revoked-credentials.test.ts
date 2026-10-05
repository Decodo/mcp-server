import { AUTH_TYPE } from '../../auth';
import { RevokedCredentials } from '../revoked-credentials';

describe('RevokedCredentials', () => {
  const apiKey = { type: AUTH_TYPE.API_KEY, value: 'sk-live-dead' };

  it('remembers a rejected credential', () => {
    const revoked = new RevokedCredentials();

    expect(revoked.has(apiKey)).toBe(false);
    revoked.add(apiKey);
    expect(revoked.has(apiKey)).toBe(true);
  });

  it('distinguishes the same value under another scheme', () => {
    const revoked = new RevokedCredentials();
    revoked.add(apiKey);

    expect(revoked.has({ type: AUTH_TYPE.TOKEN, value: apiKey.value })).toBe(false);
  });
});
