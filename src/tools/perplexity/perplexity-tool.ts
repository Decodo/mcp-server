import z from 'zod';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { SCRAPER_API_TARGETS, TOOLSET } from '../../constants';
import { zodGeo } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

export class PerplexityTool extends Tool {
  toolset = TOOLSET.AI;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data, null, 2) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'perplexity',
      {
        description:
          'Search and interact with Perplexity for AI-powered responses and conversations',
        inputSchema: {
          prompt: z.string().describe('Prompt to send to Perplexity'),
          geo: zodGeo,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.PERPLEXITY,
          parse: true,
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
