import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';

import { baseIgnorePatterns } from './oxc.ignore.ts';

// Style-only rules the pre-monorepo viz code (apps/visual) never followed.
// Correctness rules stay on; these are opinion, not defects.
const legacyStyleOff = Object.fromEntries(
  [
    'complexity',
    'curly',
    'default-case',
    'guard-for-in',
    'logical-assignment-operators',
    'no-bitwise',
    'no-empty-function',
    'no-inline-comments',
    'no-multi-assign',
    'no-nested-ternary',
    'no-param-reassign',
    'no-shadow',
    'no-unused-expressions',
    'no-use-before-define',
    'one-var',
    'prefer-exponentiation-operator',
    'prefer-named-capture-group',
    'prefer-rest-params',
    'prefer-template',
    'require-unicode-regexp',
    'sort-vars',
    'jsdoc/require-param-description',
    'jsdoc/require-property-description',
    'jsdoc/require-returns-description',
    'promise/avoid-new',
    'promise/param-names',
    'unicorn/catch-error-name',
    'unicorn/consistent-existence-index-check',
    'unicorn/consistent-function-scoping',
    'unicorn/import-style',
    'unicorn/no-array-for-each',
    'unicorn/no-await-expression-member',
    'unicorn/no-object-as-default-parameter',
    'unicorn/no-zero-fractions',
    'unicorn/numeric-separators-style',
    'unicorn/prefer-import-meta-properties',
    'unicorn/prefer-modern-dom-apis',
    'unicorn/prefer-number-coercion',
    'unicorn/prefer-number-properties',
    'unicorn/prefer-query-selector',
    'unicorn/prefer-single-call',
    'unicorn/prefer-string-replace-all',
    'unicorn/switch-case-braces',
    'unicorn/text-encoding-identifier-case',
  ].map((rule) => [rule, 'off'])
);

export default defineConfig({
  extends: [core],
  ignorePatterns: [...(core.ignorePatterns ?? []), ...baseIgnorePatterns],
  rules: {
    // Preferences that contradict the codebase's established style; no defect value.
    'sort-keys': 'off',
    'func-style': 'off',
    'no-plusplus': 'off',
    'prefer-destructuring': 'off',
    // Sequential paging / per-collection fetches are intentional.
    'no-await-in-loop': 'off',
    'unicorn/no-array-reduce': 'off',
    // Astro components are PascalCase by convention.
    'unicorn/filename-case': 'off',
    'import/consistent-type-specifier-style': 'off',
  },
  overrides: [
    {
      // Astro hoists <script> blocks into modules; top-level declarations are not globals.
      // The GA snippet must push `arguments` (gtag rejects arrays).
      files: ['**/*.astro'],
      rules: {
        'no-implicit-globals': 'off',
        'prefer-rest-params': 'off',
        'logical-assignment-operators': 'off',
      },
    },
    {
      files: ['**/apps/visual/**'],
      rules: legacyStyleOff,
    },
    {
      // CLI scripts report to the terminal.
      files: ['**/scripts/**'],
      rules: { 'no-console': 'off' },
    },
  ],
});
