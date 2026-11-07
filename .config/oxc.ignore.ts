// Shared by oxlint and oxfmt. Patterns resolve relative to the config file,
// so they are anchored with `**/`.
export const baseIgnorePatterns = [
  '**/dist/**',
  '**/.astro/**',
  '**/.wrangler/**',
  '**/.agents/**',
  '**/.claude/**',
  '**/pnpm-lock.yaml',
  '**/skills-lock.json',
  // Studio primers are prose with intentionally loose markdown.
  '**/apps/visual/public/studio/learn/**',
];
