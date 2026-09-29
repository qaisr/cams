---
name: storybook-standards
description: Enterprise Storybook standards for Next.js components — story structure, naming, accessibility, testing, and Lumen/Tailwind conventions
applyTo: "apps/web/**"
autoLoad: false
---

# Storybook Standards

Reference authority for all Storybook work in this monorepo.
Loaded by `wireframes-to-storybook` and `wireframes-to-components` commands.

---

## 1. Story Title Hierarchy

```
Documentation/            → MDX doc pages only
  Introduction
  Design Tokens
  Accessibility
  Component Status
  Contributing

UI/
  Components/             → Atomic, single-purpose
    Button
    Input
    Badge
    Card
    Avatar
    Spinner
    Toggle
  Composite/              → Two or more atoms combined
    Form
    Modal
    Table
    Select
    DatePicker
    Card
  Layout/                 → Structural / page-level
    Header
    AppShell
    Sidebar
    PageContainer

Features/                 → Domain-specific, app-aware
  Auth/
  Profile/
  Settings/
  Dashboard/

Examples/                 → Composition demos, not shipped components
  FormPatterns
  WorkflowExamples
  DataDisplayPatterns
```

### Rules

- Title MUST match the file system path exactly
- PascalCase for every segment after the category
- Never use `Default` as a category — it is a reserved story name
- Feature components go under `Features/[Domain]/` not `UI/`
- Examples are non-exportable compositions for documentation only

---

## 2. File & Folder Naming

```
src/components/
└── [category]/
    └── [ComponentName]/          ← PascalCase folder
        ├── ComponentName.tsx     ← Implementation
        ├── ComponentName.types.ts← Interfaces and types only
        ├── ComponentName.stories.tsx
        ├── ComponentName.test.tsx
        └── index.ts              ← Re-exports only
```

### Rules

- One component per folder — no multi-component files
- Co-locate stories and tests with the component — not in a separate `__tests__/` folder
- `index.ts` contains ONLY re-exports — no logic
- `*.types.ts` contains ONLY interfaces, types, enums — no runtime code

---

## 3. Meta Block Standards

