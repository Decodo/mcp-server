import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScrapingMCPParams } from 'types';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { zodGeo } from '../zod/zod-types';
import { TOOLSET } from '../constants';

export class ScreenshotTool {
  static toolset = TOOLSET.WEB;
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
      'screenshot',
      {
        description: 'Capture a screenshot of any webpage and return it as a PNG image',
        inputSchema: {
          url: z.string().describe('URL to screenshot'),
          geo: zodGeo,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const auth = getAuthToken();

        const { data } = await sapiClient.scrape({
          auth,
          scrapingParams: { ...scrapingParams, headless: 'png' },
        });

        return {
          content: [
            {
              type: 'image' as const,
              data: data as string,
              mimeType: 'image/png',
            },
          ],
        };
      }
    );
  };
}
