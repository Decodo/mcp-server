import { TOKEN_EXCHANGE_ERROR, TokenExchangeError } from '../../../token-exchange';
import { HttpTokenExchange } from '../token-exchange';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BASE_URL = new URL('https://dashboard.decodo.com/subscription-api/v1/api/scraper/apikey/token-exchange');

const exchangeWith = (fetchMock: jest.Mock) =>
  new HttpTokenExchange({ baseUrl: BASE_URL, clientId: 'mcp', fetch: fetchMock as unknown as typeof fetch });

const attempt = { code: 'one-time', codeVerifier: 'verifier' };

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as TokenExchangeError).code;
  }

  throw new Error('expected the exchange to fail');
};

const apiError = (status: number, appCode?: string) =>
  jsonResponse({ status_code: status, title: 'Error', detail: 'Exchange failed.', app_code: appCode }, status);

describe('HttpTokenExchange.createRequest', () => {
  it('posts client_id and the signed request and returns the pending request', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ uuid: 'req-1', client_name: 'Decodo MCP', expires_at: '2026-10-02T07:53:46+00:00' }, 201));

    await expect(exchangeWith(fetchMock).createRequest('signed.jwt.value')).resolves.toEqual({
      uuid: 'req-1',
      clientName: 'Decodo MCP',
      expiresAt: '2026-10-02T07:53:46+00:00',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.href).toBe(`${BASE_URL.href}/request`);
    expect(JSON.parse(init.body)).toEqual({ client_id: 'mcp', request: 'signed.jwt.value' });
  });

  it('fails as server_error when the request is rejected or malformed', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(400))).createRequest('jwt')))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({}, 201))).createRequest('jwt')))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockRejectedValue(new Error('down'))).createRequest('jwt')))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
  });
});

describe('HttpTokenExchange.exchange', () => {
  it('posts client_id, code and code_verifier and returns sapi_token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ sapi_token: 'sk-live-1', label: 'default' }));

    await expect(exchangeWith(fetchMock).exchange(attempt)).resolves.toBe('sk-live-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.href).toBe(`${BASE_URL.href}/exchange`);
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body)).toEqual({ client_id: 'mcp', code: 'one-time', code_verifier: 'verifier' });
  });

  it('branches on app_code when present', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(400, 'invalid_grant'))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.INVALID_GRANT);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(403, 'invalid_client'))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.INVALID_CLIENT);
  });

  it('falls back to the status when app_code is missing', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(400))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.INVALID_GRANT);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(new Response('nope', { status: 403 }))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.INVALID_CLIENT);
  });

  it('maps other failures to server_error', async () => {
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(422))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(apiError(429))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockRejectedValue(new Error('timeout'))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
    await expect(codeOf(exchangeWith(jest.fn().mockResolvedValue(jsonResponse({ label: 'no token' }))).exchange(attempt)))
      .resolves.toBe(TOKEN_EXCHANGE_ERROR.SERVER_ERROR);
  });
});
