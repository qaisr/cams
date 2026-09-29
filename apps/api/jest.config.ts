import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/__tests__/'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@repo/database$': '<rootDir>/../../../packages/database/src/index.ts',
    '^@repo/database/generated/zod$': '<rootDir>/../../../packages/database/generated/zod/index.ts',
    '^@repo/shared-config$': '<rootDir>/../../../packages/shared-config/src/index.ts',
    '^@repo/validation$': '<rootDir>/../../../packages/validation/src/index.ts',
  },
};

export default config;
