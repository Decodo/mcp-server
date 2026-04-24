import z from 'zod';
import {
  zodGeo,
  zodLocale,
  zodJsRender,
  zodTokenLimit,
  zodDeviceType,
  zodXhr,
  zodCountry,
} from '../../zod/zod-types';

describe('Zod schema validation', () => {
  describe('zodGeo', () => {
    it('accepts valid string', () => {
      expect(zodGeo.parse('United States')).toBe('United States');
    });

    it('accepts undefined (optional)', () => {
      expect(zodGeo.parse(undefined)).toBeUndefined();
    });

    it('rejects number', () => {
      expect(() => zodGeo.parse(123)).toThrow();
    });

    it('rejects boolean', () => {
      expect(() => zodGeo.parse(true)).toThrow();
    });

    it('rejects object', () => {
      expect(() => zodGeo.parse({ country: 'US' })).toThrow();
    });
  });

  describe('zodLocale', () => {
    it('accepts valid string', () => {
      expect(zodLocale.parse('en-US')).toBe('en-US');
    });

    it('accepts undefined (optional)', () => {
      expect(zodLocale.parse(undefined)).toBeUndefined();
    });

    it('rejects number', () => {
      expect(() => zodLocale.parse(42)).toThrow();
    });
  });

  describe('zodJsRender', () => {
    it('accepts true', () => {
      expect(zodJsRender.parse(true)).toBe(true);
    });

    it('accepts false', () => {
      expect(zodJsRender.parse(false)).toBe(false);
    });

    it('accepts undefined (optional)', () => {
      expect(zodJsRender.parse(undefined)).toBeUndefined();
    });

    it('rejects string "true"', () => {
      expect(() => zodJsRender.parse('true')).toThrow();
    });

    it('rejects number 1', () => {
      expect(() => zodJsRender.parse(1)).toThrow();
    });
  });

  describe('zodTokenLimit', () => {
    it('accepts positive number', () => {
      expect(zodTokenLimit.parse(5000)).toBe(5000);
    });

    it('accepts zero', () => {
      expect(zodTokenLimit.parse(0)).toBe(0);
    });

    it('accepts undefined (optional)', () => {
      expect(zodTokenLimit.parse(undefined)).toBeUndefined();
    });

    it('rejects string number', () => {
      expect(() => zodTokenLimit.parse('5000')).toThrow();
    });

    it('rejects NaN', () => {
      expect(() => zodTokenLimit.parse(NaN)).toThrow();
    });
  });

  describe('zodDeviceType', () => {
    it('accepts desktop', () => {
      expect(zodDeviceType.parse('desktop')).toBe('desktop');
    });

    it('accepts mobile', () => {
      expect(zodDeviceType.parse('mobile')).toBe('mobile');
    });

    it('accepts tablet', () => {
      expect(zodDeviceType.parse('tablet')).toBe('tablet');
    });

    it('accepts undefined (optional)', () => {
      expect(zodDeviceType.parse(undefined)).toBeUndefined();
    });

    it('rejects invalid device type', () => {
      expect(() => zodDeviceType.parse('phone')).toThrow();
    });

    it('rejects uppercase', () => {
      expect(() => zodDeviceType.parse('Desktop')).toThrow();
    });
  });

  describe('zodXhr', () => {
    it('accepts true', () => {
      expect(zodXhr.parse(true)).toBe(true);
    });

    it('accepts false', () => {
      expect(zodXhr.parse(false)).toBe(false);
    });

    it('accepts undefined (optional)', () => {
      expect(zodXhr.parse(undefined)).toBeUndefined();
    });

    it('rejects string', () => {
      expect(() => zodXhr.parse('yes')).toThrow();
    });
  });

  describe('zodCountry', () => {
    it('accepts valid country code', () => {
      expect(zodCountry.parse('US')).toBe('US');
    });

    it('accepts undefined (optional)', () => {
      expect(zodCountry.parse(undefined)).toBeUndefined();
    });

    it('rejects number', () => {
      expect(() => zodCountry.parse(1)).toThrow();
    });
  });

  describe('composite schema validation', () => {
    const scrapeSchema = z.object({
      url: z.string(),
      geo: zodGeo,
      locale: zodLocale,
      jsRender: zodJsRender,
      tokenLimit: zodTokenLimit,
    });

    it('accepts valid complete params', () => {
      const params = {
        url: 'https://example.com',
        geo: 'United States',
        locale: 'en-US',
        jsRender: true,
        tokenLimit: 10000,
      };

      expect(scrapeSchema.parse(params)).toEqual(params);
    });

    it('accepts params with only required fields', () => {
      const params = { url: 'https://example.com' };

      const result = scrapeSchema.parse(params);
      expect(result.url).toBe('https://example.com');
      expect(result.geo).toBeUndefined();
    });

    it('rejects missing required url field', () => {
      const params = { geo: 'US' };

      expect(() => scrapeSchema.parse(params)).toThrow();
    });

    it('rejects wrong type for url', () => {
      const params = { url: 123 };

      expect(() => scrapeSchema.parse(params)).toThrow();
    });

    it('rejects wrong type for optional field', () => {
      const params = {
        url: 'https://example.com',
        tokenLimit: 'five thousand',
      };

      expect(() => scrapeSchema.parse(params)).toThrow();
    });

    it('provides detailed error for multiple invalid fields', () => {
      const params = {
        url: 123,
        geo: true,
        jsRender: 'yes',
      };

      try {
        scrapeSchema.parse(params);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('search tool schema validation', () => {
    const searchSchema = z.object({
      query: z.string(),
      geo: zodGeo,
      locale: zodLocale,
      jsRender: zodJsRender,
    });

    it('accepts valid query', () => {
      const params = { query: 'test search' };
      expect(searchSchema.parse(params)).toEqual(params);
    });

    it('rejects missing query', () => {
      const params = { geo: 'US' };
      expect(() => searchSchema.parse(params)).toThrow();
    });

    it('rejects empty query string', () => {
      const emptySchema = z.object({
        query: z.string().min(1),
      });

      expect(() => emptySchema.parse({ query: '' })).toThrow();
    });

    it('rejects null query', () => {
      const params = { query: null };
      expect(() => searchSchema.parse(params)).toThrow();
    });
  });

  describe('product ID schema validation', () => {
    const productSchema = z.object({
      product_id: z.string(),
      geo: zodGeo,
    });

    it('accepts valid product_id', () => {
      const params = { product_id: 'B09H74FXNW' };
      expect(productSchema.parse(params).product_id).toBe('B09H74FXNW');
    });

    it('rejects missing product_id', () => {
      const params = {};
      expect(() => productSchema.parse(params)).toThrow();
    });

    it('rejects number product_id', () => {
      const params = { product_id: 12345 };
      expect(() => productSchema.parse(params)).toThrow();
    });
  });

  describe('URL schema validation', () => {
    const urlSchema = z.object({
      url: z.string().url(),
    });

    it('accepts valid URL', () => {
      expect(urlSchema.parse({ url: 'https://example.com' })).toEqual({
        url: 'https://example.com',
      });
    });

    it('accepts URL with path', () => {
      expect(urlSchema.parse({ url: 'https://example.com/path/to/page' })).toBeTruthy();
    });

    it('rejects invalid URL format', () => {
      expect(() => urlSchema.parse({ url: 'not-a-url' })).toThrow();
    });

    it('rejects URL without protocol', () => {
      expect(() => urlSchema.parse({ url: 'example.com' })).toThrow();
    });
  });

  describe('error message formatting', () => {
    it('provides path to invalid field', () => {
      const schema = z.object({
        nested: z.object({
          value: z.number(),
        }),
      });

      try {
        schema.parse({ nested: { value: 'not a number' } });
        fail('Should have thrown');
      } catch (error) {
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].path).toEqual(['nested', 'value']);
      }
    });

    it('provides expected vs received info', () => {
      const schema = z.object({ count: z.number() });

      try {
        schema.parse({ count: 'five' });
        fail('Should have thrown');
      } catch (error) {
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('Expected number');
      }
    });
  });
});
