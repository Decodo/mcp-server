import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class TiktokShopUrlTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'tiktok_shop_url',
      {
        title: 'TikTok Shop URL',
        description:
          'Fetch any TikTok Shop page by URL through the Decodo Web Scraping API (`tiktok` target) and return the page\'s raw HTML, often several hundred KB. ' +
          'Use it for TikTok Shop pages that tiktok_shop_search and tiktok_shop_product do not cover, such as a shop or category URL. ' +
          'Docs: https://help.decodo.com/docs/web-scraping-api-tiktok-shop-url',
        inputSchema: {
          url: z.string().describe('TikTok Shop URL (e.g., "https://www.tiktok.com/shop/s?q=HEADPHONES")'),
          jsRender: zodJsRender,
        },
        annotations: {
          title: 'TikTok Shop URL',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.Tiktok,
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
