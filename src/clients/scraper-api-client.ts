import {
  AuthenticationError,
  DecodoClient,
  DecodoError,
  Target,
  TimeoutError,
} from '@decodo/sdk-ts';
import type {
  MapSiteRequest,
  RunSearchRequest,
  ScrapeRequest,
  StartCrawlRequest,
  SyncResponse,
  WebScrapingApi,
} from '@decodo/sdk-ts';
import { ScrapingMCPParams } from 'types';
import { AUTH_TYPE } from '../auth';
import { scrapingApiHostsFromEnv } from './hosts';
import type { ScrapingApiHosts } from './hosts';
import type { AuthCredential } from '../auth';
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

const REQUEST_TIMEOUT_MS = 180_000;

const API_PARAM_ALIASES = new Map([
  ['deviceType', 'device_type'],
  ['pageFrom', 'page_from'],
  ['deliveryZip', 'delivery_zip'],
]);

export type AuthenticationErrorListener = (auth: AuthCredential) => void;

export class ScraperApiClient {
  maxRetries: number;

  delayMs: number;

  onAuthenticationError?: AuthenticationErrorListener;

  hosts: ScrapingApiHosts;

  integrationHeader: string;

  constructor({
    maxRetries = MAX_RETRIES,
    delayMs = BASE_RETRY_DELAY_MS,
    onAuthenticationError,
    hosts = scrapingApiHostsFromEnv(),
    integrationHeader = 'mcp',
  }: {
    maxRetries?: number;
    delayMs?: number;
    onAuthenticationError?: AuthenticationErrorListener;
    hosts?: ScrapingApiHosts;
    integrationHeader?: string;
  } = {}) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
    this.onAuthenticationError = onAuthenticationError;
    this.hosts = hosts;
    this.integrationHeader = integrationHeader;
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
    auth,
    startMs,
  }: {
    error: unknown;
    target: string;
    auth: AuthCredential;
    startMs: number;
  }): unknown => {
    const latencyMs = Date.now() - startMs;
    const authType = auth.type;
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof DecodoError) {
      const sdkMessage =
        error instanceof AuthenticationError ? 'Authentication failed.' : error.message;

      if (error instanceof AuthenticationError) {
        this.onAuthenticationError?.(auth);
      }

      log('error', 'tool_call', {
        outcome: 'error',
        target,
        auth_type: authType,
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
        auth_type: authType,
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
      auth_type: authType,
      error_type: 'unexpected',
      message,
      latency_ms: latencyMs,
    });

    return error;
  };

  private sdkTransport = (auth: AuthCredential) =>
    auth.type === AUTH_TYPE.API_KEY
      ? { apiKey: auth.value, baseUrl: this.hosts.dataApi }
      : { token: auth.value, baseUrl: this.hosts.scraperApi };

  private request = async <R>({
    auth,
    target,
    extra,
    maxRetries = this.maxRetries,
    call,
    upstreamStatus = () => null,
  }: {
    auth: AuthCredential;
    target: string;
    extra?: ProgressExtra;
    maxRetries?: number;
    call: (api: WebScrapingApi) => Promise<R>;
    upstreamStatus?: (res: R) => number | null;
  }): Promise<R> => {
    const notifier = new ProgressNotifier(extra);
    const startMs = Date.now();

    try {
      await notifier.notify('Submitting request to Decodo API...', 0, 1);

      notifier.startWaitingNotifications(WAITING_INITIAL_DELAY_MS, WAITING_INTERVAL_MS);

      const { webScrapingApi } = new DecodoClient({
        webScrapingApi: {
          ...this.sdkTransport(auth),
          integrationHeader: this.integrationHeader,
        },
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await call(webScrapingApi);

          notifier.stopWaitingNotifications();

          await notifier.notify('Processing response...', 0.9, 1);

          log('info', 'tool_call', {
            outcome: 'success',
            target,
            auth_type: auth.type,
            upstream_status: upstreamStatus(res),
            latency_ms: Date.now() - startMs,
            attempt,
          });

          return res;
        } catch (error) {
          lastError = error;

          if (attempt < maxRetries && isRetryable(error)) {
            const delayMs = getRetryDelay({ attempt, baseDelayMs: this.delayMs });
            const reason =
              error instanceof DecodoError
                ? `status ${error.statusCode}`
                : `network error ${getNetworkErrorCode(error) ?? 'unknown'}`;

            log('warn', 'tool_call_retry', {
              target,
              attempt: attempt + 1,
              max_retries: maxRetries,
              reason,
              error_code: getNetworkErrorCode(error) ?? null,
              upstream_status: error instanceof DecodoError ? error.statusCode : null,
              delay_ms: Math.round(delayMs),
            });

            await notifier.notify(`Retrying (${attempt + 1}/${maxRetries})...`, 0.1, 1);

            await sleep(delayMs);
            continue;
          }

          break;
        }
      }

      throw this.sdkError({ error: lastError, target, auth, startMs });
    } finally {
      notifier.stopWaitingNotifications();
    }
  };

  scrape = async <T = string>({
    auth,
    scrapingParams,
    extra,
  }: {
    auth: AuthCredential;
    scrapingParams: ScrapingMCPParams;
    extra?: ProgressExtra;
  }) => {
    const params = this.transformScrapingParams({ scrapingParams });

    const res = await this.request({
      auth,
      target: params.target,
      extra,
      call: api => api.scrape(params),
      upstreamStatus: ({ results }) => results[0]?.status_code ?? null,
    });

    return this.transformResponse<T>({ res });
  };

  search = ({
    auth,
    params,
    extra,
  }: {
    auth: AuthCredential;
    params: RunSearchRequest;
    extra?: ProgressExtra;
  }) => this.request({ auth, target: 'search', extra, call: api => api.search(params) });

  map = ({
    auth,
    params,
    extra,
  }: {
    auth: AuthCredential;
    params: MapSiteRequest;
    extra?: ProgressExtra;
  }) =>
    this.request({
      auth,
      target: 'map',
      extra,
      call: api => api.map(params),
      upstreamStatus: ({ results }) => results[0]?.status_code ?? null,
    });

  startCrawl = ({
    auth,
    params,
    extra,
  }: {
    auth: AuthCredential;
    params: StartCrawlRequest;
    extra?: ProgressExtra;
  }) =>
    this.request({
      auth,
      target: 'crawl',
      extra,
      maxRetries: 0,
      call: api => api.startCrawl(params),
    });

  getCrawlStatus = ({
    auth,
    crawlId,
    extra,
  }: {
    auth: AuthCredential;
    crawlId: string;
    extra?: ProgressExtra;
  }) => this.request({ auth, target: 'crawl', extra, call: api => api.getCrawlStatus(crawlId) });

  listCrawlPages = ({
    auth,
    crawlId,
    cursor,
    extra,
  }: {
    auth: AuthCredential;
    crawlId: string;
    cursor?: string;
    extra?: ProgressExtra;
  }) =>
    this.request({
      auth,
      target: 'crawl',
      extra,
      call: api => api.listCrawlPages(crawlId, { cursor }),
    });
}
