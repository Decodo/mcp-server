import type { TargetString } from '@decodo/sdk-ts';

export type ScrapingMCPParams = {
  target?: TargetString;
  url?: string;
  query?: string;
  prompt?: string;
  search?: boolean;
  geo?: string;
  locale?: string;
  jsRender?: boolean;
  headless?: string;
  storeId?: string;
  tokenLimit?: number;
  xhr?: boolean;
};

export type ScraperAPIParams = {
  target?: TargetString;
  url?: string;
  query?: string;
  prompt?: string;
  search?: boolean;
  geo?: string;
  locale?: string;
  headless?: string;
  parse?: boolean;
  xhr?: boolean;
  markdown?: boolean;
  walmart_store_id?: string;
};
