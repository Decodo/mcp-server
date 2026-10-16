import z from 'zod';

export const zodGeo = z
  .string()
  .describe('Geolocation of the desired request, expressed as a country name')
  .optional();

export const zodLocale = z.string().describe('Locale of the desired request').optional();

export const zodJsRender = z
  .boolean()
  .describe('Should the request be opened in a headless browser, false by default')
  .optional();

export const zodXhr = z
  .boolean()
  .describe(
    'When true, includes XHR/fetch responses in the scrape result where supported by the target'
  )
  .optional();

export const zodTokenLimit = z
  .number()
  .describe(
    `Maximum number of characters to return; longer content is truncated. Defaults to 45000.`
  )
  .optional();

export const zodCountry = z
  .string()
  .describe('Country code for the request (e.g., US, GB, DE)')
  .optional();

export const zodDeviceType = z
  .enum(['desktop', 'mobile', 'tablet'])
  .describe('Device type to emulate for the request')
  .optional();

export const zodLimit = ({ limitedItems, max }: { limitedItems: string; max: number }) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(10)
    .describe(`Maximum number of ${limitedItems}, 10 by default and at most ${max}`);

export const zodSitemap = z
  .enum(['include', 'only', 'skip'])
  .describe(
    'Whether to use the sitemap alongside links found on pages, only the sitemap, or skip it'
  )
  .optional();

export const zodDomainFilter = z
  .enum(['domain', 'subdomain', 'all'])
  .describe('Which links to follow: the same domain, its subdomains too, or any domain')
  .optional();

export const zodSelectPaths = z
  .array(z.string())
  .describe('Only keep URLs whose path matches one of these patterns, e.g. /blog/*')
  .optional();

export const zodExcludePaths = z
  .array(z.string())
  .describe('Drop URLs whose path matches one of these patterns')
  .optional();
