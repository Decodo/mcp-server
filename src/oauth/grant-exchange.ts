export const GRANT_EXCHANGE_ERROR = {
  INVALID_GRANT: 'invalid_grant',
  INVALID_CLIENT: 'invalid_client',
  SERVER_ERROR: 'server_error',
} as const;

export type GrantExchangeErrorCode = (typeof GRANT_EXCHANGE_ERROR)[keyof typeof GRANT_EXCHANGE_ERROR];

export class GrantExchangeError extends Error {
  constructor(
    readonly code: GrantExchangeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'GrantExchangeError';
  }
}

/** Turns the one-time code minted by the approval screen into a Scraping API key. */
export interface GrantExchange {
  exchange(code: string): Promise<string>;
}
