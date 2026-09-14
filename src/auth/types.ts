import type { AUTH_TYPE } from './constants';

export type AuthType = (typeof AUTH_TYPE)[keyof typeof AUTH_TYPE];

export type AuthCredential = {
  type: AuthType;
  value: string;
};
