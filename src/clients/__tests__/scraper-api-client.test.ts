import { BundledSchema } from '@decodo/sdk-ts';
import type { IrSurfaceTool } from '@decodo/sdk-ts';
import { AUTH_TYPE } from '../../auth';
import type { AuthCredential } from '../../auth';
import { API_KEY_REQUIRED_MESSAGE, ScraperApiClient } from '../scraper-api-client';

const client = new ScraperApiClient({ maxRetries: 1, delayMs: 0 });

const tokenValue = 'dGVzdDp0ZXN0';
const apiKeyValue = 'sk-test-api-key';

const auth: AuthCredential = { type: AUTH_TYPE.TOKEN, value: tokenValue };
const apiKeyAuth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: apiKeyValue };

const tool = (name: string): IrSurfaceTool => {
  const found = BundledSchema.shared.getSurface('mcp')?.tools.find(t => t.name === name);

  if (!found) {
    throw new Error(`no ${name} tool in the bundled IR`);
  }

  return found;
};

const scrape = (credential = auth, sapiClient = client) =>
  sapiClient.runSurfaceTool({
    auth: credential,
    tool: tool('scrape_as_markdown'),
    args: { url: 'https://example.com' },
  });

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = ({ status = 200, body }: { status?: number; body: unknown }) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const scrapeResponse = (content: unknown, statusCode = 200) =>
  jsonResponse({ body: { results: [{ content, status_code: statusCode, task_id: 'abc' }] } });

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

