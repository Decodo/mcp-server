import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

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
          target: SCRAPER_API_TARGETS.AMAZON_BESTSELLERS,
          parse: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

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
