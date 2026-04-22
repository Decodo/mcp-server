import z from 'zod';
import { ScrapingMCPParams } from 'types';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { zodGeo, zodJsRender, zodLocale, zodTokenLimit } from '../../zod/zod-types';
import { TOOLSET } from '../../constants';
import { Tool, ToolRegistrationArgs } from '../tool';

export class ScrapeAsMarkdownTool extends Tool {
  toolset = TOOLSET.WEB;

  private static LARGE_CONTENT_SYMBOL_COUNT = 100_000;

  isResponseOverLimit = (content: string) => {
    return content.length > ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT;
  };

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

    if (tokenLimit || this.isResponseOverLimit(markdown)) {
      const truncated = this.truncateResponse({
        content: markdown,
        limit: tokenLimit || ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT,
      });

      return { data: truncated, isTruncated: true };
    }

    return { data: markdown, isTruncated: false };
  };

  register = ({ server, sapiClient, auth }: ToolRegistrationArgs) => {
    server.registerTool(
      'scrape_as_markdown',
      {
        description: 'Scrape the contents of a website and return Markdown-formatted results',
        inputSchema: {
          url: z.string().describe('URL to scrape'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
          tokenLimit: zodTokenLimit,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const { data } = await sapiClient.scrape({ auth, scrapingParams });

        const { data: markdown, isTruncated } = this.transformResponse({
          data,
          tokenLimit: scrapingParams.tokenLimit,
        });

        return {
          content: [
            {
              type: 'text',
              text: isTruncated
                ? `The website content is over ${ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT} symbols, therefore, the content has been truncated. If you wish to obtain the full response, just say "full response". Alternatively, you say a specific token limit in the prompt.`
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
