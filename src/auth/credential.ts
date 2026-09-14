import { AUTH_SCHEME, AUTH_TYPE } from './constants';
import { detectCredentialType } from './detect-credential-type';
import type { AuthCredential, AuthType } from './types';

const TYPE_BY_SCHEME: Record<string, AuthType | undefined> = {
  [AUTH_SCHEME.BASIC]: AUTH_TYPE.TOKEN,
  [AUTH_SCHEME.BEARER]: AUTH_TYPE.API_KEY,
};

const toCredential = (type: AuthType | undefined, value: string): AuthCredential | undefined => {
  const trimmed = value.trim();

  if (!type || !trimmed) {
    return;
  }

  return { type, value: trimmed };
};

export const credentialFromValue = (value: string): AuthCredential | undefined =>
  toCredential(detectCredentialType(value), value);

export const credentialFromAuthHeader = (header: string): AuthCredential | undefined => {
  const [scheme, value, ...rest] = header.trim().split(/\s+/);

  if (!scheme || !value || rest.length > 0) {
    return;
  }

  return toCredential(TYPE_BY_SCHEME[scheme], value);
};
