import axios, { AxiosError, AxiosResponse } from 'axios';
import { ScraperApiResponseData } from './types';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';

const MAX_RETRIES = Math.max(0, parseInt(process.env.MAX_RETRIES ?? '2', 10) || 2);
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND']);

const isRetryable = (error: AxiosError): boolean => {
  if (error.response) {
    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }
  return RETRYABLE_NETWORK_CODES.has(error.code ?? '');
};

const getRetryDelay = (attempt: number, error: AxiosError): number => {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }

      const date = Date.parse(retryAfter);
      if (!isNaN(date)) {
        return Math.max(0, date - Date.now());
      }
    }
  }

  const baseMs = 1000 * Math.pow(2, attempt);
  const jitterMs = Math.random() * 500;
  return baseMs + jitterMs;
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export class ScraperApiClient {
  transformScrapingParams = ({
    scrapingParams,
  }: {
    scrapingParams: ScrapingMCPParams;
  }): ScraperAPIParams => {
    const { jsRender, headless, ...rest } = scrapingParams;
    const transformed = {
      ...(headless ? { headless } : jsRender && { headless: 'html' }),
      ...rest,
    };

    return transformed;
  };

  transformResponse = <T>({ res }: { res: AxiosResponse<ScraperApiResponseData<T>> }) => {
    const content = res.data.results[0].content;

    return { ...res, data: content };
  };

  scrape = async <T = string>({
    auth,
    scrapingParams,
  }: {
    auth: string;
    scrapingParams: ScrapingMCPParams;
  }) => {
    const transformedParams = this.transformScrapingParams({ scrapingParams });

    const url = process.env.DECODO_SAPI_HOST || 'https://scraper-api.decodo.com';

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await axios.request<ScraperApiResponseData<T>>({
          url: `${url}/v2/scrape`,
          method: 'POST',
          headers: {
            authorization: `Basic ${auth}`,
            'x-integration': 'mcp',
          },
          timeout: 180000,
          data: {
            ...transformedParams,
          },
        });

        return this.transformResponse({ res });
      } catch (error) {
        lastError = error;

        if (attempt < MAX_RETRIES && axios.isAxiosError(error) && isRetryable(error)) {
          const delayMs = getRetryDelay(attempt, error);
          const reason = error.response
            ? `status ${error.response.status}`
            : `network error ${error.code}`;

          console.error(
            `[scraper-api-client] Retry ${
              attempt + 1
            }/${MAX_RETRIES} after ${reason}, waiting ${Math.round(delayMs)}ms`
          );

          await sleep(delayMs);
          continue;
        }

        break;
      }
    }

    if (axios.isAxiosError(lastError)) {
      const status = lastError.response?.status;
      let errorMessage = lastError.response?.data?.message ?? lastError.message;

      if (status === 401) {
        errorMessage = 'Authentication failed.';
      }
      if (status === 429) {
        errorMessage = JSON.stringify(lastError.response?.data);
      }

      throw new Error(`Scraper API request failed (${status}): ${errorMessage}`);
    }
    throw lastError;
  };
}
