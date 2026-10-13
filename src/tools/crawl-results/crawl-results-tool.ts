import z from 'zod';
import type { CrawlPageList } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import { zodLimit } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

type CrawlResultsParams = {
  crawlId: string;
  cursor?: string;
  limit: number;
};

type ResultsPosition = {
  upstreamCursor?: string;
  offset: number;
};

const encodeCursor = (position: ResultsPosition) =>
  Buffer.from(JSON.stringify(position)).toString('base64url');

const decodeCursor = (cursor?: string): ResultsPosition => {
  if (!cursor) {
    return { offset: 0 };
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new Error(
      'Invalid cursor: pass the nextCursor value from a previous crawl_results call.'
    );
  }
};

const nextPosition = ({
  data,
  position,
  end,
}: {
  data: CrawlPageList;
  position: ResultsPosition;
  end: number;
}): ResultsPosition | undefined => {
  if (end < data.pages.length) {
    return { upstreamCursor: position.upstreamCursor, offset: end };
  }

  if (data.next) {
    return { upstreamCursor: data.next, offset: 0 };
  }

  return undefined;
};

export class CrawlResultsTool extends Tool {
  toolset = TOOLSET.WEB;

  requiresApiKey = true;

  transformResponse = ({
    data,
    position,
    limit,
  }: {
    data: CrawlPageList;
    position: ResultsPosition;
    limit: number;
  }) => {
    const end = position.offset + limit;
    const pages = data.pages.slice(position.offset, end).map(page => ({
      url: page.url,
      depth: page.depth,
      status: page.status,
      content: page.content,
      contentError: page.content_error,
    }));

    const next = nextPosition({ data, position, end });

    return {
      data: JSON.stringify({
        pages,
        nextCursor: next && encodeCursor(next),
        total: data.total,
      }),
    };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'crawl_results',
      {
        title: 'Crawl Results',
        description:
          'Return crawled pages as Markdown from a crawl started with crawl_start, a few at a time. ' +
          'Pages can be long and overflow your context, so `limit` defaults to 10; lower it for large pages. ' +
          'Pass nextCursor back to get the following pages; when it is missing, there are no more yet. ' +
          'For precise work, prefer map plus scrape_as_markdown on the pages you need.',
        inputSchema: {
          crawlId: z.string().describe('Crawl id returned by crawl_start'),
          cursor: z
            .string()
            .describe('nextCursor from a previous crawl_results call; omit for the first pages')
            .optional(),
          limit: zodLimit('pages to return'),
        },
        annotations: {
          title: 'Crawl Results',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async ({ crawlId, cursor, limit }: CrawlResultsParams, extra: ProgressExtra) => {
        const position = decodeCursor(cursor);

        const data = await sapiClient.listCrawlPages({
          auth,
          crawlId,
          cursor: position.upstreamCursor,
          extra,
        });

        const { data: text } = this.transformResponse({ data, position, limit });

        return { content: [{ type: 'text', text }] };
      }
    );
  };
}
