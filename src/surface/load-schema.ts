import { homedir } from 'node:os';
import { join } from 'node:path';
import { BundledSchema, RemoteSchema } from '@decodo/sdk-ts';
import type { FlowSchema } from '@decodo/sdk-ts';

const LOAD_TIMEOUT_MS = 3_000;
export const IR_TTL_MS = 3_600_000;

type Env = Record<string, string | undefined>;

const cachePathOf = (env: Env): string =>
  join(env.XDG_CACHE_HOME?.trim() || join(homedir(), '.cache'), 'decodo-mcp', 'decodo.ir.json');

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

type LoadOptions = {
  env?: Env;
  log?: (message: string) => void;
  fallback?: FlowSchema;
  preferCache?: boolean;
  ttlMs?: number;
};

const isOlder = (version: string, than: string): boolean => {
  const [a, b] = [version, than].map(v => v.split('.').map(part => parseInt(part, 10) || 0));

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) {
      return (a[i] ?? 0) < (b[i] ?? 0);
    }
  }

  return false;
};

export const loadFlowSchema = async ({
  env = process.env,
  log = message => console.error(message),
  fallback = BundledSchema.shared,
  preferCache = false,
  ttlMs = IR_TTL_MS,
}: LoadOptions = {}): Promise<FlowSchema> => {
  const url = env.DECODO_IR_URL?.trim() || undefined;
  const cachePath = cachePathOf(env);

  try {
    const schema = await withTimeout(
      RemoteSchema.load({ url, cachePath, ttlMs: preferCache ? Infinity : ttlMs }),
      LOAD_TIMEOUT_MS
    );

    if (preferCache) {
      void RemoteSchema.load({ url, cachePath, ttlMs }).catch(() => undefined);
    }

    return !url && isOlder(schema.version, BundledSchema.shared.version)
      ? BundledSchema.shared
      : schema;
  } catch (error) {
    log(
      `Could not load the Decodo IR (${(error as Error).message}); keeping version ${fallback.version}.`
    );

    return fallback;
  }
};
