import { SCRAPER_API_TARGETS } from './constants';

export type ScrapingMCPParams = {
  url?: string;
  query?: string;
  prompt?: string;
  search?: boolean;
  geo?: string;
  locale?: string;
  jsRender?: boolean;
  headless?: string;
  tokenLimit?: number;
  xhr?: boolean;
};

export type ScraperAPIParams = {
  target?: SCRAPER_API_TARGETS;
  url?: string;
  query?: string;
  prompt?: string;
  search?: boolean;
  geo?: string;
  locale?: string;
  headless?: string;
  parse?: boolean;
  xhr?: boolean;
};
