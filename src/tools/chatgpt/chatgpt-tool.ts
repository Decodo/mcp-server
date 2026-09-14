import z from 'zod';
import { Target } from '@decodo/sdk-ts';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { TOOLSET } from '../../constants';
import { zodGeo } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class ChatGPTTool extends Tool {
  toolset = TOOLSET.AI;

  transformResponse = ({ data }: { data: object }) => {
    return { data: JSON.stringify(data, null, 2) };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'chatgpt',
      {
        description: 'Search and interact with ChatGPT for AI-powered responses and conversations',
        inputSchema: {
          prompt: z.string().describe('Prompt to send to ChatGPT'),
          search: z.boolean().describe("Activates ChatGPT's web search functionality").optional(),
          geo: zodGeo,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const params = {
          ...scrapingParams,
          target: Target.Chatgpt,
          parse: true,
        } satisfies ScraperAPIParams;

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params, extra });

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
