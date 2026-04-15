import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { ScraperApiClient } from 'clients/scraper-api-client';
import { SCRAPER_API_TARGETS } from '../constants';
import { removeKeyFromNestedObject } from '../utils';
import { zodGeo, zodLocale, zodJsRender } from '../zod/zod-types';

export class GoogleSearchParsedTool {
  static FIELDS_WITH_HIGH_CHAR_COUNT = [
    'images',
    'image_data',
    'related_searches_urls',
    'factoids',
    'people_also_buy_from',
    'what_people_are_saying',
  ];

  static transformAutoParsedResponse = ({ obj }: { obj: object }): string => {
    for (const fieldToRemove of GoogleSearchParsedTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      obj = removeKeyFromNestedObject({ obj, keyToRemove: fieldToRemove });
    }

    const text = JSON.stringify(obj);

    return text;
  };

  static register = ({
    server,
    sapiClient,
    getAuthToken,
  }: {
    server: McpServer;
    sapiClient: ScraperApiClient;
    getAuthToken: () => string;
  }) => {
    server.registerTool(
      'google_search_parsed',
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

        const auth = getAuthToken();

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

        const text = this.transformAutoParsedResponse({ obj: data });

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