Every `*.stories.tsx` MUST have:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta = {
  title: 'UI/Components/ComponentName',   // ← matches hierarchy above
  component: ComponentName,
  tags: ['autodocs'],                     // ← REQUIRED on every meta
  parameters: {
    layout: 'centered',                   // centered | padded | fullscreen
    docs: {
      description: {
        component: `
## ComponentName

[One paragraph: what it is, when to use it, where it appears in the app]

### Features
- [Bullet list of key capabilities]

### Usage
\`\`\`tsx
import { ComponentName } from '@/components/[category]/ComponentName';

<ComponentName variant="primary">Label</ComponentName>
\`\`\`

### Accessibility
- [Key a11y notes specific to this component]
        `,
      },
    },
  },
  argTypes: {
    // ← REQUIRED: every public prop must have an argType entry
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;
```

### `layout` Values

| Value | When to use |
|---|---|
| `centered` | Atomic components (Button, Badge, Input) |
| `padded` | Composite components, cards, panels |
| `fullscreen` | Layout components, full-page examples |

### `argTypes` Requirements

Every prop MUST declare:

```typescript
argTypes: {
  variant: {
    control: 'select',
    options: ['primary', 'secondary', 'ghost', 'outline'],
    description: 'Visual style variant',
    table: {
      type: { summary: 'string' },
      defaultValue: { summary: 'primary' },
    },
  },
  size: {
    control: 'radio',
    options: ['sm', 'md', 'lg'],
    description: 'Component size',
    table: {
      type: { summary: 'string' },
      defaultValue: { summary: 'md' },
    },
  },
  isLoading: {
    control: 'boolean',
    description: 'Loading state — disables interaction and shows spinner',
  },
  disabled: {
    control: 'boolean',
    description: 'Disabled state',
  },
  onClick: {
    action: 'clicked',
    description: 'Click handler',
    table: { category: 'Events' },
  },
},
```

---

## 4. Required Story Groups

Every component MUST have stories covering ALL of these groups.
Missing groups are a failing quality check.

### Group 1 — Variants (one story per variant)

```typescript
export const Primary: Story   = { args: { variant: 'primary',   children: 'Label' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Label' } };
export const Ghost: Story     = { args: { variant: 'ghost',     children: 'Label' } };
export const Outline: Story   = { args: { variant: 'outline',   children: 'Label' } };
```

### Group 2 — Sizes

```typescript
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 flex-wrap">
      <Component size="sm">Small</Component>
      <Component size="md">Medium</Component>
      <Component size="lg">Large</Component>
    </div>
  ),
};
```

### Group 3 — States

```typescript
export const Default: Story  = { args: { state: 'default'  } };
export const Loading: Story  = { args: { isLoading: true   } };
export const Disabled: Story = { args: { disabled: true    } };
export const Error: Story    = { args: { state: 'error'    } };
export const Empty: Story    = { args: { state: 'empty'    } };
```

### Group 4 — Edge Cases

```typescript
export const LongContent: Story = {
  args: { children: 'A very long label that tests overflow and wrapping behaviour in constrained layouts' },
  parameters: {
    docs: { description: { story: 'Verifies layout integrity with unexpectedly long content' } },
  },
};

export const NoContent: Story = {
  args: { children: undefined },
  parameters: {
    docs: { description: { story: 'Verifies graceful render when children is undefined' } },
  },
};

export const SpecialCharacters: Story = {
  args: { children: '< > & " \' — em dash — 日本語' },
};

export const MinimalProps: Story = {
  // Only required props — tests that defaults are sensible
  args: {},
};
```

### Group 5 — Responsive

```typescript
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
  args: { children: 'Mobile view' },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
  args: { children: 'Tablet view' },
};

export const Desktop: Story = {
  parameters: { viewport: { defaultViewport: 'desktop' } },
  args: { children: 'Desktop view' },
};
```

### Group 6 — Interaction Tests

```typescript
import { within, userEvent, expect } from '@storybook/test';

export const ClickInteraction: Story = {
  args: { children: 'Click Me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByRole('button', { name: /click me/i });

    // Verify initial state
    await expect(el).not.toBeDisabled();

    // Test click
    await userEvent.click(el);

    // Test keyboard
    await userEvent.tab();
    await expect(el).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Space}');
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Tab to component
    await userEvent.tab();

    // Verify focus
    const el = canvas.getByRole('button');
    await expect(el).toHaveFocus();

    // Verify focus ring class is present
    await expect(el).toHaveClass('focus-visible:outline');

    // Activate with keyboard
    await userEvent.keyboard('{Enter}');
  },
};
```

### Group 7 — Accessibility

```typescript
export const AccessibilityAudit: Story = {
  name: 'Accessibility Audit',
  args: {
    'aria-label': 'Descriptive accessible label',
    children: 'Accessible Component',
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast',       enabled: true },
          { id: 'button-name',          enabled: true },
          { id: 'label',                enabled: true },
          { id: 'aria-required-attr',   enabled: true },
          { id: 'aria-valid-attr-value',enabled: true },
          { id: 'focus-visible',        enabled: true },
        ],
      },
    },
    docs: {
      description: {
        story: 'Automated axe-core accessibility audit. Must pass with zero violations.',
      },
    },
  },
};
```

### Group 8 — Dark Mode

```typescript
export const DarkMode: Story = {
  args: { children: 'Dark Mode' },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: { description: { story: 'Verify legibility and contrast on dark backgrounds' } },
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="p-4 rounded-xl">
        <Story />
      </div>
    ),
  ],
};
```

---

## 5. TypeScript Interface Standards

### Required Interface Shape

```typescript
// ComponentName.types.ts

import type { HTMLAttributes, ReactNode, MouseEvent } from 'react';

// ── Enums as string unions ──────────────────────────────────────────────
export type ComponentVariant =
  | 'primary'
  | 'secondary'
  | 'warning'
  | 'error'
  | 'ghost'
  | 'outline';

export type ComponentSize = 'sm' | 'md' | 'lg';

export type ComponentState =
  | 'default'
  | 'loading'
  | 'disabled'
  | 'error'
  | 'empty';

// ── Main interface ──────────────────────────────────────────────────────
export interface ComponentNameProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {

  // Visual
  /**
   * Visual style variant
   * @default 'primary'
   */
  variant?: ComponentVariant;

  /**
   * Size of the component
   * @default 'md'
   */
  size?: ComponentSize;

  // Content
  /** Primary label or content */
  children?: ReactNode;

  /** Supporting text displayed below title */
  description?: string;

