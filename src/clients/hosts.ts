export type ScrapingApiHosts = {
  scraperApi?: string;
  dataApi?: string;
};

type Env = Record<string, string | undefined>;

const hostFromEnv = (env: Env, key: string): string | undefined => env[key]?.trim() || undefined;

export const scrapingApiHostsFromEnv = (env: Env = process.env): ScrapingApiHosts => ({
  scraperApi: hostFromEnv(env, 'DECODO_SAPI_HOST'),
  dataApi: hostFromEnv(env, 'DECODO_DATA_API_HOST'),
});
