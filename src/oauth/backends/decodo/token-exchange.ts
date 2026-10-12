import { TOKEN_EXCHANGE_ERROR, TokenExchangeError } from '../../token-exchange';
import type { TokenExchangeErrorCode } from '../../token-exchange';

type FetchLike = typeof fetch;

const REQUEST_TIMEOUT_MS = 5_000;

const STATUS_TO_ERROR: Record<number, TokenExchangeErrorCode> = {
  400: TOKEN_EXCHANGE_ERROR.INVALID_GRANT,
  403: TOKEN_EXCHANGE_ERROR.INVALID_CLIENT,
};

const APP_CODES = new Set<string>([TOKEN_EXCHANGE_ERROR.INVALID_GRANT, TOKEN_EXCHANGE_ERROR.INVALID_CLIENT]);

type ErrorBody = { app_code?: unknown; detail?: unknown };

export type PendingExchangeRequest = {
  uuid: string;
  clientName: string;
  expiresAt: string;
};

export class HttpTokenExchange {
  private readonly requestUrl: URL;

  private readonly exchangeUrl: URL;

  private readonly clientId: string;

  private readonly fetch: FetchLike;

  constructor({ baseUrl, clientId, fetch = globalThis.fetch }: { baseUrl: URL; clientId: string; fetch?: FetchLike }) {
    const base = baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`;
    this.requestUrl = new URL('request', base);
    this.exchangeUrl = new URL('exchange', base);
    this.clientId = clientId;
    this.fetch = fetch;
  }

  async createRequest(requestJwt: string): Promise<PendingExchangeRequest> {
    const response = await this.post(this.requestUrl, { client_id: this.clientId, request: requestJwt });

    if (!response.ok) {
      throw new TokenExchangeError(
        TOKEN_EXCHANGE_ERROR.SERVER_ERROR,
        `token exchange request rejected with ${response.status}: ${await this.detail(response)}`
      );
    }

    const body = (await this.jsonBody(response)) as { uuid?: unknown; client_name?: unknown; expires_at?: unknown };

    if (typeof body.uuid !== 'string' || !body.uuid) {
      throw new TokenExchangeError(TOKEN_EXCHANGE_ERROR.SERVER_ERROR, 'token exchange request response has no uuid');
    }

    return {
      uuid: body.uuid,
      clientName: typeof body.client_name === 'string' ? body.client_name : '',
      expiresAt: typeof body.expires_at === 'string' ? body.expires_at : '',
    };
  }

  async exchange({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<string> {
    const response = await this.post(this.exchangeUrl, { client_id: this.clientId, code, code_verifier: codeVerifier });

    if (!response.ok) {
      throw new TokenExchangeError(await this.errorCode(response), `token exchange responded with ${response.status}`);
    }

    const body = (await this.jsonBody(response)) as { sapi_token?: unknown };

    if (typeof body.sapi_token !== 'string' || !body.sapi_token) {
      throw new TokenExchangeError(TOKEN_EXCHANGE_ERROR.SERVER_ERROR, 'token exchange response has no sapi_token');
    }

    return body.sapi_token;
  }

  private async post(url: URL, body: object): Promise<Response> {
    try {
      return await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new TokenExchangeError(
        TOKEN_EXCHANGE_ERROR.SERVER_ERROR,
        `token exchange call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async jsonBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new TokenExchangeError(TOKEN_EXCHANGE_ERROR.SERVER_ERROR, `token exchange responded ${response.status} with a non-JSON body`);
    }
  }

  private async errorBody(response: Response): Promise<ErrorBody> {
    try {
      return (await response.json()) as ErrorBody;
    } catch {
      return {};
    }
  }

  private async detail(response: Response): Promise<string> {
    const body = await this.errorBody(response);

    return typeof body.detail === 'string' ? body.detail : 'no detail';
  }

  private async errorCode(response: Response): Promise<TokenExchangeErrorCode> {
    const body = await this.errorBody(response);

    if (typeof body.app_code === 'string' && APP_CODES.has(body.app_code)) {
      return body.app_code as TokenExchangeErrorCode;
    }

    return STATUS_TO_ERROR[response.status] ?? TOKEN_EXCHANGE_ERROR.SERVER_ERROR;
  }
}
