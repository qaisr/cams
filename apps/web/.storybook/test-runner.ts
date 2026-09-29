import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  tags: { skip: ['skip-a11y', 'skip-test'] },
};

export default config;
