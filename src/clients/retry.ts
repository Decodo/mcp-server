import { AxiosError } from 'axios';

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

export const isRetryable = (error: AxiosError): boolean => {
  if (error.response) {
    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }
  return RETRYABLE_NETWORK_CODES.has(error.code ?? '');
};

export const getRetryDelay = ({
  attempt,
  error,
  baseDelayMs = BASE_RETRY_DELAY_MS,
}: {
  attempt: number;
  error: AxiosError;
  baseDelayMs?: number;
}): number => {
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

  const baseMs = baseDelayMs * Math.pow(2, attempt);
  const jitterMs = Math.random() * 500;
  return baseMs + jitterMs;
};

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
