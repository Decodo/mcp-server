import { AUTH_TYPE } from '../constants';
import { credentialFromAuthHeader, credentialFromValue } from '../credential';
import { detectCredentialType } from '../detect-credential-type';

const base64 = (value: string) => Buffer.from(value).toString('base64');

describe('detectCredentialType', () => {
  it('treats base64 of user:pass as a token', () => {
    expect(detectCredentialType(base64('testuser:testpass'))).toBe(AUTH_TYPE.TOKEN);
  });

  it('treats a value that does not decode to printable ascii as an api key', () => {
    expect(detectCredentialType('sk-live-abc123')).toBe(AUTH_TYPE.API_KEY);
  });

  it('treats base64 without a colon as an api key', () => {
    expect(detectCredentialType(base64('nocolonhere'))).toBe(AUTH_TYPE.API_KEY);
  });
});

describe('credentialFromValue', () => {
  it('detects a token', () => {
    expect(credentialFromValue(base64('user:pass'))).toEqual({
      type: AUTH_TYPE.TOKEN,
      value: base64('user:pass'),
    });
  });

  it('detects an api key', () => {
    expect(credentialFromValue('sk-live-abc123')).toEqual({
      type: AUTH_TYPE.API_KEY,
      value: 'sk-live-abc123',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(credentialFromValue('  sk-live-abc123  ')?.value).toBe('sk-live-abc123');
  });

  it('returns undefined for empty and whitespace-only values', () => {
    expect(credentialFromValue('')).toBeUndefined();
    expect(credentialFromValue('   ')).toBeUndefined();
  });
});

describe('credentialFromAuthHeader', () => {
  it('maps Basic to a token', () => {
    expect(credentialFromAuthHeader('Basic dGVzdDp0ZXN0')).toEqual({
      type: AUTH_TYPE.TOKEN,
      value: 'dGVzdDp0ZXN0',
    });
  });

  it('maps Bearer to an api key', () => {
    expect(credentialFromAuthHeader('Bearer sk-live-abc123')).toEqual({
      type: AUTH_TYPE.API_KEY,
      value: 'sk-live-abc123',
    });
  });

  it('trusts the scheme over the shape of the value', () => {
    expect(credentialFromAuthHeader(`Bearer ${base64('user:pass')}`)?.type).toBe(AUTH_TYPE.API_KEY);
  });

  it('rejects an unknown scheme', () => {
    expect(credentialFromAuthHeader('Token abc123')).toBeUndefined();
  });

  it('is case sensitive on the scheme', () => {
    expect(credentialFromAuthHeader('basic dGVzdDp0ZXN0')).toBeUndefined();
  });

  it('rejects a missing value, a missing scheme and extra parts', () => {
    expect(credentialFromAuthHeader('Basic')).toBeUndefined();
    expect(credentialFromAuthHeader('dGVzdDp0ZXN0')).toBeUndefined();
    expect(credentialFromAuthHeader('Basic a b')).toBeUndefined();
  });

  it('tolerates padding whitespace', () => {
    expect(credentialFromAuthHeader('  Basic   dGVzdDp0ZXN0  ')).toEqual({
      type: AUTH_TYPE.TOKEN,
      value: 'dGVzdDp0ZXN0',
    });
  });
});
