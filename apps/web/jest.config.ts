import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jest-fixed-jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['', 'require', 'default'],
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.module\\.css$': 'identity-obj-proxy',
    // Lumen ships ESM-only subpath exports with no `require` condition, so jest
    // cannot resolve `@lumen/react/*`. Map each used primitive to a semantic
    // mock; real Lumen rendering + axe audits run via Storybook (test-runner).
    '^@lumen/react/(Button|TextField|Select|Dialog|MessageBanner|PageHeader|LumenProvider)$':
      '<rootDir>/src/test/lumen-mocks/$1.tsx',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@repo/shared-config$': '<rootDir>/../../packages/shared-config/src/index.ts',
    '^@repo/validation$': '<rootDir>/../../packages/validation/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/*.generated.*'],
};

export default config;
