import z from 'zod';
import type { ZodRawShape, ZodTypeAny } from 'zod';
import type { buildToolInputSchema } from '@decodo/sdk-ts';

type JSONSchema4 = ReturnType<typeof buildToolInputSchema>;

const literalUnion = (values: unknown[]): ZodTypeAny => {
  if (values.every(value => typeof value === 'string')) {
    return z.enum(values as [string, ...string[]]);
  }

  const literals = values.map(value => z.literal(value as z.Primitive));

  return literals.length === 1
    ? literals[0]
    : z.union(literals as unknown as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
};

const patternOf = (pattern: string): RegExp | undefined => {
  for (const flags of ['u', '']) {
    try {
      return new RegExp(pattern, flags);
    } catch {
      continue;
    }
  }

  return undefined;
};

const stringOf = (schema: JSONSchema4): ZodTypeAny => {
  let result = z.string();

  if (typeof schema.minLength === 'number') {
    result = result.min(schema.minLength);
  }

  if (typeof schema.maxLength === 'number') {
    result = result.max(schema.maxLength);
  }

  const pattern = typeof schema.pattern === 'string' ? patternOf(schema.pattern) : undefined;

  if (pattern) {
    result = result.regex(pattern);
  }

  return result;
};

const numberOf = (schema: JSONSchema4): ZodTypeAny => {
  let result = schema.type === 'integer' ? z.number().int() : z.number();

  if (typeof schema.minimum === 'number') {
    result = result.min(schema.minimum);
  }

  if (typeof schema.maximum === 'number') {
    result = result.max(schema.maximum);
  }

  return result;
};

const baseOf = (schema: JSONSchema4): ZodTypeAny => {
  if (Array.isArray(schema.enum)) {
    return literalUnion(schema.enum);
  }

  if ('const' in schema) {
    return literalUnion([schema.const]);
  }

  const alternatives = (schema.anyOf ?? schema.oneOf) as JSONSchema4[] | undefined;

  if (alternatives?.length) {
    const converted = alternatives.map(jsonSchemaToZod);

    return converted.length === 1
      ? converted[0]
      : z.union(converted as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
  }

  switch (schema.type) {
    case 'string':
      return stringOf(schema);
    case 'integer':
    case 'number':
      return numberOf(schema);
    case 'boolean':
      return z.boolean();
    case 'array': {
      const items =
        schema.items && !Array.isArray(schema.items) ? jsonSchemaToZod(schema.items) : z.any();

      return z.array(items);
    }
    case 'object':
      return z.record(z.any());
    default:
      return z.any();
  }
};

export const jsonSchemaToZod = (schema: JSONSchema4): ZodTypeAny => {
  const base = baseOf(schema);

  return schema.description ? base.describe(schema.description) : base;
};

export const jsonSchemaToZodShape = (schema: JSONSchema4): ZodRawShape => {
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties = (schema.properties ?? {}) as Record<string, JSONSchema4>;

  return Object.fromEntries(
    Object.entries(properties).map(([name, property]) => {
      const field = jsonSchemaToZod(property);

      if (required.has(name)) {
        return [name, field];
      }

      return [
        name,
        property.default === undefined ? field.optional() : field.default(property.default),
      ];
    })
  );
};
