import z from 'zod';
import type { MapSiteResponse } from '@decodo/sdk-ts';
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

type MapParams = {
  url: string;
  limit: number;
  sitemap?: 'include' | 'only' | 'skip';
  domainFilter?: 'domain' | 'subdomain' | 'all';
  selectPaths?: string[];
  excludePaths?: string[];
  geo?: string;
  locale?: string;
};

export class MapTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: MapSiteResponse }) => {
    const links = data.results.flatMap(result => result.content.links.map(link => link.url));

    return { data: JSON.stringify(links) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'map',
      {
        title: 'Map Website',
        description:
          'List the URLs on a website without fetching their content. ' +
          'Large sites can overflow your context, so `limit` defaults to 10; narrow with selectPaths or excludePaths. ' +
          'For precise work, map the site, then scrape_as_markdown only the pages you need.',
        inputSchema: {
          url: z.string().describe('Website URL to map'),
          limit: zodLimit('URLs to return'),
          sitemap: zodSitemap,
          domainFilter: zodDomainFilter,
          selectPaths: zodSelectPaths,
          excludePaths: zodExcludePaths,
          geo: zodGeo,
          locale: zodLocale,
        },
        annotations: {
          title: 'Map Website',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (
        { domainFilter, selectPaths, excludePaths, ...params }: MapParams,
        extra: ProgressExtra
      ) => {
        const data = await sapiClient.map({
          auth,
          params: {
            ...params,
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
