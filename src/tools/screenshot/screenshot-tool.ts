import z from 'zod';
import { ScrapingMCPParams } from 'types';
import { zodGeo } from '../../zod/zod-types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';

export class ScreenshotTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: string }) => {
    return { data };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
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
