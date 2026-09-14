import {
  AuthenticationError,
  DecodoClient,
  DecodoError,
  Target,
  TimeoutError,
} from '@decodo/sdk-ts';
import type { ScrapeRequest, SyncResponse } from '@decodo/sdk-ts';
import { ScrapingMCPParams } from 'types';
import { ProgressNotifier, ProgressExtra } from '../utils';
import { log } from '../logger';
import {
  BASE_RETRY_DELAY_MS,
  getNetworkErrorCode,
  getRetryDelay,
  isRetryable,
  MAX_RETRIES,
  sleep,
  WAITING_INITIAL_DELAY_MS,
  WAITING_INTERVAL_MS,
} from './retry';

const INTEGRATION_HEADER = 'mcp';
const REQUEST_TIMEOUT_MS = 180_000;

const API_PARAM_ALIASES = new Map([
  ['deviceType', 'device_type'],
  ['pageFrom', 'page_from'],
  ['deliveryZip', 'delivery_zip'],
]);

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
  }): ScrapeRequest => {
    const { jsRender, headless, target, ...rest } = scrapingParams;

    const transformed: Record<string, unknown> = {
      target: target ?? Target.Universal,
      ...(headless ? { headless } : jsRender && { headless: 'html' }),
    };

    for (const [key, value] of Object.entries(rest)) {
      if (key === 'tokenLimit') {
        continue;
      }

      transformed[API_PARAM_ALIASES.get(key) ?? key] = value;
    }

    return transformed as unknown as ScrapeRequest;
  };

  transformResponse = <T>({ res }: { res: SyncResponse }) => {
    const [result] = res.results;

    if (!result) {
      throw new Error('Scraper API returned no results.');
    }

    return { data: result.content as T };
  };

  private sdkError = ({
    error,
    target,
    startMs,
  }: {
    error: unknown;
    target: string;
    startMs: number;
  }): unknown => {
    const latencyMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof DecodoError) {
      const sdkMessage =
        error instanceof AuthenticationError ? 'Authentication failed.' : error.message;

      log('error', 'tool_call', {
        outcome: 'error',
        target,
        error_type: 'upstream_api',
        upstream_status: error.statusCode,
        message: sdkMessage,
        latency_ms: latencyMs,
      });

      return new Error(`Scraper API request failed (${error.statusCode}): ${sdkMessage}`);
    }

    const errorCode = error instanceof TimeoutError ? 'ETIMEDOUT' : getNetworkErrorCode(error);

    if (errorCode) {
      log('error', 'tool_call', {
        outcome: 'error',
        target,
        error_type: 'network',
        error_code: errorCode,
        message,
        latency_ms: latencyMs,
      });

      return new Error(`Scraper API request failed: network error ${errorCode}`);
    }

    log('error', 'tool_call', {
      outcome: 'error',
      target,
      error_type: 'unexpected',
      message,
      latency_ms: latencyMs,
    });

    return error;
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
    const startMs = Date.now();

    try {
      await notifier.notify('Submitting request to Decodo API...', 0, 1);

      notifier.startWaitingNotifications(WAITING_INITIAL_DELAY_MS, WAITING_INTERVAL_MS);

      const params = this.transformScrapingParams({ scrapingParams });
      const { target } = params;

      const { webScrapingApi } = new DecodoClient({
        webScrapingApi: { token: auth, integrationHeader: INTEGRATION_HEADER },
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      let lastError: unknown;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const res = await webScrapingApi.scrape(params);

          notifier.stopWaitingNotifications();

          await notifier.notify('Processing response...', 0.9, 1);

          const result = this.transformResponse<T>({ res });

          log('info', 'tool_call', {
            outcome: 'success',
            target,
            upstream_status: res.results[0]?.status_code ?? null,
            latency_ms: Date.now() - startMs,
            attempt,
          });

          return result;
        } catch (error) {
          lastError = error;

          if (attempt < this.maxRetries && isRetryable(error)) {
            const delayMs = getRetryDelay({ attempt, baseDelayMs: this.delayMs });
            const reason =
              error instanceof DecodoError
                ? `status ${error.statusCode}`
                : `network error ${getNetworkErrorCode(error) ?? 'unknown'}`;

            log('warn', 'tool_call_retry', {
              target,
              attempt: attempt + 1,
              max_retries: this.maxRetries,
              reason,
              error_code: getNetworkErrorCode(error) ?? null,
              upstream_status: error instanceof DecodoError ? error.statusCode : null,
              delay_ms: Math.round(delayMs),
            });

            await notifier.notify(`Retrying (${attempt + 1}/${this.maxRetries})...`, 0.1, 1);

            await sleep(delayMs);
            continue;
          }

          break;
        }
      }

      throw this.sdkError({ error: lastError, target, startMs });
    } finally {
      notifier.stopWaitingNotifications();
    }
  };
}
