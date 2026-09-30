import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from '../../../grant-exchange';
import { MockGrantExchange } from '../grant-exchange';

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as GrantExchangeError).code;
  }

  throw new Error('expected the exchange to fail');
};

describe('MockGrantExchange', () => {
  it('returns the key a minted code was bound to, once', async () => {
    const exchange = new MockGrantExchange();
    const code = exchange.mint('sk-live-mock');

    await expect(exchange.exchange(code)).resolves.toBe('sk-live-mock');
    await expect(codeOf(exchange.exchange(code))).resolves.toBe(GRANT_EXCHANGE_ERROR.INVALID_GRANT);
  });

  it('rejects unknown codes', async () => {
    await expect(codeOf(new MockGrantExchange().exchange('nope'))).resolves.toBe(GRANT_EXCHANGE_ERROR.INVALID_GRANT);
  });
});
