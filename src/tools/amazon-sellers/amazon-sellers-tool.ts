import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { zodJsRender } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodDomain = z
  .string()
  .describe('Amazon domain (e.g., amazon.com, amazon.co.uk)')
  .optional();

const zodGeo = z
  .string()
  .describe('Amazon geo location (e.g., 10001 for US ZIP code)')
  .optional();

export class AmazonSellersTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'amazon_sellers',
      {
        title: 'Amazon Sellers',
        description:
          'Fetch an Amazon seller profile by seller ID through the Decodo Web Scraping API (`amazon_sellers` target) and return it parsed as JSON. ' +
          "Use it to check a seller's name, rating and feedback. " +
          'Docs: https://help.decodo.com/docs/web-scraping-api-amazon-sellers',
        inputSchema: {
          query: z.string().describe('Amazon seller ID (e.g., "A1R0Z7FJGTKESH")'),
          jsRender: zodJsRender,
          domain: zodDomain,
          geo: zodGeo,
        },
        annotations: {
          title: 'Amazon Sellers',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.AmazonSellers,
          parse: true,
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
