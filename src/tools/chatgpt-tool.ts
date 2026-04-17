import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { ScraperApiClient } from 'clients/scraper-api-client';
import { SCRAPER_API_TARGETS, TOOLSET } from '../constants';
import { zodGeo } from '../zod/zod-types';

export class ChatGPTTool {
  static toolset = TOOLSET.AI;
  static register = ({
    server,
    sapiClient,
    getAuthToken,
  }: {
    server: McpServer;
    sapiClient: ScraperApiClient;
    getAuthToken: () => string;
  }) => {
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
      async (scrapingParams: ScrapingMCPParams) => {
        const params = {
          ...scrapingParams,
          target: SCRAPER_API_TARGETS.CHATGPT,
          parse: true,
        } satisfies ScraperAPIParams;

        const auth = getAuthToken();

        const { data } = await sapiClient.scrape<object>({ auth, scrapingParams: params });

        const text = JSON.stringify(data, null, 2);

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
