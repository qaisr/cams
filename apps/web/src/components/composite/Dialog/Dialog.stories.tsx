import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Dialog } from './Dialog';
import { Button } from '../../ui/Button';

import type { DialogProps } from './Dialog.types';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * Story args omit `isOpen`/`onClose` because the `render` wrapper drives the
 * open/close state via a trigger button.
 */
type StoryArgs = Omit<DialogProps, 'isOpen' | 'onClose'>;

const meta: Meta<StoryArgs> = {
  title: 'Composite/Dialog',
  component: Dialog as unknown as React.ComponentType<StoryArgs>,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App Dialog — a controlled wrapper over the Lumen `Dialog` primitive. ' +
          'Appears in front of content for focused, decision-requiring tasks. ' +
          'Controlled via `isOpen` + `onClose`; `heading` is the accessible name.',
      },
    },
  },
  args: {
    heading: 'Confirm your details',
    variant: 'info',
    'aria-describedby': 'dialog-body',
  },
  argTypes: {
    heading: { control: 'text' },
    variant: {
      control: 'inline-radio',
      options: ['success', 'error', 'warning', 'info'],
    },
    privacyScreen: { control: 'boolean' },
    buttonAction: { control: false },
    buttonClose: { control: false },
    ref: { control: false },
  },
  // A trigger button opens the dialog; onClose closes it, mirroring real usage.
  render: (args) => {
    const ControlledDialog = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setIsOpen(true)}>Open dialog</Button>
          <Dialog
            {...args}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            buttonAction={{ text: 'Accept', onClick: () => setIsOpen(false) }}
            buttonClose={{ text: 'Cancel' }}
          >
            <p id="dialog-body">A dialog appears in front of content to prompt for a decision.</p>
          </Dialog>
        </>
      );
    };
    return <ControlledDialog />;
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

// ── Variants ───────────────────────────────────────────────────────────────
export const Info: Story = { args: { variant: 'info' } };
export const Success: Story = {
  args: { variant: 'success', heading: 'Application submitted' },
};
export const Warning: Story = {
  args: { variant: 'warning', heading: 'Unsaved changes' },
};
export const ErrorVariant: Story = {
  args: { variant: 'error', heading: 'Something went wrong' },
};

// ── Edge Cases ────────────────────────────────────────────────────────────────
export const NoIconVariant: Story = {
  args: { variant: undefined, heading: 'Plain dialog' },
};

// ── Interaction Tests ─────────────────────────────────────────────────────────
export const OpenAndClose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
    const dialog = await canvas.findByRole('dialog');
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAccessibleName('Confirm your details');
  },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
  },
};
