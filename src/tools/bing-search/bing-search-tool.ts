import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { removeKeyFromNestedObject, ProgressExtra } from '../../utils';
import { zodGeo, zodLocale, zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDeviceType = z
  .enum(['desktop', 'mobile'])
  .describe('Device type to emulate for the request')
  .optional();

const zodDomain = z.string().describe('Bing domain (e.g., bing.com, bing.co.uk)').optional();

const zodPageFrom = z.number().describe('Starting page number for pagination').optional();

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
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.BingSearch,
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
