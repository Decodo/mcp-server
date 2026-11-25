import z from 'zod';

export const zodTokenLimit = z
  .number()
  .describe(
    `Maximum number of characters to return; longer content is truncated. Defaults to 45000.`
  )
  .optional();

export const zodLimit = ({ limitedItems, max }: { limitedItems: string; max: number }) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(10)
    .describe(`Maximum number of ${limitedItems}, 10 by default and at most ${max}`);
