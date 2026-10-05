import { createPrivateKey, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

export const REQUEST_JWT = {
  AUDIENCE: 'subscription-api',
  SCOPE: 'sapi_token',
  CODE_CHALLENGE_METHOD: 'S256',
  LIFETIME_SECONDS: 120,
} as const;

export type RequestJwtClaims = {
  iss: string;
  aud: typeof REQUEST_JWT.AUDIENCE;
  iat: number;
  exp: number;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: typeof REQUEST_JWT.CODE_CHALLENGE_METHOD;
  scope: typeof REQUEST_JWT.SCOPE;
};

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

export const signRequestJwt = ({
  privateKey,
  kid,
  claims,
}: {
  privateKey: KeyObject;
  kid: string;
  claims: RequestJwtClaims;
}): string => {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign('sha256', Buffer.from(signingInput), privateKey);

  return `${signingInput}.${base64url(signature)}`;
};

export const requestJwtClaims = ({
  issuer,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nowSeconds?: number;
}): RequestJwtClaims => ({
  iss: issuer,
  aud: REQUEST_JWT.AUDIENCE,
  iat: nowSeconds,
  exp: nowSeconds + REQUEST_JWT.LIFETIME_SECONDS,
  client_id: clientId,
  redirect_uri: redirectUri,
  state,
  code_challenge: codeChallenge,
  code_challenge_method: REQUEST_JWT.CODE_CHALLENGE_METHOD,
  scope: REQUEST_JWT.SCOPE,
});

export const parsePrivateKey = (pem: string): KeyObject => createPrivateKey(pem);

export type DecodedRequestJwt = {
  header: { alg?: string; kid?: string };
  claims: RequestJwtClaims;
};

export const verifyRequestJwt = (token: string, publicKey: KeyObject): DecodedRequestJwt | undefined => {
  const [encodedHeader, encodedClaims, encodedSignature, ...rest] = token.split('.');

  if (!encodedHeader || !encodedClaims || !encodedSignature || rest.length > 0) {
    return;
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as DecodedRequestJwt['header'];

    if (header.alg !== 'RS256') {
      return;
    }

    const valid = verify(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url')
    );

    if (!valid) {
      return;
    }

    return { header, claims: JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8')) as RequestJwtClaims };
  } catch {
    return;
  }
};
