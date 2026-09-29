import { LumenProvider } from '@lumen/react/LumenProvider';

import type { Preview } from '@storybook/react';

import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
      sort: 'requiredFirst',
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/' },
    },
    layout: 'centered',
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: '#F4F4F2' },
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark', value: '#161616' },
      ],
    },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'label', enabled: true },
          { id: 'aria-required-attr', enabled: true },
          { id: 'aria-valid-attr-value', enabled: true },
          { id: 'focus-visible', enabled: true },
        ],
      },
    },
  },

  decorators: [
    (Story) => (
      <LumenProvider as="div">
        <div className="font-sans">
          <Story />
        </div>
      </LumenProvider>
    ),
  ],

  globalTypes: {
    theme: {
      description: 'Global theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },

  tags: ['autodocs'],
};

export default preview;
