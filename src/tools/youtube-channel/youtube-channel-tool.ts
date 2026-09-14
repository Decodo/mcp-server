import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

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
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.YoutubeChannel,
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
