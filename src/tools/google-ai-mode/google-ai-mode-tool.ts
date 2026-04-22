import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodDeviceType } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodGeo = z
  .string()
  .describe('Geo location for AI mode search (e.g., "us", "uk")')
  .optional();

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
          query: z.string().describe('Search query for Google AI Mode (e.g., "What are the top three dog breeds?")'),
          geo: zodGeo,
          deviceType: zodDeviceType,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.GOOGLE_AI_MODE,
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
