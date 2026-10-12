import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { REQUEST_JWT, parsePrivateKey, requestJwtClaims, signRequestJwt, verifyRequestJwt } from '../request-jwt';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const claims = requestJwtClaims({
  issuer: 'mcp.decodo.com',
  clientId: 'mcp',
  redirectUri: 'https://mcp.decodo.com/oauth/callback',
  state: 'state-value-of-sixteen-plus',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  nowSeconds: 1_700_000_000,
});

const decode = (segment: string) => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));

describe('request JWT', () => {
  it('carries the claims subscription-api validates', () => {
    expect(claims).toEqual({
      iss: 'mcp.decodo.com',
      aud: 'subscription-api',
      iat: 1_700_000_000,
      exp: 1_700_000_000 + REQUEST_JWT.LIFETIME_SECONDS,
      client_id: 'mcp',
      redirect_uri: 'https://mcp.decodo.com/oauth/callback',
      state: 'state-value-of-sixteen-plus',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      scope: 'sapi_token',
    });
    expect(REQUEST_JWT.LIFETIME_SECONDS).toBeLessThanOrEqual(120);
  });

  it('signs with RS256 and the registered kid', () => {
    const token = signRequestJwt({ privateKey: parsePrivateKey(privateKey), kid: 'prod-2026-09', claims });
    const [header, payload] = token.split('.');

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'prod-2026-09' });
    expect(decode(payload)).toEqual(claims);
  });

  it('verifies with the matching public key only', () => {
    const token = signRequestJwt({ privateKey: parsePrivateKey(privateKey), kid: 'k', claims });

    expect(verifyRequestJwt(token, createPublicKey(publicKey))).toEqual({ header: { alg: 'RS256', typ: 'JWT', kid: 'k' }, claims });

    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    expect(verifyRequestJwt(token, other)).toBeUndefined();
  });

  it('rejects a tampered payload and a malformed token', () => {
    const token = signRequestJwt({ privateKey: parsePrivateKey(privateKey), kid: 'k', claims });
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...claims, redirect_uri: 'https://evil.example/cb' })).toString('base64url');

    expect(verifyRequestJwt(`${header}.${forged}.${signature}`, createPublicKey(publicKey))).toBeUndefined();
    expect(verifyRequestJwt('a.b', createPublicKey(publicKey))).toBeUndefined();
    expect(verifyRequestJwt('', createPublicKey(publicKey))).toBeUndefined();
  });
});

describe('parsePrivateKey', () => {
  it('names the variable when the pem is invalid', () => {
    expect(() => parsePrivateKey('not a pem')).toThrow('TOKEN_EXCHANGE_PRIVATE_KEY');
  });
});
