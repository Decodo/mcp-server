import z from 'zod';
import type { RunSearchResponse } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import { zodGeo, zodLimit, zodLocale } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

type SearchParams = {
  query: string;
  geo?: string;
  locale?: string;
  page?: number;
  limit: number;
};

export class SearchTool extends Tool {
  toolset = TOOLSET.SEARCH;

  requiresApiKey = true;

  transformResponse = ({ data, limit }: { data: RunSearchResponse; limit: number }) => {
    if (data.status === 'failed') {
      throw new Error(`Search failed: ${data.message}`);
    }

    return { data: JSON.stringify({ ...data, organic: data.organic?.slice(0, limit) }) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'search',
      {
        title: 'Web Search',
        description:
          'Search the web and return ranked results with title, link and description. ' +
          'Results can overflow your context, so `limit` defaults to 10. ' +
          'To read a result, pass its link to scrape_as_markdown.',
        inputSchema: {
          query: z.string().describe('Search query'),
          geo: zodGeo,
          locale: zodLocale,
          page: z.number().int().min(1).describe('Results page to return, 1 by default').optional(),
          limit: zodLimit('results to return'),
        },
        annotations: {
          title: 'Web Search',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async ({ limit, ...params }: SearchParams, extra: ProgressExtra) => {
        const data = await sapiClient.search({ auth, params, extra });

        const { data: text } = this.transformResponse({ data, limit });

        return { content: [{ type: 'text', text }] };
      }
    );
  };
}
