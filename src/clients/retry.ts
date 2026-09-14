import { DecodoError, TimeoutError } from '@decodo/sdk-ts';

export const MAX_RETRIES = Math.max(0, parseInt(process.env.MAX_RETRIES ?? '2', 10) || 2);
export const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
export const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENOTFOUND',
]);
export const WAITING_INITIAL_DELAY_MS = 3000;
export const WAITING_INTERVAL_MS = 5000;

export const BASE_RETRY_DELAY_MS = 1000;

export const getNetworkErrorCode = (error: unknown): string | undefined => {
  if (!(error instanceof TypeError)) {
    return undefined;
  }

  const { cause } = error as TypeError & { cause?: { code?: unknown } };

  return typeof cause?.code === 'string' ? cause.code : undefined;
};

export const isRetryable = (error: unknown): boolean => {
  if (error instanceof TimeoutError) {
    return true;
  }

  if (error instanceof DecodoError) {
    return RETRYABLE_STATUS_CODES.has(error.statusCode);
  }

  return RETRYABLE_NETWORK_CODES.has(getNetworkErrorCode(error) ?? '');
};

export const getRetryDelay = ({
  attempt,
  baseDelayMs = BASE_RETRY_DELAY_MS,
}: {
  attempt: number;
  baseDelayMs?: number;
}): number => {
  const baseMs = baseDelayMs * Math.pow(2, attempt);
  const jitterMs = Math.random() * 500;
  return baseMs + jitterMs;
};

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
