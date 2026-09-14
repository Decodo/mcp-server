import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { zodJsRender, zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodDeliveryZip = z.string().describe('ZIP code for delivery location').optional();

export class TargetProductTool extends Tool {
  toolset = TOOLSET.ECOMMERCE;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'target_product',
      {
        description: 'Scrape Target Product page with automatic parsing',
        inputSchema: {
          product_id: z.string().describe('Target product ID (e.g., "1003921355")'),
          jsRender: zodJsRender,
          deviceType: zodDeviceType,
          deliveryZip: zodDeliveryZip,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          headless: 'html',
          ...scrapingParams,
          target: Target.TargetProduct,
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
