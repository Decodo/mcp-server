export const hiddenToolsFromEnv = (value: string | undefined): ReadonlySet<string> =>
  new Set(
    (value ?? '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  );
