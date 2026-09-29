import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { TextField } from './TextField';

import type { TextFieldChangeEvent, TextFieldProps } from './TextField.types';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * Story args omit `value`/`onChange` because the controlled `render` wrapper
 * supplies them — every story manages its own state internally.
 */
type StoryArgs = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value?: string;
};

const meta: Meta<StoryArgs> = {
  title: 'UI/Components/TextField',
  component: TextField as unknown as React.ComponentType<StoryArgs>,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App TextField — a controlled wrapper over the Lumen `TextField` primitive. ' +
          'Supports text/email/number/password/currency/search/textarea variants, ' +
          'label linking, helptext, and error messaging. Requires `value` + `onChange`.',
      },
    },
  },
  args: {
    id: 'demo-field',
    label: 'Full name',
    placeholder: 'Enter your name',
  },
  argTypes: {
    id: { control: 'text', description: 'Required — links the label to the input.' },
    label: { control: 'text', description: 'Visible label text.' },
    type: {
      control: 'select',
      options: ['text', 'email', 'number', 'tel', 'url', 'search', 'password', 'textarea'],
      description: 'Input type / variant.',
    },
    placeholder: { control: 'text' },
    helptext: { control: 'text', description: 'Guidance shown below the field.' },
    errorMessage: { control: 'text', description: 'Error text; sets aria-invalid.' },
    isDisabled: { control: 'boolean' },
    isOptional: { control: 'boolean', description: 'Shows an "optional" hint in the label.' },
    isClearable: { control: 'boolean' },
  },
  // Controlled render wrapper so all stories manage their own state. The Lumen
  // TextField prop type is a discriminated union (input variants vs. textarea);
  // the wrapper spread is cast to satisfy it after injecting value/onChange.
  render: (args) => {
    const ControlledField = () => {
      const [value, setValue] = useState(typeof args.value === 'string' ? args.value : '');
      const controlledProps = {
        ...args,
        value,
        onChange: (e: TextFieldChangeEvent) => setValue(e.target.value),
      } as TextFieldProps;
      return <TextField {...controlledProps} />;
    };
    return <ControlledField />;
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

// ── Variants ───────────────────────────────────────────────────────────────
export const Text: Story = { args: { type: 'text', label: 'Full name' } };
export const Email: Story = {
  args: { id: 'email-field', type: 'email', label: 'Email address' },
};
export const Password: Story = {
  args: {
    id: 'password-field',
    type: 'password',
    label: 'Password',
    autoComplete: 'current-password',
  },
};
export const Search: Story = {
  args: { id: 'search-field', type: 'search', label: 'Search' },
};
export const TextArea: Story = {
  args: { id: 'notes-field', type: 'textarea', label: 'Notes' },
};

// ── Sizes ────────────────────────────────────────────────────────────────────
// Lumen TextField has a single size; document that the wrapper adds no sizing.

// ── States ───────────────────────────────────────────────────────────────────
export const WithHelptext: Story = {
  args: { helptext: 'Use the name shown on your ID.' },
};
export const WithError: Story = {
  args: { errorMessage: 'This field is required.' },
};
export const Disabled: Story = {
  args: { isDisabled: true, label: 'Disabled field' },
};
export const Optional: Story = {
  args: { isOptional: true, label: 'Middle name' },
};

// ── Edge Cases ────────────────────────────────────────────────────────────────
export const LongLabel: Story = {
  args: {
    label: 'A very long field label that describes exactly what the user should enter here',
  },
};

// ── Responsive ────────────────────────────────────────────────────────────────
export const FullWidthContainer: Story = {
  parameters: { layout: 'padded' },
  args: { label: 'Address line 1' },
};

// ── Interaction Tests ─────────────────────────────────────────────────────────
export const TypingInteraction: Story = {
  args: { id: 'typed-field', label: 'Type here' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Type here');
    await userEvent.type(input, 'hello');
    await expect(input).toHaveValue('hello');
  },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  args: { id: 'a11y-field', label: 'Accessible field', helptext: 'Helpful hint.' },
  parameters: { a11y: { test: 'error' } },
};
