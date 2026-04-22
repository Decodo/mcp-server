import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodJsRender, zodDeviceType, zodCountry } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class TiktokShopProductTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'tiktok_shop_product',
      {
        description: 'Scrape TikTok Shop Product page',
        inputSchema: {
          product_id: z.string().describe('TikTok Shop product ID (e.g., "1731541214379741272")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          country: zodCountry,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.TIKTOK_SHOP_PRODUCT,
          markdown: true,
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