describe('ScraperApiClient.runSurfaceTool', () => {
  describe('scrape tools - request', () => {
    beforeEach(() => {
      respondWith(() => scrapeResponse('<html></html>'));
    });

    it('posts to the scraper API with Basic auth and the mcp integration header', async () => {
      await scrape();

      const { url, init } = lastRequest();

      expect(url).toBe('https://scraper-api.decodo.com/v2/scrape');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${tokenValue}`,
        'x-integration': 'mcp',
      });
    });

    it('sends a custom integration header when configured', async () => {
      await scrape(auth, new ScraperApiClient({ integrationHeader: 'mcp-hosted' }));

      expect(lastRequest().init.headers).toMatchObject({ 'x-integration': 'mcp-hosted' });
    });

    it('posts to the data API with Bearer auth when given an API key', async () => {
      await scrape(apiKeyAuth);

      const { url, init } = lastRequest();

      expect(url).toBe('https://data.decodo.com/v1/scrape');
      expect(init.headers).toMatchObject({
        Authorization: `Bearer ${apiKeyValue}`,
        'x-integration': 'mcp',
      });
    });

    it("sends the same body on both transports, with the tool's fixed values", async () => {
      await scrape();
      const tokenBody = requestBody();

      await scrape(apiKeyAuth);
      const apiKeyBody = requestBody();

      expect(tokenBody).toEqual({ target: 'universal', url: 'https://example.com' });
      expect(apiKeyBody).toEqual(tokenBody);
    });

    it('returns the first result content on both transports', async () => {
      respondWith(() => scrapeResponse({ title: 'Example' }));

      await expect(scrape()).resolves.toEqual({ title: 'Example' });
      await expect(scrape(apiKeyAuth)).resolves.toEqual({ title: 'Example' });
    });
  });

  describe('scrape tools - hosts', () => {
    beforeEach(() => {
      respondWith(() => scrapeResponse('<html></html>'));
    });

    it('sends api keys to the configured data API host', async () => {
      await scrape(
        apiKeyAuth,
        new ScraperApiClient({ hosts: { dataApi: 'https://stage-data.example' } })
      );

      expect(lastRequest().url).toBe('https://stage-data.example/v1/scrape');
    });

    it('sends basic tokens to the configured scraper API host', async () => {
      await scrape(
        auth,
        new ScraperApiClient({ hosts: { scraperApi: 'https://stage-scraper-api.example' } })
      );

      expect(lastRequest().url).toBe('https://stage-scraper-api.example/v2/scrape');
    });
  });

  describe('errors', () => {
    it('throws a friendly message on 401', async () => {
      respondWith(() => jsonResponse({ status: 401, body: { message: 'Unauthorized' } }));

      await expect(scrape()).rejects.toThrow(
        'Scraper API request failed (401): Authentication failed.'
      );
    });

    it('reports the rejected credential on 401 and only then', async () => {
      const onAuthenticationError = jest.fn();
      const reporting = new ScraperApiClient({ maxRetries: 0, onAuthenticationError });

      respondOnceWith(() => jsonResponse({ status: 401, body: { message: 'Unauthorized' } }));
      await expect(scrape(auth, reporting)).rejects.toThrow('(401)');
      expect(onAuthenticationError).toHaveBeenCalledWith(auth);

      respondOnceWith(() => jsonResponse({ status: 502, body: { message: 'Bad gateway' } }));
      await expect(scrape(auth, reporting)).rejects.toThrow('(502)');
      expect(onAuthenticationError).toHaveBeenCalledTimes(1);
    });

    it('surfaces the server message on 502', async () => {
      respondWith(() => jsonResponse({ status: 502, body: { message: 'Upstream server error' } }));

      await expect(scrape()).rejects.toThrow(
        'Scraper API request failed (502): Upstream server error'
      );
    });

    it('falls back to the status when the server provides no message', async () => {
      respondWith(() => new Response('not json', { status: 500 }));

      await expect(scrape()).rejects.toThrow('Scraper API request failed (500): HTTP 500');
    });

    it('reports the syscall code on network failure', async () => {
      mockFetch.mockRejectedValue(networkError('ECONNRESET'));

      await expect(scrape()).rejects.toThrow(
        'Scraper API request failed: network error ECONNRESET'
      );
    });

    it.each([
      ['a basic token', auth],
      ['an API key', apiKeyAuth],
    ])("applies the IR's failure rules with %s", async (_name, credential) => {
      respondWith(() => scrapeResponse('<h1>Not found</h1>', 404));

      await expect(scrape(credential)).rejects.toThrow(
        'Scraper API request failed (404): The target site answered with HTTP 404'
      );
    });

    it('surfaces the API message when a scrape fails inside a 200 response', async () => {
      respondWith(() =>
        jsonResponse({
          body: {
            status: 'failed',
            status_code: 613,
            message: 'We were not able to scrape the target.',
          },
        })
      );

      await expect(scrape()).rejects.toThrow(
        'Scraper API request failed (613): We were not able to scrape the target.'
      );
    });

    it('re-throws unexpected errors as-is', async () => {
      const error = new RangeError('unexpected failure');
      mockFetch.mockRejectedValue(error);

      await expect(scrape()).rejects.toThrow(error);
    });
  });

  describe('retries', () => {
    it('retries a retryable status and returns the eventual success', async () => {
      respondOnceWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));
      respondOnceWith(() => scrapeResponse('ok'));

      await expect(scrape()).resolves.toBe('ok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries a retryable network error', async () => {
      mockFetch.mockRejectedValueOnce(networkError('ETIMEDOUT'));
      respondOnceWith(() => scrapeResponse('ok'));

      await expect(scrape()).resolves.toBe('ok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('stops after maxRetries', async () => {
      respondWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));

      await expect(scrape()).rejects.toThrow('Unavailable');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-retryable status', async () => {
      respondWith(() => jsonResponse({ status: 401, body: { message: 'Unauthorized' } }));

      await expect(scrape()).rejects.toThrow('(401)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry an unexpected error', async () => {
      mockFetch.mockRejectedValue(new RangeError('boom'));

      await expect(scrape()).rejects.toThrow('boom');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it.each([613, 400])(
      'does not retry an API failure reported in a 200 response (%i)',
      async statusCode => {
        respondWith(() =>
          jsonResponse({ body: { status: 'failed', status_code: statusCode, message: 'Failed.' } })
        );

        await expect(scrape(apiKeyAuth)).rejects.toThrow(`(${statusCode}): Failed.`);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    );

    it('does not retry when the target site itself returns an error status', async () => {
      respondWith(() => scrapeResponse('<h1>Unavailable</h1>', 503));

      await expect(scrape(apiKeyAuth)).rejects.toThrow('(503)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('data API tools', () => {
    const crawlStatus = { crawl_id: 'crawl-1', status: 'pending', completed: 3 };

    it('posts search params to the data API search route', async () => {
      respondWith(() => jsonResponse({ body: { organic: [] } }));

      await client.runSurfaceTool({
        auth: apiKeyAuth,
        tool: tool('search'),
        args: { query: 'mcp' },
      });

      expect(lastRequest().url).toBe('https://data.decodo.com/v1/search');
      expect(requestBody()).toEqual({ query: 'mcp' });
    });

    it('returns the crawl status for a crawl id', async () => {
      respondWith(() => jsonResponse({ body: crawlStatus }));

      await expect(
        client.runSurfaceTool({
          auth: apiKeyAuth,
          tool: tool('crawl_status'),
          args: { crawl_id: 'crawl-1' },
        })
      ).resolves.toEqual(crawlStatus);
      expect(lastRequest().url).toBe('https://data.decodo.com/v1/crawl/crawl-1/status');
    });

    it('retries a retryable status on read calls', async () => {
      respondOnceWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));
      respondOnceWith(() => jsonResponse({ body: crawlStatus }));

      await client.runSurfaceTool({
        auth: apiKeyAuth,
        tool: tool('crawl_status'),
        args: { crawl_id: 'crawl-1' },
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('tells basic token users to switch to an API key without calling the API', async () => {
      await expect(
        client.runSurfaceTool({ auth, tool: tool('search'), args: { query: 'mcp' } })
      ).rejects.toThrow(API_KEY_REQUIRED_MESSAGE);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not retry starting a crawl, so a slow success cannot start two', async () => {
      respondWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));

      await expect(
        client.runSurfaceTool({
          auth: apiKeyAuth,
          tool: tool('crawl_start'),
          args: { url: 'https://a.com' },
        })
      ).rejects.toThrow('(503)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry starting a batch, which would queue and bill it twice', async () => {
      respondWith(() => jsonResponse({ status: 503, body: { message: 'Unavailable' } }));

      await expect(
        client.runSurfaceTool({
          auth: apiKeyAuth,
          tool: { name: 'batch', description: '', flow: 'task_batch' },
          args: { url: ['https://a.com', 'https://b.com'], target: 'universal' },
        })
      ).rejects.toThrow('(503)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('lists one page of crawl content from the given cursor', async () => {
      respondWith(() =>
        jsonResponse({
          body: {
            crawl_id: 'crawl-1',
            url: [{ url: 'https://a.com', status: 'done' }],
            next: 'https://data.decodo.com/v1/crawl/crawl-1?type=content&cursor=def',
          },
        })
      );

      const list = await client.listCrawlPages({
        auth: apiKeyAuth,
        crawlId: 'crawl-1',
        cursor: 'abc',
      });

      const url = new URL(lastRequest().url);
      expect(url.pathname).toBe('/v1/crawl/crawl-1');
      expect(url.searchParams.get('cursor')).toBe('abc');
      expect(url.searchParams.get('type')).toBe('content');
      expect(list.next).toBe('def');
    });
  });

  describe('logging', () => {
    it('logs the target and the status the scraped site returned', async () => {
      const write = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
      respondWith(() => scrapeResponse({ organic: [] }));

      await client.runSurfaceTool({
        auth: apiKeyAuth,
        tool: tool('google_search'),
        args: { query: 'coffee' },
      });

      const entry = JSON.parse(String(write.mock.calls.at(-1)?.[0]));
      write.mockRestore();

      expect(entry).toMatchObject({
        event: 'tool_call',
        outcome: 'success',
        target: 'google_search',
        upstream_status: 200,
      });
    });
  });
});