  // States
  /**
   * Shows spinner and disables interaction
   * @default false
   */
  isLoading?: boolean;

  /**
   * Prevents interaction
   * @default false
   */
  disabled?: boolean;

  // Actions
  /** Click handler */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  // Accessibility
  /**
   * Accessible label — REQUIRED when children is icon-only
   */
  'aria-label'?: string;

  /** ID of element that describes this component */
  'aria-describedby'?: string;
}
```

### Naming Rules

| Prop type | Convention | Example |
|---|---|---|
| Boolean state | `is` prefix | `isLoading`, `isOpen`, `isSelected` |
| Boolean flag | no prefix | `disabled`, `required`, `fullWidth` |
| Event handler | `on` prefix | `onClick`, `onSubmit`, `onClose` |
| Render prop | `render` prefix | `renderHeader`, `renderActions` |
| Slot content | descriptive noun | `startIcon`, `endIcon`, `actions` |
| Visual style | `variant` | `variant="primary"` |
| Dimension | `size` | `size="md"` |

### Default Props Rule

ALL optional props MUST have defaults declared in the function signature:

```typescript
// ✅ Correct
export const Component = ({
  variant  = 'primary',
  size     = 'md',
  isLoading = false,
  disabled  = false,
}: ComponentProps) => { ... };

// ❌ Wrong — defaults scattered or missing
export const Component = ({ variant, size, isLoading }: ComponentProps) => {
  const v = variant || 'primary'; // Don't do this
};
```

---

## 6. Lumen + Tailwind Conventions

Components are **thin wrappers over Lumen primitives** (`@lumen/react`). Lumen
owns visual styling (colour, radius, spacing, states); Tailwind is retained for
**layout/utilities only**. DaisyUI has been removed — never use `btn`,
`btn-primary`, or any DaisyUI class.

### Class Ordering

Follow the Prettier Tailwind plugin order:

```
1. Layout      (flex, grid, block, hidden)
2. Position    (relative, absolute, fixed, sticky, z-*)
3. Size        (w-*, h-*, min-*, max-*)
4. Spacing     (p-*, m-*, gap-*)
5. Typography  (text-*, font-*, tracking-*, leading-*)
6. Visual      (bg-*, border-*, rounded-*, shadow-*)
7. Interactive (cursor-*, hover:*, focus:*, active:*)
8. Motion      (transition-*, duration-*, ease-*, animate-*)
9. Responsive  (sm:, md:, lg:, xl:, 2xl:)
10. Dark mode  (dark:)
```

### Compose Lumen primitives

Wrap the Lumen primitive and drive appearance through its own props (e.g.
`variant`); pass Tailwind **layout** utilities via `className` for overrides only:

```typescript
// ✅ Correct — Lumen variant + layout-only className override
import { Button } from '@/components/ui/Button';
<Button variant="primary" className="w-full">Continue</Button>

// ❌ Wrong — DaisyUI classes / re-styling Lumen with visual utilities
<button className="btn btn-primary bg-black px-4 py-2 rounded font-bold">
```

### Theme Tokens

Use ONLY these design tokens (defined in `apps/web/app/globals.css`) — do not hardcode hex values:

```typescript
// Colors — via @theme in globals.css
'ppcc-yellow'      // #FFCC00 — primary brand
'ppcc-black'       // #000000 — headers, CTAs
'ppcc-ink'         // #161616 — body text
'ppcc-graphite'    // #2B2B2B — muted text
'ppcc-grey'        // #F4F4F2 — page background
'ppcc-line'        // #D9D9D4 — borders, dividers
'ppcc-ivory'       // #FFFBEA — text on dark surfaces
'status-success'  // #157A3B — success
'status-error'    // #B42318 — error
'status-warning'  // #B76E00 — warning
'status-info'     // #175CD3 — info

