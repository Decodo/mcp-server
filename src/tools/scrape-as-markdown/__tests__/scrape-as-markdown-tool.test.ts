import { NodeHtmlMarkdown } from 'node-html-markdown';
import { ScrapeAsMarkdownTool } from '../scrape-as-markdown-tool';

jest.mock('node-html-markdown');

const mockedNHM = NodeHtmlMarkdown as jest.Mocked<typeof NodeHtmlMarkdown>;
const LARGE_CONTENT_SYMBOL_COUNT = 100_000;

describe('ScrapeAsMarkdownTool', () => {
  let tool: ScrapeAsMarkdownTool;

  beforeEach(() => {
    tool = new ScrapeAsMarkdownTool();
  });

  describe('transformResponse', () => {
    it('falls back to raw HTML when NodeHtmlMarkdown throws', () => {
      mockedNHM.translate.mockImplementation(() => {
        throw new Error('Malformed HTML');
      });

      const html = '<div><broken>content</div>';
      const { data, isTruncated } = tool.transformResponse({ data: html });

      expect(data).toBe(html);
      expect(isTruncated).toBe(false);
    });

    it('falls back to raw HTML and still truncates when over limit', () => {
      mockedNHM.translate.mockImplementation(() => {
        throw new Error('Malformed HTML');
      });

      const html = 'x'.repeat(LARGE_CONTENT_SYMBOL_COUNT + 1000);
      const { data, isTruncated } = tool.transformResponse({ data: html });

      expect(data.length).toBe(LARGE_CONTENT_SYMBOL_COUNT);
      expect(isTruncated).toBe(true);
    });

    it('converts HTML to markdown on success', () => {
      mockedNHM.translate.mockReturnValue('# Hello');

      const { data, isTruncated } = tool.transformResponse({ data: '<h1>Hello</h1>' });

      expect(data).toBe('# Hello');
      expect(isTruncated).toBe(false);
    });

    it('truncates to custom tokenLimit', () => {
      const longMarkdown = 'a'.repeat(20_000);
      mockedNHM.translate.mockReturnValue(longMarkdown);

      const { data, isTruncated } = tool.transformResponse({
        data: '<p>long</p>',
        tokenLimit: 5000,
      });

      expect(data.length).toBe(5000);
      expect(isTruncated).toBe(true);
    });

    it('does not truncate when response is below limit', () => {
      const longMarkdown = 'a'.repeat(20_000);
      mockedNHM.translate.mockReturnValue(longMarkdown);

      const { data, isTruncated } = tool.transformResponse({
        data: '<p>long</p>',
      });

      expect(data.length).toBe(20_000);
      expect(isTruncated).toBe(false);
    });
  });
});
