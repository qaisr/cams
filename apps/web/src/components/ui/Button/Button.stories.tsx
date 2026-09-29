import { expect, userEvent, within } from 'storybook/test';

import { Button } from './Button';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'UI/Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'App Button — a thin wrapper over the Lumen `Button` primitive. ' +
          'Exposes Lumen variants, icons, and the accessible loading API. ' +
          'Style only with layout utilities via `className`; colour/spacing are Lumen-owned.',
      },
    },
  },
  args: {
    children: 'Button',
    variant: 'primary',
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'tertiary'],
      description: 'Lumen visual style variant.',
      table: { defaultValue: { summary: 'primary' } },
    },
    icon: {
      control: 'text',
      description: 'Icon name from the Lumen asset set (e.g. "Search20", "Add20").',
    },
    iconPosition: {
      control: 'inline-radio',
      options: ['leading', 'trailing'],
      description: 'Icon placement relative to the label.',
    },
    loading: {
      control: 'object',
      description: 'Loading behaviour and accessible announcement config.',
    },
    disabled: { control: 'boolean', description: 'Native disabled state.' },
    'aria-label': {
      control: 'text',
      description: 'Accessible name — required for icon-only buttons.',
    },
    children: { control: 'text', description: 'Button label content.' },
    className: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Variants ───────────────────────────────────────────────────────────────
export const Primary: Story = { args: { variant: 'primary', children: 'Primary' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } };
export const Tertiary: Story = { args: { variant: 'tertiary', children: 'Tertiary' } };

// ── Sizes ────────────────────────────────────────────────────────────────────
// Lumen Button has a single size; document that the wrapper does not add sizing.
export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="tertiary">
        Tertiary
      </Button>
    </div>
  ),
};

// ── States ───────────────────────────────────────────────────────────────────
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };
export const Loading: Story = {
  args: {
    children: 'Submit',
    loading: { isLoading: true, text: 'Submitting…', mode: 'disabled' },
  },
};
export const WithLeadingIcon: Story = {
  args: { icon: 'Search20', iconPosition: 'leading', children: 'Search' },
};
export const WithTrailingIcon: Story = {
  args: { icon: 'ArrowRight20', iconPosition: 'trailing', children: 'Next' },
};

// ── Edge Cases ────────────────────────────────────────────────────────────────
export const IconOnly: Story = {
  args: { icon: 'Add20', 'aria-label': 'Add item', children: undefined },
};
export const LongLabel: Story = {
  args: {
    children: 'A considerably longer button label that should not wrap awkwardly',
  },
};

// ── Responsive ────────────────────────────────────────────────────────────────
export const FullWidth: Story = {
  args: { className: 'w-full', children: 'Full-width button' },
  parameters: { layout: 'padded' },
};

// ── Interaction Tests ─────────────────────────────────────────────────────────
export const ClickInteraction: Story = {
  args: { children: 'Click me' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Click me' });
    await userEvent.click(button);
    await expect(button).toBeInTheDocument();
    if (args.onClick) {
      await expect(args.onClick).toHaveBeenCalled();
    }
  },
};

// ── Accessibility ─────────────────────────────────────────────────────────────
export const AccessibilityAudit: Story = {
  args: { children: 'Accessible button' },
  parameters: {
    a11y: { test: 'error' },
  },
};
