import z from 'zod';
import type { CrawlPage, CrawlPageList } from '@decodo/sdk-ts';
import { TOOLSET } from '../../constants';
import { ProgressExtra } from '../../utils';
import { zodLimit } from '../../zod/zod-types';
import { Tool, ToolRegistrationArgs } from '../tool';

const PAGES_BUDGET_BYTES = 49_000;

type CrawlResultsParams = {
  crawlId: string;
  cursor?: string;
  limit: number;
};

const zodResultsPosition = z
  .object({
    upstreamCursor: z.string().optional(),
    offset: z.number().int().min(0),
    contentOffset: z.number().int().min(0),
    returned: z.number().int().min(0),
  })
  .strict();

type ResultsPosition = z.infer<typeof zodResultsPosition>;

const START_POSITION: ResultsPosition = { offset: 0, contentOffset: 0, returned: 0 };

const INVALID_CURSOR_MESSAGE =
  'Invalid cursor: pass the nextCursor value from a previous crawl_results call.';

const encodeCursor = (position: ResultsPosition) =>
  Buffer.from(JSON.stringify(position)).toString('base64url');

const parseCursorJson = (cursor: string): unknown => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }
};

const decodeCursor = (cursor?: string): ResultsPosition => {
  if (!cursor) {
    return START_POSITION;
  }

  const position = zodResultsPosition.safeParse(parseCursorJson(cursor));

  if (!position.success) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  return position.data;
};

const serializedBytes = (text: string) => Buffer.byteLength(JSON.stringify(text));

const isHighSurrogate = (char: string) => /[\uD800-\uDBFF]/.test(char);

const prefixWithinBudget = (text: string, budgetBytes: number) => {
  let fits = 0;
  let tooLong = Math.min(text.length, budgetBytes) + 1;

  while (tooLong - fits > 1) {
    const middle = Math.floor((fits + tooLong) / 2);

    if (serializedBytes(text.slice(0, middle)) <= budgetBytes) {
      fits = middle;
    } else {
      tooLong = middle;
    }
  }

  return isHighSurrogate(text.charAt(fits - 1)) ? text.slice(0, fits - 1) : text.slice(0, fits);
};

const pageSummary = (page: CrawlPage) => ({
  url: page.url,
  depth: page.depth,
  status: page.status,
  contentError: page.content_error,
});

const entryOverheadBytes = (summary: ReturnType<typeof pageSummary>) =>
  Buffer.byteLength(
    JSON.stringify({
      ...summary,
      content: '',
      contentPart: {
        start: Number.MAX_SAFE_INTEGER,
        end: Number.MAX_SAFE_INTEGER,
        totalLength: Number.MAX_SAFE_INTEGER,
      },
    })
  ) + 1;

const collectPages = ({
  data,
  position,
  limit,
}: {
  data: CrawlPageList;
  position: ResultsPosition;
  limit: number;
}) => {
  const pages = [];
  let { offset, contentOffset, returned } = position;
  let budgetBytes = PAGES_BUDGET_BYTES;

  while (offset < data.pages.length && pages.length < limit) {
    const page = data.pages[offset];
    const summary = pageSummary(page);
    const overheadBytes = entryOverheadBytes(summary);
    const content = page.content ?? '';
    const remaining = content.slice(contentOffset);
    const chunk = prefixWithinBudget(remaining, Math.max(0, budgetBytes - overheadBytes));
    const fitsWhole = overheadBytes <= budgetBytes && chunk.length === remaining.length;

    if (!fitsWhole && pages.length > 0) {
      break;
    }

    const isSplit = contentOffset > 0 || chunk.length < remaining.length;

    const entry = {
      ...summary,
      content: page.content === undefined ? undefined : chunk,
      ...(isSplit && {
        contentPart: {
          start: contentOffset,
          end: contentOffset + chunk.length,
          totalLength: content.length,
        },
      }),
    };

    pages.push(entry);
    budgetBytes -= Buffer.byteLength(JSON.stringify(entry)) + 1;

    if (chunk.length < remaining.length) {
      contentOffset += chunk.length;
      break;
    }

    offset += 1;
    contentOffset = 0;
    returned += 1;
  }

  return {
    pages,
    stoppedAt: { upstreamCursor: position.upstreamCursor, offset, contentOffset, returned },
  };
};

const nextPosition = ({
  data,
  stoppedAt,
}: {
  data: CrawlPageList;
  stoppedAt: ResultsPosition;
}): ResultsPosition | undefined => {
  if (stoppedAt.offset < data.pages.length) {
    return stoppedAt;
  }

  if (data.total !== undefined && stoppedAt.returned >= data.total) {
    return undefined;
  }

  if (data.next) {
    return { ...START_POSITION, upstreamCursor: data.next, returned: stoppedAt.returned };
  }

  return undefined;
};

export class CrawlResultsTool extends Tool {
  toolset = TOOLSET.WEB;

  transformResponse = ({
    data,
    position,
    limit,
  }: {
    data: CrawlPageList;
    position: ResultsPosition;
    limit: number;
  }) => {
    const { pages, stoppedAt } = collectPages({ data, position, limit });
    const next = nextPosition({ data, stoppedAt });

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
          'Call it once crawl_status reports the crawl is no longer "pending". ' +
          'Crawled pages can be long and overflow your context, so each call returns at most about 50 KB and up to `limit` pages (10 by default). ' +
          'A page too long for one call is split across calls; each part carries contentPart with its character range. ' +
          'Pass nextCursor back to get the rest; when it is missing, you have every page. ' +
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
