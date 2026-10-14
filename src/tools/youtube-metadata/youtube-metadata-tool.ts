import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class YoutubeMetadataTool extends Tool {
  toolset = TOOLSET.SOCIAL_MEDIA;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'youtube_metadata',
      {
        title: 'YouTube Metadata',
        description:
          "Fetch a YouTube video's metadata by video ID through the Decodo Web Scraping API (`youtube_metadata` target) and return it as JSON, such as title, channel, views and description. " +
          'Use it when you know the video ID and need details about the video. ' +
          'Docs: https://help.decodo.com/docs/web-scraping-youtube-metadata',
        inputSchema: {
          query: z.string().describe('YouTube video ID (e.g., "dFu9aKJoqGg")'),
        },
        annotations: {
          title: 'YouTube Metadata',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.YoutubeMetadata,
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
