import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScrapingMCPParams } from 'types';
import { ScraperApiClient } from '../clients/scraper-api-client';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { zodFullResponse, zodGeo, zodJsRender, zodLocale, zodTokenLimit } from '../zod/zod-types';
import { TOOLSET } from '../constants';

export class ScrapeAsMarkdownTool {
  static toolset = TOOLSET.WEB;
  static LARGE_CONTENT_SYMBOL_COUNT = 100_000;

  static isResponseOverLimit = (content: string) => {
    return content.length > this.LARGE_CONTENT_SYMBOL_COUNT;
  };

  static truncateResponse = ({ content, limit }: { content: string; limit: number }) => {
    return content.substring(0, limit);
  };

  static transformResponse = ({ html, tokenLimit }: { html: string; tokenLimit?: number }) => {
    let markdown: string;
    try {
      markdown = NodeHtmlMarkdown.translate(html, {});
    } catch {
      markdown = html;
    }

    if (tokenLimit || this.isResponseOverLimit(markdown)) {
      const truncated = this.truncateResponse({
        content: markdown,
        limit: tokenLimit || this.LARGE_CONTENT_SYMBOL_COUNT,
      });

      return { markdown: truncated, isTruncated: true };
    }

    return { markdown, isTruncated: false };
  };

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
      'scrape_as_markdown',
      {
        description: 'Scrape the contents of a website and return Markdown-formatted results',
        inputSchema: {
          url: z.string().describe('URL to scrape'),
          geo: zodGeo,
          locale: zodLocale,
          jsRender: zodJsRender,
          tokenLimit: zodTokenLimit,
          fullResponse: zodFullResponse,
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async (scrapingParams: ScrapingMCPParams) => {
        const auth = getAuthToken();

        const { data } = await sapiClient.scrape({ auth, scrapingParams });

        const { markdown, isTruncated } = this.transformResponse({
          html: data,
          tokenLimit: scrapingParams.tokenLimit,
        });

        return {
          content: [
            {
              type: 'text',
              text: isTruncated
                ? `The website content is over ${this.LARGE_CONTENT_SYMBOL_COUNT} symbols, therefore, the content has been truncated. If you wish to obtain the full response, just say "full response". Alternatively, you say a specific token limit in the prompt.`
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
