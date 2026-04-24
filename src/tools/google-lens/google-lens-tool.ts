import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject, ProgressExtra } from '../../utils';
import { zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class GoogleLensTool extends Tool {
  toolset = TOOLSET.SEARCH;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['url_thumbnail'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of GoogleLensTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'google_lens',
      {
        description: 'Scrape Google Lens image search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Image URL for Google Lens search (e.g., "https://example.com/image.jpg")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.GOOGLE_LENS,
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
