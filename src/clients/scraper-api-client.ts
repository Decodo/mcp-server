import {
  AuthenticationError,
  buildToolRequest,
  BundledSchema,
  DecodoClient,
  DecodoError,
  readResult,
  ResultError,
  runTool,
  TimeoutError,
} from '@decodo/sdk-ts';
import type { FlowSchema, IrSurfaceTool, ScrapeRequest, WebScrapingApi } from '@decodo/sdk-ts';
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

export const API_KEY_REQUIRED_MESSAGE =
  'This tool needs a Decodo API key; Basic authentication tokens cannot use the Web Data API. ' +
  'Copy an API key from your Web Data API subscription at https://dashboard.decodo.com/web-data/playground and reconnect with it.';

type RequestArgs<R> = {
  auth: AuthCredential;
  target: string;
  extra?: ProgressExtra;
  maxRetries?: number;
  call: (api: WebScrapingApi) => Promise<R>;
  upstreamStatus?: (res: R) => number | null;
};

const firstStatusCode = (response: unknown): number | null => {
  const code = (response as { results?: { status_code?: unknown }[] } | null)?.results?.[0]
    ?.status_code;

  return typeof code === 'number' ? code : null;
};

const readSurfaceResult = (tool: IrSurfaceTool, response: unknown): unknown => {
  try {
    return readResult(tool.result, response);
  } catch (error) {
    const siteStatus = firstStatusCode(response);

    if (error instanceof ResultError && siteStatus !== null && String(siteStatus) === error.code) {
      throw new ResultError(
        `The target site answered with HTTP ${siteStatus}, so there is no page content to return.`,
        error.code
      );
    }

    throw error;
  }
};

export type AuthenticationErrorListener = (auth: AuthCredential) => void;

export class ScraperApiClient {
  maxRetries: number;

  delayMs: number;

  onAuthenticationError?: AuthenticationErrorListener;

  hosts: ScrapingApiHosts;

  integrationHeader: string;

  schema: FlowSchema;

  constructor({
    maxRetries = MAX_RETRIES,
    delayMs = BASE_RETRY_DELAY_MS,
    onAuthenticationError,
    hosts = scrapingApiHostsFromEnv(),
    integrationHeader = 'mcp',
    schema = BundledSchema.shared,
  }: {
    maxRetries?: number;
    delayMs?: number;
    onAuthenticationError?: AuthenticationErrorListener;
    hosts?: ScrapingApiHosts;
    integrationHeader?: string;
    schema?: FlowSchema;
  } = {}) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
    this.onAuthenticationError = onAuthenticationError;
    this.hosts = hosts;
    this.integrationHeader = integrationHeader;
    this.schema = schema;
  }

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

    if (error instanceof ResultError) {
      log('error', 'tool_call', {
        outcome: 'error',
        target,
        auth_type: authType,
        error_type: 'upstream_result',
        error_code: error.code,
        message,
        latency_ms: latencyMs,
      });

      return new Error(`Scraper API request failed (${error.code}): ${message}`);
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
  }: RequestArgs<R>): Promise<R> => {
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
        schema: this.schema,
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
                : error instanceof ResultError
                  ? `result ${error.code}`
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

  private dataApiRequest = <R>(args: RequestArgs<R>): Promise<R> => {
    if (args.auth.type !== AUTH_TYPE.API_KEY) {
      return Promise.reject(new Error(API_KEY_REQUIRED_MESSAGE));
    }

    return this.request(args);
  };

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
    this.dataApiRequest({
      auth,
      target: 'crawl',
      extra,
      call: api => api.listCrawlPages(crawlId, { cursor }),
    });

  runSurfaceTool = async ({
    auth,
    tool,
    args,
    extra,
  }: {
    auth: AuthCredential;
    tool: IrSurfaceTool;
    args: Record<string, unknown>;
    extra?: ProgressExtra;
  }): Promise<unknown> => {
    const flow = this.schema.getFlow(tool.flow);
    const isCall = !tool.step && flow?.pattern === 'call';
    const isScrape = isCall && flow?.run === 'scrapePage';
    const startsWork = tool.step === 'start' || flow?.pattern === 'batch';
    const target = tool.target ?? tool.flow;
    const common = { auth, target, extra, ...(startsWork && { maxRetries: 0 }) };

    if (!isCall) {
      return this.dataApiRequest({ ...common, call: api => runTool(api.flows, tool, args) });
    }

    if (auth.type !== AUTH_TYPE.API_KEY && !isScrape) {
      throw new Error(API_KEY_REQUIRED_MESSAGE);
    }

    const send = (api: WebScrapingApi) =>
      auth.type === AUTH_TYPE.API_KEY
        ? runTool(api.flows, { ...tool, result: undefined }, args)
        : api.scrape(buildToolRequest(tool, args) as unknown as ScrapeRequest);

    const { result } = await this.request({
      ...common,
      call: async api => {
        const response = await send(api);

        return { response, result: readSurfaceResult(tool, response) };
      },
      upstreamStatus: ({ response }) => firstStatusCode(response),
    });

    return result;
  };
}
