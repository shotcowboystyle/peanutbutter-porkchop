import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

import { baseIgnorePatterns } from './oxc.ignore.ts';

export default defineConfig({
  ...ultracite,
  astro: true,
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), ...baseIgnorePatterns],
  printWidth: 100,
  semi: true,
  singleQuote: true,
});
