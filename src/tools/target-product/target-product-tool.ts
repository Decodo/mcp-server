import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDeliveryZip = z
  .string()
  .describe('ZIP code for delivery location')
  .optional();

const zodStoreId = z
  .string()
  .describe('Target store ID for local inventory')
  .optional();

export class TargetProductTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'target_product',
      {
        description: 'Scrape Target Product page with automatic parsing',
        inputSchema: {
          product_id: z.string().describe('Target product ID (e.g., "92186007")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          deliveryZip: zodDeliveryZip,
          storeId: zodStoreId,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.TARGET_PRODUCT,
          parse: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data),
            },
          ],
        };
      }
    );
  };
}
