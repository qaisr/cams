import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Select } from './Select';

import type { SelectOption } from './Select.types';
import type { Meta, StoryObj } from '@storybook/react';

const OPTIONS: SelectOption[] = [
  { label: 'Savings account', value: 'savings' },
  { label: 'Transaction account', value: 'transaction' },
  { label: 'Term deposit (unavailable)', value: 'term', disabled: true },
];

const meta = {
  title: 'UI/Components/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App Select — a controlled wrapper over the Lumen `Select` primitive. ' +
          'Presents a single-choice list from an `options` array. Requires ' +
          '`value` + `onChange(value)`.',
      },
    },
  },
  args: {
    label: 'Account type',
    placeholder: 'Choose an account',
    options: OPTIONS,
    value: '',
  },
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    helptext: { control: 'text' },
    errorMessage: { control: 'text' },
    disabled: { control: 'boolean' },
    isOptional: { control: 'boolean' },
    options: { control: false },
    value: { control: false },
    onChange: { control: false },
  },
  // Controlled render wrapper so each story manages its own selection state.
  render: (args) => {
    const ControlledSelect = () => {
      const [value, setValue] = useState(args.value ?? '');
      return <Select {...args} value={value} onChange={setValue} />;
    };
    return <ControlledSelect />;
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Variants ───────────────────────────────────────────────────────────────
export const Default: Story = {};

export const WithHelptext: Story = {
  args: { helptext: 'Select the account this applies to.' },
};

// ── States ───────────────────────────────────────────────────────────────────
export const Disabled: Story = {
  args: { disabled: true },
};

export const WithError: Story = {
  args: { errorMessage: 'Please choose an account.' },
};

export const Optional: Story = {
  args: { isOptional: true },
};

// ── Edge Cases ────────────────────────────────────────────────────────────────
export const PreSelected: Story = {
  args: { value: 'transaction' },
};

export const WithDisabledOption: Story = {
  args: { helptext: 'The term deposit option is currently unavailable.' },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  args: { helptext: 'Fully labelled, keyboard-accessible select.' },
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The label is associated with the control, so it is reachable by name.
    const control = canvas.getByLabelText('Account type');
    await expect(control).toBeInTheDocument();
    await userEvent.click(control);
  },
};
