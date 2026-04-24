import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject, ProgressExtra } from '../../utils';
import { zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDeliveryZip = z
  .string()
  .describe('ZIP code for delivery location')
  .optional();

const zodWalmartStoreId = z
  .string()
  .describe('Walmart store ID for local inventory')
  .optional();

export class WalmartSearchTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['suggested', 'refinements'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of WalmartSearchTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'walmart_search',
      {
        description: 'Scrape Walmart Search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query for Walmart products (e.g., "camping tent")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          deliveryZip: zodDeliveryZip,
          storeId: zodWalmartStoreId,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.WALMART_SEARCH,
          markdown: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params, extra });

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
