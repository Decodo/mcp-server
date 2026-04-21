import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { zodGeo, zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class AmazonSearchTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['suggested', 'amazons_choices', 'refinements'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of AmazonSearchTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, getAuthToken }: ToolRegistrationArgs) => {
    server.registerTool(
      'amazon_search',
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
