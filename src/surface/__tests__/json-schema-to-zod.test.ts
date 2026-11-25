import { jsonSchemaToZod, jsonSchemaToZodShape } from '../json-schema-to-zod';
import z from 'zod';

describe('jsonSchemaToZod', () => {
  it('reads patterns as Unicode and skips a check JavaScript cannot compile', () => {
    const letters = jsonSchemaToZod({ type: 'string', pattern: '^\\p{L}+$' });
    const caseless = jsonSchemaToZod({ type: 'string', pattern: '(?i)^abc$' });

    expect(letters.safeParse('ąčę').success).toBe(true);
    expect(letters.safeParse('a1').success).toBe(false);
    expect(caseless.safeParse('anything').success).toBe(true);
  });

  it('maps enums, bounds and patterns', () => {
    const device = jsonSchemaToZod({ type: 'string', enum: ['desktop', 'mobile'] });
    const limit = jsonSchemaToZod({ type: 'integer', minimum: 1, maximum: 100 });
    const locale = jsonSchemaToZod({ type: 'string', pattern: '^[a-z]{2}-[a-z]{2}$' });

    expect(device.safeParse('mobile').success).toBe(true);
    expect(device.safeParse('tablet').success).toBe(false);
    expect(limit.safeParse(100).success).toBe(true);
    expect(limit.safeParse(101).success).toBe(false);
    expect(limit.safeParse(1.5).success).toBe(false);
    expect(locale.safeParse('en-us').success).toBe(true);
    expect(locale.safeParse('english').success).toBe(false);
  });

  it('maps a field that takes either a string or a list of strings', () => {
    const paths = jsonSchemaToZod({
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    });

    expect(paths.safeParse('^/blog').success).toBe(true);
    expect(paths.safeParse(['^/blog']).success).toBe(true);
    expect(paths.safeParse(3).success).toBe(false);
  });

  it('keeps descriptions', () => {
    expect(jsonSchemaToZod({ type: 'string', description: 'Search query' }).description).toBe(
      'Search query'
    );
  });
});

describe('jsonSchemaToZodShape', () => {
  it('makes fields optional unless required, and fills defaults', () => {
    const shape = jsonSchemaToZodShape({
      type: 'object',
      properties: {
        url: { type: 'string' },
        limit: { type: 'integer', default: 10 },
        geo: { type: 'string' },
      },
      required: ['url'],
    });
    const schema = z.object(shape);

    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.parse({ url: 'https://example.com' })).toEqual({
      url: 'https://example.com',
      limit: 10,
    });
  });
});
