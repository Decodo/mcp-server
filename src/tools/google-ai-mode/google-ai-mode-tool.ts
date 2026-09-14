import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodDeviceType = z
  .enum(['desktop', 'mobile'])
  .describe('Device type to emulate for the request')
  .optional();

const zodGeo = z.string().describe('Geo location for AI mode search (e.g., "us", "uk")').optional();

export class GoogleAiModeTool extends Tool {
  toolset = TOOLSET.AI;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'google_ai_mode',
      {
        description: 'Scrape Google AI Mode (Search with AI) results with automatic parsing',
        inputSchema: {
          query: z
            .string()
            .describe(
              'Search query for Google AI Mode (e.g., "What are the top three dog breeds?")'
            ),
          geo: zodGeo,
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
          target: Target.GoogleAiMode,
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
