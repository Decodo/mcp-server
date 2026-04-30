import axios, { AxiosError, AxiosHeaders } from 'axios';
import { ScraperApiClient } from '../scraper-api-client';

const { AxiosError: RealAxiosError } = jest.requireActual<typeof import('axios')>('axios');

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const client = new ScraperApiClient({ maxRetries: 1, delayMs: 0 });
const defaultArgs = {
  auth: 'dGVzdDp0ZXN0',
  scrapingParams: { url: 'https://example.com' },
};

const createAxiosError = ({
  status,
  message,
  data,
  code,
}: {
  status?: number;
  message: string;
  data?: unknown;
  code?: string;
}): AxiosError => {
  const error = new RealAxiosError(message, code);

  if (status) {
    error.response = {
      status,
      data: data ?? {},
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
  }

  return error;
};

beforeEach(() => {
  jest.resetAllMocks();
  mockedAxios.isAxiosError.mockImplementation(
    (val): val is AxiosError => val instanceof RealAxiosError
  );
});

describe('ScraperApiClient', () => {
  describe('scrape - error handling', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.mocked(console.error).mockRestore();
    });

    it('throws friendly message on 401', async () => {
      mockedAxios.request.mockRejectedValue(
        createAxiosError({ status: 401, message: 'Unauthorized' })
      );

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (401): Authentication failed.'
      );
    });

    it('throws friendly message on 429', async () => {
      mockedAxios.request.mockRejectedValue(
        createAxiosError({
          status: 429,
          message: 'Too Many Requests',
          data: 'Rate limit exceeded',
        })
      );

      await expect(client.scrape(defaultArgs)).rejects.toThrow('Rate limit exceeded');
    });

    it('uses server message on 502', async () => {
      mockedAxios.request.mockRejectedValue(
        createAxiosError({
          status: 502,
          message: 'Bad Gateway',
          data: { message: 'Upstream server error' },
        })
      );

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (502): Upstream server error'
      );
    });

    it('falls back to axios message when server provides no message', async () => {
      mockedAxios.request.mockRejectedValue(
        createAxiosError({ status: 500, message: 'Internal Server Error' })
      );

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (500): Internal Server Error'
      );
    });

    it('throws on timeout', async () => {
      mockedAxios.request.mockRejectedValue(
        createAxiosError({ message: 'timeout of 180000ms exceeded', code: 'ECONNABORTED' })
      );

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (undefined): timeout of 180000ms exceeded'
      );
    });

    it('re-throws non-axios errors as-is', async () => {
      const error = new TypeError('unexpected failure');
      mockedAxios.request.mockRejectedValue(error);

      await expect(client.scrape(defaultArgs)).rejects.toThrow(error);
    });
  });
});
