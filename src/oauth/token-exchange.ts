export const TOKEN_EXCHANGE_ERROR = {
  INVALID_GRANT: 'invalid_grant',
  INVALID_CLIENT: 'invalid_client',
  SERVER_ERROR: 'server_error',
} as const;

export type TokenExchangeErrorCode = (typeof TOKEN_EXCHANGE_ERROR)[keyof typeof TOKEN_EXCHANGE_ERROR];

export class TokenExchangeError extends Error {
  constructor(
    readonly code: TokenExchangeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TokenExchangeError';
  }
}
