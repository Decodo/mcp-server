import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { zodJsRender, zodDeviceType, zodCountry } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class TiktokShopProductTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'tiktok_shop_product',
      {
        title: 'TikTok Shop Product',
        description:
          'Fetch a TikTok Shop product page by product ID through the Decodo Web Scraping API (`tiktok_shop_product` target) and return it as Markdown. ' +
          'Use it when you know a TikTok Shop product ID and need its price, seller or description. ' +
          'Docs: https://help.decodo.com/docs/web-scraping-api-tiktok-shop-product',
        inputSchema: {
          product_id: z.string().describe('TikTok Shop product ID (e.g., "1731541214379741272")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          country: zodCountry,
        },
        annotations: {
          title: 'TikTok Shop Product',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.TiktokShopProduct,
          markdown: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params, extra });

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
