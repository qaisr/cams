import { expect, within } from 'storybook/test';

import { PageHeader } from './PageHeader';
import { Button } from '../../ui/Button';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Layouts/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'App PageHeader — a thin wrapper over the Lumen `PageHeader` ' +
          'primitive. Renders the page title with an optional description, a ' +
          'right-side action button, and an above-heading back-navigation slot.',
      },
    },
  },
  args: {
    heading: 'Account settings',
    description: 'Manage your profile, security, and notification preferences.',
  },
  argTypes: {
    heading: { control: 'text' },
    element: {
      control: 'inline-radio',
      options: ['h1', 'h2', 'h3'],
    },
    showPagePadding: { control: 'boolean' },
    description: { control: false },
    button: { control: false },
    navigation: { control: false },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Default ──────────────────────────────────────────────────────────────────
export const Default: Story = {};

export const HeadingOnly: Story = {
  args: {
    heading: 'Dashboard',
    description: undefined,
  },
};

// ── Slots ────────────────────────────────────────────────────────────────────
export const WithAction: Story = {
  args: {
    button: <Button>Add account</Button>,
  },
};

export const WithNavigation: Story = {
  args: {
    heading: 'Edit profile',
    navigation: <a href="#back">← Back to account</a>,
  },
};

export const WithActionAndNavigation: Story = {
  args: {
    heading: 'Edit profile',
    navigation: <a href="#back">← Back to account</a>,
    button: <Button variant="secondary">Cancel</Button>,
  },
};

// ── Heading Level ──────────────────────────────────────────────────────────────
export const SubsectionHeading: Story = {
  args: {
    heading: 'Notification preferences',
    element: 'h2',
    description: undefined,
  },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
  },
};
