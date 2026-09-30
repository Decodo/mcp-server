import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from '../../grant-exchange';
import type { GrantExchange, GrantExchangeErrorCode } from '../../grant-exchange';

type FetchLike = typeof fetch;

const EXCHANGE_TIMEOUT_MS = 5_000;

const STATUS_TO_ERROR: Record<number, GrantExchangeErrorCode> = {
  400: GRANT_EXCHANGE_ERROR.INVALID_GRANT,
  403: GRANT_EXCHANGE_ERROR.INVALID_CLIENT,
};

/** Calls `POST /api/v1/grants/exchange` on api.decodo.com with the service credential. */
export class HttpGrantExchange implements GrantExchange {
  private readonly url: URL;

  private readonly secret: string;

  private readonly fetch: FetchLike;

  constructor({ url, secret, fetch = globalThis.fetch }: { url: URL; secret: string; fetch?: FetchLike }) {
    this.url = url;
    this.secret = secret;
    this.fetch = fetch;
  }

  async exchange(code: string): Promise<string> {
    let response: Response;

    try {
      response = await this.fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secret}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new GrantExchangeError(
        GRANT_EXCHANGE_ERROR.SERVER_ERROR,
        `grant exchange request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response.ok) {
      const errorCode = STATUS_TO_ERROR[response.status] ?? GRANT_EXCHANGE_ERROR.SERVER_ERROR;
      throw new GrantExchangeError(errorCode, `grant exchange responded with ${response.status}`);
    }

    const body = (await response.json()) as { scraper_api_key?: unknown };

    if (typeof body.scraper_api_key !== 'string' || !body.scraper_api_key) {
      throw new GrantExchangeError(
        GRANT_EXCHANGE_ERROR.SERVER_ERROR,
        'grant exchange response has no scraper_api_key'
      );
    }

    return body.scraper_api_key;
  }
}
