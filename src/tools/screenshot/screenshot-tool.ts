import z from 'zod';
import { ScrapingMCPParams } from 'types';
import { zodGeo } from '../../zod/zod-types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class ScreenshotTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: string }) => {
    return { data };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'screenshot',
      {
        title: 'Screenshot',
        description:
          'Capture a PNG screenshot of a web page through the Decodo Web Scraping API (`universal` target with PNG output). ' +
          'Use it when the page layout or visuals matter, not just its text. ' +
          'Docs: https://help.decodo.com/docs/web-data-api-screenshot-response',
        inputSchema: {
          url: z.string().describe('URL to screenshot'),
          geo: zodGeo,
        },
        annotations: {
          title: 'Screenshot',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const { data } = await sapiClient.scrape({
          auth,
          scrapingParams: { ...scrapingParams, headless: 'png' },
          extra,
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
