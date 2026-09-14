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
        description: 'Scrape Amazon Bestsellers list with automatic parsing',
        inputSchema: {
          query: z.string().describe('Amazon category (e.g., "mobile-apps", "electronics")'),
          domain: zodDomain,
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
