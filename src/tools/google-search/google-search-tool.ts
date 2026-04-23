import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { zodGeo, zodLocale, zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class GoogleSearchTool extends Tool {
  toolset = TOOLSET.SEARCH;

  static FIELDS_WITH_HIGH_CHAR_COUNT = [
    'images',
    'image_data',
    'related_searches_urls',
    'factoids',
    'people_also_buy_from',
    'what_people_are_saying',
  ];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of GoogleSearchTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'google_search',
      {
        description: 'Scrape Google Search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.GOOGLE_SEARCH,
          parse: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

        const { data: text } = this.transformResponse({ data });

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }
    );
  };
}
