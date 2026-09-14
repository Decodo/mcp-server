import { Target } from '@decodo/sdk-ts';
import { ScraperApiClient } from '../scraper-api-client';
import { ScrapingMCPParams } from '../../types';

const client = new ScraperApiClient({ maxRetries: 1, delayMs: 0 });

const auth = 'dGVzdDp0ZXN0';
const defaultArgs = { auth, scrapingParams: { url: 'https://example.com' } };

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = ({ status = 200, body }: { status?: number; body: unknown }) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const scrapeResponse = (content: unknown) =>
  jsonResponse({ body: { results: [{ content, status_code: 200, task_id: 'abc' }] } });

const networkError = (code: string) =>
  Object.assign(new TypeError('fetch failed'), { cause: { code } });

const respondWith = (make: () => Response) =>
  mockFetch.mockImplementation(() => Promise.resolve(make()));

const respondOnceWith = (make: () => Response) =>
  mockFetch.mockImplementationOnce(() => Promise.resolve(make()));

const lastRequest = () => {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return { url: url as string, init: init as RequestInit };
};

const requestBody = () => JSON.parse(lastRequest().init.body as string);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('ScraperApiClient', () => {
  describe('scrape - request', () => {
    beforeEach(() => {
      respondWith(() => scrapeResponse('<html></html>'));
    });

    it('posts to the SDK scrape route with Basic auth and the mcp integration header', async () => {
      await client.scrape(defaultArgs);

      const { url, init } = lastRequest();

      expect(url).toBe('https://scraper-api.decodo.com/v2/scrape');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${auth}`,
        'x-integration': 'mcp',
      });
    });

    it('returns the first result content', async () => {
      respondWith(() => scrapeResponse({ title: 'Example' }));

      const { data } = await client.scrape<{ title: string }>(defaultArgs);

      expect(data).toEqual({ title: 'Example' });
    });

    it('defaults to the universal target when a tool sends none', async () => {
      await client.scrape(defaultArgs);

      expect(requestBody()).toEqual({ target: Target.Universal, url: 'https://example.com' });
    });

    it('keeps an explicit target', async () => {
      await client.scrape({
        auth,
        scrapingParams: { target: Target.GoogleSearch, query: 'mcp' },
      });

      expect(requestBody()).toMatchObject({ target: Target.GoogleSearch, query: 'mcp' });
    });
  });

  describe('transformScrapingParams', () => {
    it('maps jsRender to headless html', () => {
      expect(client.transformScrapingParams({ scrapingParams: { jsRender: true } })).toMatchObject({
        headless: 'html',
      });
    });

    it('leaves an explicit headless value untouched', () => {
      expect(
        client.transformScrapingParams({ scrapingParams: { jsRender: true, headless: 'png' } })
      ).toMatchObject({ headless: 'png' });
    });

    it('omits headless when jsRender is false', () => {
      expect(
        client.transformScrapingParams({ scrapingParams: { jsRender: false } })
      ).not.toHaveProperty('headless');
    });

    it('renames camelCase params to their API equivalents', () => {
      const params = client.transformScrapingParams({
        scrapingParams: {
          deviceType: 'mobile',
          pageFrom: 2,
          deliveryZip: '10001',
        } as ScrapingMCPParams,
      });

      expect(params).toMatchObject({
        device_type: 'mobile',
        page_from: 2,
        delivery_zip: '10001',
      });
      expect(params).not.toHaveProperty('deviceType');
      expect(params).not.toHaveProperty('pageFrom');
      expect(params).not.toHaveProperty('deliveryZip');
    });

    it('drops MCP-only params the API would reject', () => {
      expect(
        client.transformScrapingParams({ scrapingParams: { url: 'https://a.com', tokenLimit: 10 } })
      ).not.toHaveProperty('tokenLimit');
    });
  });

  describe('scrape - error handling', () => {
    it('throws a friendly message on 401', async () => {
      respondWith(() => jsonResponse({ status: 401, body: { message: 'Unauthorized' } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (401): Authentication failed.'
      );
    });

    it('surfaces the server message on 429', async () => {
      respondWith(() => jsonResponse({ status: 429, body: { message: 'Rate limit exceeded' } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow('Rate limit exceeded');
    });

    it('surfaces the server message on 502', async () => {
      respondWith(() => jsonResponse({ status: 502, body: { message: 'Upstream server error' } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (502): Upstream server error'
      );
    });

    it('falls back to the status when the server provides no message', async () => {
      respondWith(() => new Response('not json', { status: 500 }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed (500): HTTP 500'
      );
    });

    it('reports the syscall code on network failure', async () => {
      mockFetch.mockRejectedValue(networkError('ECONNRESET'));

      await expect(client.scrape(defaultArgs)).rejects.toThrow(
        'Scraper API request failed: network error ECONNRESET'
      );
    });

    it('rejects params the target does not accept before sending a request', async () => {
      await expect(
        client.scrape({
          auth,
          scrapingParams: { target: Target.GoogleSearch, query: 'mcp', nope: true } as never,
        })
      ).rejects.toThrow('Scraper API request failed (422):');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws when the API returns no results', async () => {
      respondWith(() => jsonResponse({ body: { results: [] } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow('Scraper API returned no results.');
    });

    it('re-throws unexpected errors as-is', async () => {
      const error = new RangeError('unexpected failure');
      mockFetch.mockRejectedValue(error);

      await expect(client.scrape(defaultArgs)).rejects.toThrow(error);
    });
  });

  describe('scrape - retries', () => {
    it('retries a retryable status and returns the eventual success', async () => {
      respondOnceWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));
      respondOnceWith(() => scrapeResponse('ok'));

      const { data } = await client.scrape(defaultArgs);

      expect(data).toBe('ok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries a retryable network error', async () => {
      mockFetch.mockRejectedValueOnce(networkError('ETIMEDOUT'));
      respondOnceWith(() => scrapeResponse('ok'));

      await expect(client.scrape(defaultArgs)).resolves.toMatchObject({ data: 'ok' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('stops after maxRetries', async () => {
      respondWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow('Unavailable');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-retryable status', async () => {
      respondWith(() => jsonResponse({ status: 401, body: { message: 'Unauthorized' } }));

      await expect(client.scrape(defaultArgs)).rejects.toThrow('(401)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry an unexpected error', async () => {
      mockFetch.mockRejectedValue(new RangeError('boom'));

      await expect(client.scrape(defaultArgs)).rejects.toThrow('boom');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