// Shadows
shadow-elevated   // 0 12px 32px rgba(0,0,0,.12) — elevated overlays
shadow-soft       // 0 6px 18px rgba(0,0,0,.08)  — cards
```

### Focus Visible Standard

Every interactive element MUST use this exact focus style — no exceptions:

```typescript
'focus-visible:outline focus-visible:outline-3 focus-visible:outline-ppcc-yellow/55 focus-visible:outline-offset-2'
```

### Variants come from the Lumen primitive

For a wrapped Lumen component, do **not** re-derive variants with CVA + utility
classes — forward Lumen's own `variant`/`size` props. The wrapper only sets a
default and threads `className` for layout overrides:

```typescript
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <LumenButton ref={ref} variant={variant} className={cn(className)} {...props} />
  ),
);
```

CVA (`class-variance-authority`) is reserved for genuinely **custom** elements
that have no Lumen equivalent. When used, variants map to Lumen CSS tokens or the
retained `ppcc-*`/`status-*` brand tokens — **never** DaisyUI `btn*` classes:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      success: 'bg-status-success/10 text-status-success',
      error:   'bg-status-error/10 text-status-error',
      info:    'bg-status-info/10 text-status-info',
    },
  },
  defaultVariants: { tone: 'info' },
});

<span className={cn(badgeVariants({ tone }), className)} />
```

---

## 7. Accessibility Standards

### Mandatory Requirements (Zero Exceptions)

| Requirement | Implementation |
|---|---|
| Focus indicator | `focus-visible:outline-3 focus-visible:outline-ppcc-yellow/55` |
| Icon-only elements | `aria-label` required |
| Loading state | `aria-busy="true"` |
| Expanded state | `aria-expanded` on trigger |
| Invalid field | `aria-invalid="true"` + `aria-describedby` to error |
| Live regions | `aria-live="polite"` for non-critical updates |
| Modal | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| Color alone | Never use color as the ONLY means of conveying info |
| Contrast | Text 4.5:1 min, large text 3:1 min, UI elements 3:1 min |

### ARIA Patterns by Component Type

**Buttons**:
```typescript
// Icon-only
<button aria-label="Close notification">
  <XIcon aria-hidden="true" />
</button>

// Loading
<button aria-busy={isLoading} disabled={isLoading}>
  {isLoading && <Spinner aria-hidden="true" />}
  {isLoading ? 'Saving...' : 'Save'}
</button>

// Toggle
<button
  aria-pressed={isActive}
  onClick={() => setIsActive(!isActive)}
>
  Notifications
</button>
```

**Forms**:
```typescript
<label htmlFor="email">
  Email <span aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</label>
<input
  id="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'email-error' : undefined}
/>
{hasError && (
  <span id="email-error" role="alert">
    This field is required
  </span>
)}
```

**Disclosure / Dropdown**:
```typescript
<button
  aria-expanded={isOpen}
  aria-controls="panel-id"
  aria-haspopup="true"
>
  Notifications
</button>
<div
  id="panel-id"
  role="region"
  aria-label="Notifications panel"
  hidden={!isOpen}
>
  ...
</div>
```

### Keyboard Interaction Map

| Component | Keys required |
|---|---|
| Button | `Enter`, `Space` |
| Link | `Enter` |
| Checkbox | `Space` |
| Radio group | `Arrow Up/Down` |
| Select / Listbox | `Arrow Up/Down`, `Enter`, `Escape` |
| Modal | `Escape` closes, focus trapped inside |
| Dropdown | `Escape` closes, focus returns to trigger |
| DatePicker | Arrow keys navigate, `Enter` selects, `Escape` closes |
| Tabs | `Arrow Left/Right` between tabs |
| Accordion | `Enter`/`Space` toggle |

### Reduced Motion

```typescript
// Respect user preference in all animations
<div className="transition-transform motion-reduce:transition-none">
```

---

## 8. Autodocs Requirements

When `tags: ['autodocs']` is present, Storybook auto-generates a docs page.
The following MUST be true for that page to be useful:

### Component-Level

- `parameters.docs.description.component` filled with markdown
- All props have JSDoc `/** */` comments
- All props have `argTypes` entries with `description` and `table`
- `displayName` set on all `forwardRef` components

### Story-Level

- Every story has a descriptive export name (not `Story1`, `Story2`)
- Edge case stories have `parameters.docs.description.story` explaining the scenario
- Interaction stories have comments in `play` function explaining each step

### Required JSDoc Tags

```typescript
/**
 * Brief description of what the component does.
 *
 * @component
 * @example
 * ```tsx
 * <ComponentName variant="primary" size="md">
 *   Label
 * </ComponentName>
 * ```
 */
export const ComponentName = forwardRef<...>(...);
ComponentName.displayName = 'ComponentName';
```

---

## 9. Test Standards

### Co-location Rule

