import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

const zodLanguageCode = z
  .string()
  .describe('Language code for subtitles (e.g., "en", "es")')
  .optional();

export class YoutubeSubtitlesTool extends Tool {
  toolset = TOOLSET.SOCIAL_MEDIA;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'youtube_subtitles',
      {
        description: 'Scrape YouTube video subtitles',
        inputSchema: {
          query: z.string().describe('YouTube video ID (e.g., "L8zSWbQN-v8")'),
          language_code: zodLanguageCode,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.YoutubeSubtitles,
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
