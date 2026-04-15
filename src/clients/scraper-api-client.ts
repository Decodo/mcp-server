import axios, { AxiosResponse } from 'axios';
import { ScraperApiResponseData } from './types';
import { ScraperAPIParams, ScrapingMCPParams } from 'types';

export class ScraperApiClient {
  transformScrapingParams = ({
    scrapingParams,
  }: {
    scrapingParams: ScrapingMCPParams;
  }): ScraperAPIParams => {
    const { jsRender, headless, ...rest } = scrapingParams;
    const transformed = {
      ...(headless ? { headless } : jsRender && { headless: 'html' }),
      ...rest,
    };

    return transformed;
  };

  transformResponse = <T>({ res }: { res: AxiosResponse<ScraperApiResponseData<T>> }) => {
    const content = res.data.results[0].content;

    return { ...res, data: content };
  };

  scrape = async <T = string>({
    auth,
    scrapingParams,
  }: {
    auth: string;
    scrapingParams: ScrapingMCPParams;
  }) => {
    const transformedParams = this.transformScrapingParams({ scrapingParams });

    const url = process.env.DECODO_SAPI_HOST || 'https://scraper-api.decodo.com';

    try {
      const res = await axios.request<ScraperApiResponseData<T>>({
        url: `${url}/v2/scrape`,
        method: 'POST',
        headers: {
          authorization: `Basic ${auth}`,
          'x-integration': 'mcp',
        },
        timeout: 180000,
        data: {
          ...transformedParams,
        },
      });

      const response = this.transformResponse({ res });

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        let errorMessage = error.response?.data?.message ?? error.message;

        if (error.response?.status === 401) {
          errorMessage = 'Authentication failed.';
        }
        if (error.response?.status === 429) {
          errorMessage = 'Rate limit exceeded, please wait before sending another request.';
        }

        throw new Error(`Scraper API request failed (${status}): ${errorMessage}`);
      }
      throw error;
    }
  };
}
