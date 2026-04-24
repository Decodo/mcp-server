import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodJsRender, zodDeviceType, zodLocale } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodPageFrom = z
  .number()
  .describe('Starting page number for pagination')
  .optional();

export class GoogleTravelHotelsTool extends Tool {
  toolset = TOOLSET.SEARCH;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'google_travel_hotels',
      {
        description: 'Scrape Google Travel Hotels search results',
        inputSchema: {
          query: z.string().describe('Hotel search query (e.g., "trivago", "hotels in Paris")'),
          jsRender: zodJsRender,
          locale: zodLocale,
          deviceType: zodDeviceType,
          pageFrom: zodPageFrom,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.GOOGLE_TRAVEL_HOTELS,
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
