import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';

const zodLimit = z
  .number()
  .describe('Maximum number of videos to return')
  .optional();

export class YoutubeChannelTool extends Tool {
  toolset = TOOLSET.SOCIAL_MEDIA;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'youtube_channel',
      {
        description: 'Scrape YouTube channel videos with automatic parsing',
        inputSchema: {
          query: z.string().describe('YouTube channel handle or ID (e.g., "@decodo_official")'),
          limit: zodLimit,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.YOUTUBE_CHANNEL,
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
