import { NodeHtmlMarkdown } from 'node-html-markdown';
import { ScrapeAsMarkdownTool } from '../tools/scrape-as-markdown-tool';

jest.mock('node-html-markdown');

const mockedNHM = NodeHtmlMarkdown as jest.Mocked<typeof NodeHtmlMarkdown>;

describe('ScrapeAsMarkdownTool', () => {
  describe('transformResponse', () => {
    it('falls back to raw HTML when NodeHtmlMarkdown throws', () => {
      mockedNHM.translate.mockImplementation(() => {
        throw new Error('Malformed HTML');
      });

      const html = '<div><broken>content</div>';
      const result = ScrapeAsMarkdownTool.transformResponse({ html });

      expect(result.markdown).toBe(html);
      expect(result.isTruncated).toBe(false);
    });

    it('falls back to raw HTML and still truncates when over limit', () => {
      mockedNHM.translate.mockImplementation(() => {
        throw new Error('Malformed HTML');
      });

      const html = 'x'.repeat(ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT + 1000);
      const result = ScrapeAsMarkdownTool.transformResponse({ html });

      expect(result.markdown.length).toBe(
        html.substring(0, ScrapeAsMarkdownTool.LARGE_CONTENT_SYMBOL_COUNT).length
      );
      expect(result.isTruncated).toBe(true);
    });

    it('converts HTML to markdown on success', () => {
      mockedNHM.translate.mockReturnValue('# Hello');

      const result = ScrapeAsMarkdownTool.transformResponse({ html: '<h1>Hello</h1>' });

      expect(result.markdown).toBe('# Hello');
      expect(result.isTruncated).toBe(false);
    });

    it('truncates to custom tokenLimit', () => {
      const longMarkdown = 'a'.repeat(20_000);
      mockedNHM.translate.mockReturnValue(longMarkdown);

      const result = ScrapeAsMarkdownTool.transformResponse({
        html: '<p>long</p>',
        tokenLimit: 5000,
      });

      expect(result.markdown.length).toBe(5000);
      expect(result.isTruncated).toBe(true);
    });

    it('does not truncate when response is below limit', () => {
      const longMarkdown = 'a'.repeat(20_000);
      mockedNHM.translate.mockReturnValue(longMarkdown);

      const result = ScrapeAsMarkdownTool.transformResponse({
        html: '<p>long</p>',
      });

      expect(result.markdown.length).toBe(20_000);
      expect(result.isTruncated).toBe(false);
    });
  });
});
