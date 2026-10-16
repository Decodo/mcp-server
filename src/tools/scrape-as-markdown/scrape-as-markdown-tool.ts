import z from 'zod';
import { ScrapingMCPParams } from 'types';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { zodGeo, zodJsRender, zodLocale, zodTokenLimit } from '../../zod/zod-types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';
import { ProgressExtra } from '../../utils';

export class ScrapeAsMarkdownTool extends Tool {
  toolset = TOOLSET.WEB;

  private static LARGE_CONTENT_SYMBOL_COUNT = 45_000;

  truncateResponse = ({ content, limit }: { content: string; limit: number }) => {
    return content.substring(0, limit);
  };

  transformResponse = ({ data, tokenLimit }: { data: string; tokenLimit?: number }) => {
    let markdown: string;

    try {
      markdown = NodeHtmlMarkdown.translate(data, {});
    } catch {
      markdown = data;
    }

    const limit = tokenLimit || ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT;

    if (markdown.length > limit) {
      const truncated = this.truncateResponse({ content: markdown, limit });

      return { data: truncated, isTruncated: true, totalLength: markdown.length };
    }

    return { data: markdown, isTruncated: false, totalLength: markdown.length };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'scrape_as_markdown',
      {
        title: 'Scrape as Markdown',
        description:
          'Fetch any public web page through the Decodo Web Scraping API (`universal` target) and return its content as Markdown. ' +
          'Use it to read a specific URL when no site-specific tool fits; very long pages are truncated, and `tokenLimit` sets a lower cap. ' +
          'Docs: https://help.decodo.com/docs/web-data-api-markdown-response',
        inputSchema: {
          url: z.string().describe('URL to scrape'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
          tokenLimit: zodTokenLimit,
        },
        annotations: {
          title: 'Scrape as Markdown',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams, extra: ProgressExtra) => {
        const { data } = await sapiClient.scrape({ auth, scrapingParams, extra });

        const {
          data: markdown,
          isTruncated,
          totalLength,
        } = this.transformResponse({
          data,
          tokenLimit: scrapingParams.tokenLimit,
        });

        return {
          content: [
            {
              type: 'text',
              text: isTruncated
                ? `Truncated to ${markdown.length} of ${totalLength} characters. Call again with a higher tokenLimit to get more.`
                : 'Full website content retrieved.',
            },
            {
              type: 'text',
              text: markdown,
            },
          ],
        };
      }
    );
  };
}
