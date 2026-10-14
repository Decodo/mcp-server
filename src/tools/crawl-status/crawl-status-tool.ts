import z from 'zod';
import type { GetCrawlStatusResponse } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import { Tool, ToolRegistrationArgs } from '../tool';

export class CrawlStatusTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: GetCrawlStatusResponse }) => ({
    data: JSON.stringify(data),
  });

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'crawl_status',
      {
        title: 'Crawl Status',
        description:
          'Report the progress of a crawl started with crawl_start: its status and how many pages were discovered, completed and failed. ' +
          'The crawl is finished once status is no longer "pending".',
        inputSchema: {
          crawlId: z.string().describe('Crawl id returned by crawl_start'),
        },
        annotations: {
          title: 'Crawl Status',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async ({ crawlId }: { crawlId: string }, extra: ProgressExtra) => {
        const data = await sapiClient.getCrawlStatus({ auth, crawlId, extra });

        const { data: text } = this.transformResponse({ data });

        return { content: [{ type: 'text', text }] };
      }
    );
  };
}
