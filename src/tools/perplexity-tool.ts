import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';
import { ScraperApiClient } from 'clients/scraper-api-client';
import { SCRAPER_API_TARGETS, TOOLSET } from '../constants';
import { zodGeo } from '../zod/zod-types';

export class PerplexityTool {
  static toolset = TOOLSET.AI;
  static register = ({
    server,
    sapiClient,
  }: {
    server: McpServer;
    sapiClient: ScraperApiClient;
  }) => {
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

        const { data } = await sapiClient.scrape<object>({ scrapingParams: params });

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
