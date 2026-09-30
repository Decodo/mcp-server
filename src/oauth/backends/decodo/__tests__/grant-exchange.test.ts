import { GRANT_EXCHANGE_ERROR, GrantExchangeError } from '../../../grant-exchange';
import { HttpGrantExchange } from '../grant-exchange';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const URL_UNDER_TEST = new URL('https://api.decodo.com/api/v1/grants/exchange');

const exchangeWith = (fetchMock: jest.Mock) =>
  new HttpGrantExchange({ url: URL_UNDER_TEST, secret: 'service-secret', fetch: fetchMock as unknown as typeof fetch });

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as GrantExchangeError).code;
  }

  throw new Error('expected the exchange to fail');
};

describe('HttpGrantExchange', () => {
  it('posts the code with the service credential and returns the key', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ scraper_api_key: 'sk-live-1' }));

    await expect(exchangeWith(fetchMock).exchange('one-time')).resolves.toBe('sk-live-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_UNDER_TEST);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer service-secret');
    expect(JSON.parse(init.body)).toEqual({ code: 'one-time' });
  });

  it('maps 400 to invalid_grant and 403 to invalid_client', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, 400))).exchange('x')))
      .resolves.toBe(GRANT_EXCHANGE_ERROR.INVALID_GRANT);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({ error: 'invalid_client' }, 403))).exchange('x')))
      .resolves.toBe(GRANT_EXCHANGE_ERROR.INVALID_CLIENT);
  });

  it('maps other failures to server_error', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({}, 502))).exchange('x')))
      .resolves.toBe(GRANT_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockRejectedValue(new Error('timeout'))).exchange('x')))
      .resolves.toBe(GRANT_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({}))).exchange('x')))
      .resolves.toBe(GRANT_EXCHANGE_ERROR.SERVER_ERROR);
  });
});
