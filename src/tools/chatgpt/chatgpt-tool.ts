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
        title: 'ChatGPT',
        description:
          'Send one prompt to ChatGPT through the Decodo Web Scraping API (`chatgpt` target) and return its answer parsed as JSON. ' +
          'Each call is a single prompt and answer, with no conversation history; set `search` to let ChatGPT use web search. ' +
          'Use it to see how ChatGPT answers a question, for example to check how it describes a brand. ' +
          'Docs: https://help.decodo.com/docs/web-scraping-api-chatgpt',
        inputSchema: {
          prompt: z.string().describe('Prompt to send to ChatGPT'),
          search: z.boolean().describe("Activates ChatGPT's web search functionality").optional(),
          geo: zodGeo,
        },
        annotations: {
          title: 'ChatGPT',
          readOnlyHint: true,
          destructiveHint: false,
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
