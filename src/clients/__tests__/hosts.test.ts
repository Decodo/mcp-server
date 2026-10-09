import { scrapingApiHostsFromEnv } from '../hosts';

describe('scrapingApiHostsFromEnv', () => {
  it('reads both hosts from env', () => {
    expect(
      scrapingApiHostsFromEnv({
        DECODO_SAPI_HOST: 'https://stage-scraper-api.decodo.com',
        DECODO_DATA_API_HOST: 'https://stage-scraper-platform-api.cyberbutis.io',
      })
    ).toEqual({
      scraperApi: 'https://stage-scraper-api.decodo.com',
      dataApi: 'https://stage-scraper-platform-api.cyberbutis.io',
    });
  });

  it('leaves unset or blank hosts undefined so the SDK defaults apply', () => {
    expect(scrapingApiHostsFromEnv({ DECODO_SAPI_HOST: '  ' })).toEqual({ scraperApi: undefined, dataApi: undefined });
  });
});
