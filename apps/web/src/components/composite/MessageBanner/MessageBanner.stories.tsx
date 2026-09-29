import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { MessageBanner } from './MessageBanner';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Composite/MessageBanner',
  component: MessageBanner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App MessageBanner — a thin wrapper over the Lumen `MessageBanner` ' +
          'primitive. Surfaces a status or urgency message with an optional ' +
          'heading, description, action, and close control. `variant` sets the ' +
          'urgency style; control visibility with `isOpen` + `onClose`.',
      },
    },
  },
  args: {
    variant: 'info',
    heading: 'Verify your details',
    description: 'Check that the information below is correct before continuing.',
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['info', 'success', 'warning', 'critical'],
    },
    heading: { control: 'text' },
    caption: { control: 'text' },
    type: { control: 'inline-radio', options: ['global', 'contextual'] },
    description: { control: false },
    action: { control: false },
    onClose: { control: false },
    ref: { control: false },
  },
} satisfies Meta<typeof MessageBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Variants ───────────────────────────────────────────────────────────────
export const Info: Story = { args: { variant: 'info' } };
export const Success: Story = {
  args: { variant: 'success', heading: 'Application submitted' },
};
export const Warning: Story = {
  args: { variant: 'warning', heading: 'Action required soon' },
};
export const Critical: Story = {
  args: { variant: 'critical', heading: 'Something went wrong' },
};

// ── Content ──────────────────────────────────────────────────────────────────
export const WithCaption: Story = {
  args: {
    caption: 'Last updated 2 minutes ago',
  },
};

export const HeadingOnly: Story = {
  args: {
    heading: 'Saved',
    description: undefined,
  },
};

// ── Interaction Tests ─────────────────────────────────────────────────────────
export const Dismissible: Story = {
  render: (args) => {
    const Controlled = () => {
      const [isOpen, setIsOpen] = useState(true);
      return <MessageBanner {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />;
    };
    return <Controlled />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Verify your details')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(canvas.queryByText('Verify your details')).not.toBeInTheDocument();
  },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  parameters: { a11y: { test: 'error' } },
};
