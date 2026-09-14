import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { removeKeyFromNestedObject, ProgressExtra } from '../../utils';
import { zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodDomain = z
  .string()
  .describe('Amazon domain (e.g., amazon.com, amazon.co.uk)')
  .optional();

const zodGeo = z
  .string()
  .describe('Amazon geo location (e.g., 10001 for US ZIP code)')
  .optional();

const zodPageFrom = z
  .number()
  .describe('Starting page number for pagination')
  .optional();

export class AmazonPricingTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['seller_link'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of AmazonPricingTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'amazon_pricing',
      {
        description: 'Scrape Amazon Product pricing information with automatic parsing',
        inputSchema: {
          query: z.string().describe('Amazon product ASIN (e.g., "B09H74FXNW")'),
          jsRender: zodJsRender,
          domain: zodDomain,
          pageFrom: zodPageFrom,
          geo: zodGeo,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.AmazonPricing,
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
