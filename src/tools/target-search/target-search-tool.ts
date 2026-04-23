import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDeliveryZip = z.string().describe('ZIP code for delivery location').optional();

const zodStoreId = z.string().describe('Target store ID for local inventory').optional();

export class TargetSearchTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['suggested', 'refinements'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of TargetSearchTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'target_search',
      {
        description: 'Scrape Target Search results with automatic parsing',
        inputSchema: {
          query: z.string().describe('Search query for Target products'),
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
          headless: 'html',
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.TARGET_SEARCH,
          markdown: true,
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
