import { trustProxyFromEnv } from '../trust-proxy';

describe('trustProxyFromEnv', () => {
  it('defaults to trusting nothing', () => {
    expect(trustProxyFromEnv(undefined)).toBe(false);
    expect(trustProxyFromEnv('')).toBe(false);
    expect(trustProxyFromEnv('false')).toBe(false);
  });

  it('accepts a hop count', () => {
    expect(trustProxyFromEnv('1')).toBe(1);
  });

  it('passes address lists and presets through', () => {
    expect(trustProxyFromEnv(' loopback ')).toBe('loopback');
    expect(trustProxyFromEnv('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });

  it('still allows true for setups that accept the spoofing risk', () => {
    expect(trustProxyFromEnv('true')).toBe(true);
  });
});
