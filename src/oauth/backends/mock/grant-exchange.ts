import { randomBytes } from 'node:crypto';
import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from '../../grant-exchange';
import type { GrantExchange } from '../../grant-exchange';
import { TtlStore } from '../../ttl-store';

const CODE_TTL_MS = 60_000;

/**
 * Stands in for api.decodo.com. The mock approval screen mints codes here and the
 * provider spends them, so the whole flow runs in one process.
 */
export class MockGrantExchange implements GrantExchange {
  private readonly codes = new TtlStore<string>(CODE_TTL_MS);

  mint(scraperApiKey: string): string {
    const code = randomBytes(24).toString('base64url');
    this.codes.set(code, scraperApiKey);
    return code;
  }

  async exchange(code: string): Promise<string> {
    const scraperApiKey = this.codes.take(code);

    if (!scraperApiKey) {
      throw new GrantExchangeError(GRANT_EXCHANGE_ERROR.INVALID_GRANT, 'unknown, expired or already spent code');
    }

    return scraperApiKey;
  }
}
