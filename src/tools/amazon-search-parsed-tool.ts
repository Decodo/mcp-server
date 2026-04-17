import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { ScraperApiClient } from 'clients/scraper-api-client';
import { SCRAPER_API_TARGETS, TOOLSET } from '../constants';
import { removeKeyFromNestedObject } from '../utils';
import { zodGeo, zodJsRender } from '../zod/zod-types';

export class AmazonSearchParsedTool {
  static toolset = TOOLSET.ECOMMERCE;
  static FIELDS_WITH_HIGH_CHAR_COUNT = ['suggested', 'amazons_choices', 'refinements'];

  static transformAutoParsedResponse = ({ obj }: { obj: object }): string => {
    for (const fieldToRemove of AmazonSearchParsedTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
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
      'amazon_search_parsed',
      {
        description: 'Scrape Amazon Search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query'),
          geo: zodGeo,
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
          target: SCRAPER_API_TARGETS.AMAZON_SEARCH,
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
