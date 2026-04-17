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

export const zodTokenLimit = z
  .number()
  .describe(
    `The number of tokens to return in the response - anything above this limit will be truncated`
  )
  .optional();
