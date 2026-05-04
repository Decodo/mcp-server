import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Resolved at runtime so `rootDir` can stay `./src` (no `import` of repo-root `package.json`). */
export const PACKAGE_VERSION = (
  JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }
).version;
