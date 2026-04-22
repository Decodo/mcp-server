import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { zodGeo, zodLocale, zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodPageFrom = z
  .number()
  .describe('Starting page number for pagination')
  .optional();

export class GoogleAdsTool extends Tool {
  toolset = TOOLSET.SEARCH;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['url'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of GoogleAdsTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'google_ads',
      {
        description: 'Scrape Google Ads search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query for Google Ads (e.g., "laptop")'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          pageFrom: zodPageFrom,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.GOOGLE_ADS,
          parse: true,
        } satisfies ScraperAPIParams;

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
