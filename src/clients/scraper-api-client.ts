import axios, { AxiosResponse } from 'axios';
import { ScraperApiResponseData } from './types';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { ProgressNotifier, ProgressExtra } from '../utils';
import {
  BASE_RETRY_DELAY_MS,
  getRetryDelay,
  isRetryable,
  MAX_RETRIES,
  sleep,
  WAITING_INITIAL_DELAY_MS,
  WAITING_INTERVAL_MS,
} from 'clients/retry';

export class ScraperApiClient {
  maxRetries: number;

  delayMs: number;

  constructor({
    maxRetries = MAX_RETRIES,
    delayMs = BASE_RETRY_DELAY_MS,
  }: {
    maxRetries?: number;
    delayMs?: number;
  } = {}) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
  }

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
    extra,
  }: {
    auth: string;
    scrapingParams: ScrapingMCPParams;
    extra?: ProgressExtra;
  }) => {
    const notifier = new ProgressNotifier(extra);

    try {
      await notifier.notify('Submitting request to Decodo API...', 0, 1);

      notifier.startWaitingNotifications(WAITING_INITIAL_DELAY_MS, WAITING_INTERVAL_MS);

      const transformedParams = this.transformScrapingParams({ scrapingParams });
      const url = process.env.DECODO_SAPI_HOST || 'https://scraper-api.decodo.com';

      let lastError: unknown;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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

          notifier.stopWaitingNotifications();

          await notifier.notify('Processing response...', 0.9, 1);

          return this.transformResponse({ res });
        } catch (error) {
          lastError = error;

          if (attempt < MAX_RETRIES && axios.isAxiosError(error) && isRetryable(error)) {
            // const delayMs = getRetryDelay(attempt, error);
            const delayMs = getRetryDelay({ attempt, error, baseDelayMs: this.delayMs });
            const reason = error.response
              ? `status ${error.response.status}`
              : `network error ${error.code}`;

            console.error(
              `[scraper-api-client] Retry ${
                attempt + 1
              }/${MAX_RETRIES} after ${reason}, waiting ${Math.round(delayMs)}ms`
            );

            await notifier.notify(`Retrying (${attempt + 1}/${MAX_RETRIES})...`, 0.1, 1);

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
    } finally {
      notifier.stopWaitingNotifications();
    }
  };
}
