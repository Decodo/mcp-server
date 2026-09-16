import { AUTH_TYPE } from './constants';
import type { AuthType } from './types';

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export const detectCredentialType = (value: string): AuthType => {
  const decoded = Buffer.from(value, 'base64').toString('utf8');

  if (PRINTABLE_ASCII.test(decoded) && decoded.includes(':')) {
    return AUTH_TYPE.TOKEN;
  }

  return AUTH_TYPE.API_KEY;
};
