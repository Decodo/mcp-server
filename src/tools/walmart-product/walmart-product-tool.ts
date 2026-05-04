import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject, ProgressExtra } from '../../utils';
import { zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDeliveryZip = z
  .string()
  .describe('ZIP code for delivery location')
  .optional();

const zodStoreId = z
  .string()
  .describe('Walmart store ID for local inventory')
  .optional();

export class WalmartProductTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['specifications', 'breadcrumbs'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of WalmartProductTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'walmart_product',
      {
        description: 'Scrape Walmart Product page with automatic parsing',
        inputSchema: {
          product_id: z.string().describe('Walmart product ID (e.g., "15296401808")'),
          jsRender: zodJsRender,
          deliveryZip: zodDeliveryZip,
          storeId: zodStoreId,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.WALMART_PRODUCT,
          parse: true,
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
