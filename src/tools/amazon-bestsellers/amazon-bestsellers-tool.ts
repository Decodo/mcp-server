import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodDomain = z
  .string()
  .describe('Amazon domain (e.g., amazon.com, amazon.co.uk)')
  .optional();

const zodPageFrom = z
  .number()
  .describe('Starting page number for pagination')
  .optional();

export class AmazonBestsellersTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'amazon_bestsellers',
      {
        title: 'Amazon Bestsellers',
        description:
          'Fetch the Amazon Best Sellers list for a category through the Decodo Web Scraping API (`amazon_bestsellers` target) and return it parsed as JSON. ' +
          'Use it to see the top-selling products in a category. ' +
          'Docs: https://help.decodo.com/docs/web-scraping-api-amazon-bestsellers',
        inputSchema: {
          query: z.string().describe('Amazon category (e.g., "mobile-apps", "electronics")'),
          domain: zodDomain,
          pageFrom: zodPageFrom,
        },
        annotations: {
          title: 'Amazon Bestsellers',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.AmazonBestsellers,
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
