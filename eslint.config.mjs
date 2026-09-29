// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import security from 'eslint-plugin-security';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-config-prettier'; // MUST be last — disables all formatting rules
import globals from 'globals';

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/generated/**', // Never lint generated code
      '**/coverage/**',
      '**/prisma/migrations/**',
      '**/*.d.ts',
      '.turbo/**',
      'cdk.out/**',
      'packages/*/src/**/*.js', // Compiled CJS outputs — co-located with TS sources for monorepo distribution
      'packages/*/src/**/*.js.map',
      '.claude/**', // Framework templates — not project source
    ],
  },

  eslint.configs.recommended,

  // ── JS/MJS/CJS config files — no tsconfig available, disable typed rules ──
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // ── TS config files not in any tsconfig — parse with TS parser, no typed rules ──
  {
    files: ['**/*.config.ts', '**/jest.config.ts', '**/prisma/seed.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: false },
      globals: { ...globals.node },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'no-console': 'off',
    },
  },

  // ── All TS files ──────────────────────────────────────────────────────────
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.config.ts', '**/jest.config.ts', '**/prisma/seed.ts'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.config.ts', '**/jest.config.ts', '**/prisma/seed.ts'],
    languageOptions: {
      parserOptions: {
        project: [
          'tsconfig.json',
          'apps/*/tsconfig.json',
          'apps/*/tsconfig.e2e.json',
          'packages/*/tsconfig.json',
          'packages/*/tsconfig.test.json',
          'infra/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin, security, unicorn },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            'tsconfig.json',
            'apps/*/tsconfig.json',
            'apps/*/tsconfig.e2e.json',
            'packages/*/tsconfig.json',
            'infra/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      // ── TypeScript quality ──────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ── Import order ────────────────────────────────────────────────────
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
          pathGroups: [
            { pattern: '@repo/**', group: 'internal', position: 'before' },
            { pattern: '@/**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',

      // ── Security ────────────────────────────────────────────────────────
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-possible-timing-attacks': 'warn',

      // ── General quality ─────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // ── Unicorn (selective) ─────────────────────────────────────────────
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-nested-ternary': 'error',

      // ── NOTE: Zero formatting rules here ────────────────────────────────
      // Prettier handles ALL formatting via eslint-config-prettier (last in chain)
    },
  },

  // ── NestJS (decorators need relaxed rules) ───────────────────────────────
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // ── AWS CDK infra (process.env + CDK method chaining triggers unsafe rules) ──
  {
    files: ['infra/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // ── NextJS / React ───────────────────────────────────────────────────────
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ── Test files ───────────────────────────────────────────────────────────
  {
    files: ['**/*.{spec,test}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'security/detect-object-injection': 'off',
    },
  },

  // ── Scripts + config files ───────────────────────────────────────────────
  {
    files: ['scripts/**/*.ts', '**/*.config.{ts,mjs}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-useless-assignment': 'off',
      'security/detect-object-injection': 'off',
    },
  },

  // ── MUST BE LAST — disables all ESLint formatting rules ──────────────────
  prettier,
);