Tests live next to the component, not in a separate folder:

```
Button/
├── Button.tsx
├── Button.stories.tsx
├── Button.test.tsx        ← co-located
└── index.ts
```

### `composeStories` Pattern

Always derive tests from stories — do not duplicate setup:

```typescript
import { composeStories } from '@storybook/react';
import * as stories from './ComponentName.stories';

const {
  Primary,
  Loading,
  Disabled,
  AccessibilityAudit,
} = composeStories(stories);
```

### Required Test Blocks

Every `*.test.tsx` MUST cover:

```typescript
describe('ComponentName', () => {
  describe('Rendering',     () => { /* default, variants, children */ });
  describe('States',        () => { /* loading, disabled, error, empty */ });
  describe('Interactions',  () => { /* click, keyboard, events */ });
  describe('Accessibility', () => { /* aria attrs, focus indicator */ });
  describe('Edge Cases',    () => { /* long content, undefined, special chars */ });
});
```

### Coverage Thresholds

| Category | Minimum | Target |
|---|---|---|
| Lines | 80% | 90% |
| Branches | 75% | 85% |
| Functions | 80% | 90% |
| Critical paths | 100% | 100% |

---

## 10. Performance Standards

### Lazy Loading

```typescript
import { lazy, Suspense } from 'react';

// Heavy feature components loaded on demand
const ComplexTable = lazy(
  () => import('@/components/composite/Table')
);

export function PageWithTable() {
  return (
    <Suspense fallback={<div className="loading loading-spinner" />}>
      <ComplexTable />
    </Suspense>
  );
}
```

### Memoization Rules

```typescript
// Memoize when:
// 1. Component receives complex object/array props
// 2. Component is rendered in a list
// 3. Component has expensive internal computation

export const ExpensiveRow = memo(function ExpensiveRow({
  item,
}: {
  item: Item;
}) {
  return <tr>...</tr>;
});

// useCallback for handlers passed to memoized children
const handleOpen = useCallback((id: string) => {
  router.push(`/items/${id}`);
}, [router]);
```

### Story Performance

```typescript
// Mock heavy API calls in stories — never make real network requests
export const WithData: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/files', () =>
          HttpResponse.json(mockFiles)
        ),
      ],
    },
  },
};
```

---

## 11. Component Status Tags

Apply one of these tags to every story's meta in addition to `autodocs`:

```typescript
tags: ['autodocs', 'stable']       // Production-ready, fully tested
tags: ['autodocs', 'beta']         // Under review, API may have minor changes
tags: ['autodocs', 'experimental'] // In development, API may break
tags: ['autodocs', 'deprecated']   // Being phased out, do not use in new code
tags: ['autodocs', 'skip-test']    // Excluded from test-runner (justify in comment)
```

---

## 12. Quality Gate Checklist

Before marking any component complete:

### Story Quality
- [ ] `tags: ['autodocs']` present on meta
- [ ] All 8 story groups present (variants, sizes, states, edge cases, responsive, interactions, a11y, dark mode)
- [ ] Every story has a descriptive name
- [ ] Edge case stories have `description.story`
- [ ] `argTypes` covers every public prop
- [ ] Component status tag applied

### Code Quality
- [ ] `*.types.ts` file exists with JSDoc on all props
- [ ] `forwardRef` used with `displayName` set
- [ ] CVA used for multi-variant styling
- [ ] No hardcoded hex values — custom tokens only
- [ ] Focus visible class applied to all interactive elements
- [ ] `motion-reduce` applied to all animations

### Test Quality
- [ ] `*.test.tsx` exists with all 5 describe blocks
- [ ] Tests use `composeStories` — no duplicated setup
- [ ] Coverage meets thresholds
- [ ] Zero console errors or warnings in test output

### Accessibility Quality
- [ ] axe-core: zero violations in `AccessibilityAudit` story
- [ ] Keyboard navigation works for all interactions
- [ ] ARIA attributes correct for component type
- [ ] Color contrast passes WCAG 2.1 AA
- [ ] Screen reader announcements verified manually

## Token Optimization

- **Load when**: building or auditing Storybook stories.
- **Load only**: this standard + `component-usage.md` + `component-architecture.md` + `storybook-story.tsx` template.
- **Unload after**: story passes 8 standard groups (default/states/variants/edge/a11y/responsive/themes/RTL) and a11y addon clean.
