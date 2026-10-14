import z from 'zod';
import type { CancelCrawlResponse } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import { Tool, ToolRegistrationArgs } from '../tool';

export class CrawlCancelTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({ data }: { data: CancelCrawlResponse }) => ({
    data: JSON.stringify({ crawl_id: data.crawl_id, status: data.status, url: data.url }),
  });

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'crawl_cancel',
      {
        title: 'Cancel Crawl',
        description:
          'Stop a crawl started with crawl_start so it crawls no more pages. ' +
          'Pages crawled before the cancel stay readable with crawl_results.',
        inputSchema: {
          crawlId: z.string().describe('Crawl id returned by crawl_start'),
        },
        annotations: {
          title: 'Cancel Crawl',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async ({ crawlId }: { crawlId: string }, extra: ProgressExtra) => {
        const data = await sapiClient.cancelCrawl({ auth, crawlId, extra });

        const { data: text } = this.transformResponse({ data });

        return { content: [{ type: 'text', text }] };
      }
    );
  };
}
