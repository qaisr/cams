import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: 'src/__tests__/.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 120_000,
  moduleNameMapper: {
    '^@repo/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@repo/database/generated/zod$': '<rootDir>/../../packages/database/generated/zod/index.ts',
    '^@repo/shared-config$': '<rootDir>/../../packages/shared-config/src/index.ts',
    '^@repo/validation$': '<rootDir>/../../packages/validation/src/index.ts',
  },
};

export default config;
