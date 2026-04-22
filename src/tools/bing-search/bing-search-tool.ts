import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { zodGeo, zodLocale, zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDomain = z
  .string()
  .describe('Bing domain (e.g., bing.com, bing.co.uk)')
  .optional();

const zodPageFrom = z
  .number()
  .describe('Starting page number for pagination')
  .optional();

export class BingSearchTool extends Tool {
  toolset = TOOLSET.SEARCH;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['url'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of BingSearchTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'bing_search',
      {
        description: 'Scrape Bing Search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query for Bing (e.g., "laptop")'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
          domain: zodDomain,
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
          target: SCRAPER_API_TARGETS.BING_SEARCH,
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
