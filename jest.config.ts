// Root jest config — shared settings for all workspaces
// Each app overrides what it needs in its own jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  // Coverage thresholds — enforced in CI
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Reporters — lcov for SonarQube, junit for SonarQube test results
  coverageReporters: [
    'lcov', // → coverage/lcov.info (SonarQube)
    'text', // → terminal output
    'text-summary',
    'html', // → coverage/index.html (human review)
  ],

  // JUnit XML for SonarQube test execution report
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        suiteNameTemplate: '{filepath}',
      },
    ],
  ],
};

export default config;
