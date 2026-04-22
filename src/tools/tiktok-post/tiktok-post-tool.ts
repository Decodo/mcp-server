import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodXhr } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class TiktokPostTool extends Tool {
  toolset = TOOLSET.SOCIAL_MEDIA;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, getAuthToken }: ToolRegistrationArgs) => {
    server.registerTool(
      'tiktok_post',
      {
        description:
          'Scrape a TikTok post URL for structured data such as engagement, captions, and hashtags',
        inputSchema: {
          url: z
            .string()
            .describe('TikTok post URL, e.g. https://www.tiktok.com/@user/video/1234567890'),
          xhr: zodXhr,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.TIKTOK_POST,
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
