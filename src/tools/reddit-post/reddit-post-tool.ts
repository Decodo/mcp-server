import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { removeKeyFromNestedObject } from '../../utils';
import { Tool, ToolRegistrationArgs } from '../tool';

export class RedditPostTool extends Tool {
  toolset = TOOLSET.SOCIAL_MEDIA;

  private static FIELDS_WITH_HIGH_CHAR_COUNT = ['author_flair_richtext'];

  transformResponse = ({ data }: { data: object }) => {
    for (const fieldToRemove of RedditPostTool.FIELDS_WITH_HIGH_CHAR_COUNT) {
      data = removeKeyFromNestedObject({ obj: data, keyToRemove: fieldToRemove });
    }

    return { data: JSON.stringify(data) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'reddit_post',
      {
        description: 'Scrape a specific Reddit post',
        inputSchema: {
          url: z
            .string()
            .describe(
              'reddit post URL (eg. https://www.reddit.com/r/hometheater/comments/1jz9xk5/lg_ubk90_only_works_when_plugged_into_tv_via)'
            ),
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.REDDIT_POST,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

        const { data: text } = this.transformResponse({ data });

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }
    );
  };
}
