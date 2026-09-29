/**
 * Storybook Story Template
 *
 * Usage: Copy for each component, replace COMPONENT_NAME
 * Standards: .claude/standards/storybook-standards.md
 * Includes: a11y, interactions, responsive variants, loading/error states
 */
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { COMPONENT_NAME } from './COMPONENT_NAME';

const meta = {
  title: 'Feature/COMPONENT_NAME', // Use: 'UI/Atoms', 'UI/Molecules', 'Feature/Documents'
  component: COMPONENT_NAME,
  parameters: {
    layout: 'centered', // or 'fullscreen' for pages
    // Document design decisions and usage guidelines
    docs: {
      description: {
        component: `
**COMPONENT_NAME** — Brief description of what it does.

### When to use
- Use case 1
- Use case 2

### Accessibility
- Keyboard navigable: Yes
- Screen reader: Announces \`aria-label\`
        `,
      },
    },
    // a11y parameters — runs axe-core automatically
    a11y: {
      config: {
        rules: [
          // Override specific rules if justified (document why)
          // { id: 'color-contrast', enabled: false }, // ← only if intentional
        ],
      },
    },
  },
  // Shared args (applied to all stories)
  args: {
    // Default props
  },
  argTypes: {
    // Document all props
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger'],
      description: 'Visual variant of the component',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'primary' },
      },
    },
    onClick: { action: 'clicked' },
    onSubmit: { action: 'submitted' },
  },
  // Apply decorators (providers, wrappers)
  decorators: [
    (Story) => (
      <div style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof COMPONENT_NAME>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Base States ──────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    label: 'Default COMPONENT_NAME',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    label: 'Loading state',
  },
};

export const Error: Story = {
  args: {
    error: 'Something went wrong. Please try again.',
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

// ─── Variants ─────────────────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <COMPONENT_NAME variant="primary" label="Primary" />
      <COMPONENT_NAME variant="secondary" label="Secondary" />
      <COMPONENT_NAME variant="danger" label="Danger" />
    </div>
  ),
  parameters: {
    docs: {
      description: { story: 'All available visual variants.' },
    },
  },
};

// ─── Interaction Tests ────────────────────────────────────────────────────────

export const InteractionTest: Story = {
  args: {
    label: 'Submit Form',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Render initial state', async () => {
      const button = canvas.getByRole('button', { name: /submit form/i });
      await expect(button).toBeInTheDocument();
      await expect(button).not.toBeDisabled();
    });

    await step('User clicks button', async () => {
      const button = canvas.getByRole('button', { name: /submit form/i });
      await userEvent.click(button);
      // Assert post-click state
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    await step('Keyboard navigation works', async () => {
      const button = canvas.getByRole('button', { name: /submit form/i });
      button.focus();
      await expect(button).toHaveFocus();
      await userEvent.keyboard('{Enter}');
    });
  },
};

// ─── Responsive ───────────────────────────────────────────────────────────────

export const Mobile: Story = {
  args: { label: 'Mobile view' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Tablet: Story = {
  args: { label: 'Tablet view' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

// ─── Dark Mode ────────────────────────────────────────────────────────────────

export const DarkMode: Story = {
  args: { label: 'Dark mode' },
  parameters: {
    backgrounds: { default: 'dark' },
    themes: { default: 'dark' },
  },
};
