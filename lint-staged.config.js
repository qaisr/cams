// lint-staged.config.js (root)
// Runs on staged files only — fast, surgical, no whole-repo scans
// Order within each glob matters: ESLint fix first, then Prettier write

export default {
  // TypeScript and TSX — ESLint fix, Prettier format, spell check, then type-check once
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write',
    'cspell --no-must-find-files --no-progress',
    () => 'pnpm turbo run type-check --affected',
  ],

  // JavaScript (config files, scripts)
  '*.{js,mjs,cjs}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write',
    'cspell --no-must-find-files --no-progress',
  ],

  // JSON — Prettier only (no ESLint for JSON)
  '*.{json,jsonc}': ['prettier --write'],

  // Markdown — format, then spell check
  '*.{md,mdx}': ['prettier --write', 'cspell --no-must-find-files --no-progress'],

  // YAML — Prettier then yamllint
  '*.{yaml,yml}': ['prettier --write', 'yamllint -c .yamllint'],

  // CSS
  '*.css': ['prettier --write'],

  // Shell scripts
  '*.sh': ['shfmt -w -i 2'],

  // Prisma schema — use Prisma's own formatter
  'prisma/schema.prisma': ['prisma format'],
};
