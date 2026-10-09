import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { parsePrivateKey, requestJwtClaims, signRequestJwt } from '../../decodo/request-jwt';
import { MockRequestError, MockSubscriptionApi } from '../subscription-api';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const registered = { clientId: 'mcp-mock', kid: 'mock-key', redirectUri: 'http://localhost:3000/oauth/callback' };

const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const challenge = createHash('sha256').update(verifier).digest('base64url');

const signed = (overrides: Partial<ReturnType<typeof requestJwtClaims>> = {}, kid = registered.kid) =>
  signRequestJwt({
    privateKey: parsePrivateKey(privateKey),
    kid,
    claims: {
      ...requestJwtClaims({
        issuer: 'localhost:3000',
        clientId: registered.clientId,
        redirectUri: registered.redirectUri,
        state: 'state-of-at-least-sixteen',
        codeChallenge: challenge,
      }),
      ...overrides,
    },
  });

const api = () => new MockSubscriptionApi(createPublicKey(publicKey), registered);

describe('MockSubscriptionApi', () => {
  it('accepts a correctly signed request', () => {
    const { uuid, clientName } = api().validateRequest({ clientId: registered.clientId, request: signed() });

    expect(uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(clientName).toContain('mock');
  });

  it('rejects the rules subscription-api enforces', () => {
    const subject = api();
    const cases: Array<[string, () => void]> = [
      ['unknown kid', () => subject.validateRequest({ clientId: registered.clientId, request: signed({}, 'other') })],
      ['wrong redirect', () => subject.validateRequest({ clientId: registered.clientId, request: signed({ redirect_uri: 'https://evil.example/cb' }) })],
      ['client mismatch', () => subject.validateRequest({ clientId: 'someone-else', request: signed() })],
      ['short state', () => subject.validateRequest({ clientId: registered.clientId, request: signed({ state: 'short' }) })],
      ['long lifetime', () => subject.validateRequest({ clientId: registered.clientId, request: signed({ exp: 9_999_999_999 }) })],
      ['garbage', () => subject.validateRequest({ clientId: registered.clientId, request: 'not.a.jwt' })],
    ];

    for (const [, run] of cases) {
      expect(run).toThrow(MockRequestError);
    }
  });

  it('issues a code on approve that redeems once with the right verifier and client', () => {
    const subject = api();
    const { uuid } = subject.validateRequest({ clientId: registered.clientId, request: signed() });

    const decision = subject.decide({ uuid, decision: 'approve', scraperApiKey: 'sk-live-mock' });
    expect(decision).toMatchObject({ redirectUri: registered.redirectUri, state: 'state-of-at-least-sixteen' });
    const code = decision.code as string;
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(subject.exchange({ clientId: 'other', code, codeVerifier: verifier })).toMatchObject({ ok: false, status: 403, appCode: 'invalid_client' });
    expect(subject.exchange({ clientId: registered.clientId, code, codeVerifier: 'wrong' })).toMatchObject({ ok: false, status: 400, appCode: 'invalid_grant' });
    expect(subject.exchange({ clientId: registered.clientId, code, codeVerifier: verifier })).toMatchObject({ ok: false, status: 400, appCode: 'invalid_grant' });
  });

  it('redeems a valid code exactly once', () => {
    const subject = api();
    const { uuid } = subject.validateRequest({ clientId: registered.clientId, request: signed() });
    const code = subject.decide({ uuid, decision: 'approve', scraperApiKey: 'sk-live-mock' }).code as string;

    expect(subject.exchange({ clientId: registered.clientId, code, codeVerifier: verifier })).toEqual({ ok: true, sapiToken: 'sk-live-mock' });
    expect(subject.exchange({ clientId: registered.clientId, code, codeVerifier: verifier })).toMatchObject({ ok: false, appCode: 'invalid_grant' });
  });

  it('records a denial and refuses a second decision', () => {
    const subject = api();
    const { uuid } = subject.validateRequest({ clientId: registered.clientId, request: signed() });

    expect(subject.decide({ uuid, decision: 'deny', scraperApiKey: '' })).toEqual({
      redirectUri: registered.redirectUri,
      state: 'state-of-at-least-sixteen',
      error: 'access_denied',
    });
    expect(() => subject.decide({ uuid, decision: 'approve', scraperApiKey: '' })).toThrow(MockRequestError);
  });
});
