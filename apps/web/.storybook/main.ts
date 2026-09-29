import type { StorybookConfig } from '@storybook/nextjs-vite';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],

  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@chromatic-com/storybook'),
  ],

  framework: {
    name: getAbsolutePath('@storybook/nextjs-vite'),
    options: {},
  },

  viteFinal: async (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': join(dirname(new URL(import.meta.url).pathname), '../src'),
    };
    return config;
  },

  staticDirs: ['../public'],

  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        prop.parent
          ? !prop.parent.fileName.includes('node_modules')
          : true,
    },
  },

  docs: {
    defaultName: 'Documentation',
  },
};

export default config;
