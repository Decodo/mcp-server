import z from 'zod';
import type { StartCrawlResponse } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import {
  zodDomainFilter,
  zodExcludePaths,
  zodGeo,
  zodLimit,
  zodLocale,
  zodSelectPaths,
  zodSitemap,
} from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

type CrawlStartParams = {
  url: string;
  limit: number;
  maxDepth?: number;
  sitemap?: 'include' | 'only' | 'skip';
  domainFilter?: 'domain' | 'subdomain' | 'all';
  selectPaths?: string[];
  excludePaths?: string[];
  geo?: string;
  locale?: string;
};

export class CrawlStartTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: StartCrawlResponse }) => ({
    data: JSON.stringify({ crawl_id: data.crawl_id, status: data.status, url: data.url }),
  });

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'crawl_start',
      {
        title: 'Start Crawl',
        description:
          'Start crawling a website and return the crawl id right away, without waiting for it to finish. ' +
          'Check progress with crawl_status, read pages with crawl_results and stop it early with crawl_cancel. ' +
          'Crawled content can overflow your context, so `limit` defaults to 10 pages. ' +
          'For precise work, prefer map plus scrape_as_markdown on the pages you need.',
        inputSchema: {
          url: z.string().describe('Website URL to start crawling from'),
          limit: zodLimit('pages to crawl'),
          maxDepth: z
            .number()
            .int()
            .min(1)
            .max(10000)
            .describe('How many links deep to follow from the start URL')
            .optional(),
          sitemap: zodSitemap,
          domainFilter: zodDomainFilter,
          selectPaths: zodSelectPaths,
          excludePaths: zodExcludePaths,
          geo: zodGeo,
          locale: zodLocale,
        },
        annotations: {
          title: 'Start Crawl',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (
        { maxDepth, domainFilter, selectPaths, excludePaths, ...params }: CrawlStartParams,
        extra: ProgressExtra
      ) => {
        const data = await sapiClient.startCrawl({
          auth,
          params: {
            ...params,
            output: 'markdown',
            max_depth: maxDepth,
            domain_filter: domainFilter,
            select_paths: selectPaths,
            exclude_paths: excludePaths,
          },
          extra,
        });

        const { data: text } = this.transformResponse({ data });

        return { content: [{ type: 'text', text }] };
      }
    );
  };
}
