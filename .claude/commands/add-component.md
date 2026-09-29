---
description: Create a single React component with tests — standalone, reusable UI component
agent: frontend-developer
subtask: true
---

# Add Component

## Input

$ARGUMENTS (component description)
Examples:

- `/add-component StatusBadge for order status`
- `/add-component DataTable wrapper for resource list with sorting and pagination`
- `/add-component ConfirmDialog reusable confirmation modal`
- `/add-component SearchBar with debounced input and clear button`

## Process

### Step 1: Query Design Sources

Before writing any code:

```

Read @.claude/standards/ui-design-standards.md first.
Read @.claude/standards/component-usage.md — check if a matching Storybook component already exists before creating anything new.
Read @.claude/docs/component-library.md.

Inspect `.claude/wireframes/*`, read `.claude/wireframes/.generated-manifest.json`, then apply **Wireframe Precedence** — the canonical rule in `@.claude/standards/component-usage.md#wireframe-precedence-canonical`.
Read **UI Library** in @.claude/CLAUDE.md Critical Constraints.
If wireframes use a different UI library/styling system, convert implementation to configured UI library constraints while preserving wireframe layout, hierarchy, spacing, states, and interactions.

If design tool MCP is configured: query it for matching frames/components and expected states.
If design system MCP is configured: query it for available components, props, variants, and design tokens.
Query Context7 MCP (https://mcp.context7.com/mcp): "How is [framework/library pattern] implemented in current NextJS/React ecosystem?"

```

### Step 2: Plan Component

Determine:

- **RSC vs Client**: Does it need hooks, events, or browser APIs?
  - Interactivity required → `'use client'`
  - Display only → Server Component (no directive)
- **Composition**: What sub-components are needed?
- **Props interface**: What does the parent need to pass?
- **Variants/States**: loading, error, empty, populated
- **Accessibility**: What ARIA attributes are required?
- **Documentation source**:
  - Wireframe layouts and interaction intent (per Wireframe Precedence: page/layout wireframes lead; a component/pattern wireframe marked `converted` carries equal weight with the generated component)
  - Design intent and hierarchy → design tool MCP (if configured)
  - Design system API/tokens/slots → design system MCP (if configured)
  - Reusable composition patterns → `@.claude/docs/component-library.md`
  - NextJS/React/TanStack/RHF/Zod patterns → Context7 MCP

Present plan:

```

## Component Plan: {ComponentName}

Type: Client Component / Server Component
Design system components used: [list from MCP query]
Props:

- propName: type — description
States: loading | error | empty | success | {domain states}
Accessibility: [aria attributes needed]
Wireframes used: [one or many files/sections]
Library mapping: [wireframe library -> configured UI library mapping]
File: frontend/src/components/{feature}/{ComponentName}.tsx
Test: frontend/src/components/{feature}/{ComponentName}.test.tsx

```

### Step 3: Implement Component

Follow `@.claude/standards/frontend-standards.md` and `@.claude/standards/ui-design-standards.md`:

```typescript
// Query design system MCP for exact import paths
'use client'; // only if needed

import { ... } from '@your-ui-lib/react'; // from MCP query

interface {ComponentName}Props {
  // All props explicitly typed — no 'any'
  // Required props first, optional last
  // Callbacks typed: onAction: (data: Type) => void
}

export function {ComponentName}({
  prop1,
  prop2,
  onAction,
}: {ComponentName}Props) {

  // Loading state
  if (isLoading) return <DesignSystemSkeleton />;

  // Error state
  if (error) return (
    <div role="alert">{getUserFriendlyMessage(error)}</div>
  );

  // Empty state
  if (!data || data.length === 0) return (
    <DesignSystemEmptyState message="No items found" />
  );

  // Main render
  return (
    <DesignSystemComponent
      // Props from MCP query
      aria-label="..."  // accessibility
    >
      {/* content */}
    </DesignSystemComponent>
  );
}
```

**Accessibility requirements** (always include):

- Interactive elements: `aria-label` or visible label
- Dynamic content: `aria-live` region
- Icons without text: `aria-hidden="true"` + sibling text
- Form fields: `htmlFor` / `id` association
- Loading: `aria-busy`, `role="status"`
- Errors: `role="alert"`, `aria-describedby`

### Step 4: Export from Index

Check if barrel export exists:

```bash
!`ls frontend/src/components/{feature}/index.ts 2>/dev/null && echo "EXISTS" || echo "NONE"`
```

Add export to `index.ts`:

```typescript
export { {ComponentName} } from './{ComponentName}';
export type { {ComponentName}Props } from './{ComponentName}';
```

### Step 5: Generate Tests

Follow `@.claude/standards/testing-standards.md`:

```typescript
// {ComponentName}.test.tsx
// Cover:
// - Renders correctly with required props
// - All visual states (loading, error, empty, populated)
// - User interactions (click, change, submit)
// - Accessibility (aria attributes, keyboard navigation)
// - Edge cases (null props, empty arrays, long strings)
```

### Step 6: Run Tests

```bash
!`cd frontend && npm test -- --testPathPattern="{ComponentName}" --verbose`
!`cd frontend && npm run lint -- --max-warnings=0`
```

Fix any failures.

### Step 7: Storybook Entry (if project uses Storybook)

```bash
!`ls frontend/.storybook 2>/dev/null && echo "HAS_STORYBOOK" || echo "NO_STORYBOOK"`
```

If Storybook exists, generate story file.

## ⚠️ Definition of Done — MANDATORY

> Load and apply **`@.claude/docs/definition-of-done.md` §3 (Component DoD)** — do not mark complete until all items pass.

Key gates:
- UI protocol followed: `pnpm inspect:ui` clean, zero console errors, zero network failures
- Accessibility: aria attributes, keyboard navigation, focus indicators
- Component test: `{ComponentName}.test.tsx` with all visual states + interactions, `renderWithProviders()`, MSW handlers
- E2E (if used in a page/route): Page Object updated, `data-testid` attributes added
- Code quality: `pnpm lint` zero warnings, `pnpm type-check` zero errors
- Storybook story covers all documented visual states

See: `@.claude/docs/definition-of-done.md`, `@.claude/standards/testing-standards.md`, `@.claude/standards/playwright-e2e-standards.md`

- Component: `frontend/src/components/{feature}/{ComponentName}.tsx`
- Tests: `frontend/src/components/{feature}/{ComponentName}.test.tsx`
- Export: updated `frontend/src/components/{feature}/index.ts`
- Story: `frontend/src/components/{feature}/{ComponentName}.stories.tsx` (if applicable)

## Cross-References

- Frontend standards: `@.claude/standards/frontend-standards.md`
- UI quality standards: `@.claude/standards/ui-design-standards.md`
- Reusable patterns: `@.claude/docs/component-library.md`
- Context7 MCP: `https://mcp.context7.com/mcp`
- Full feature: `/add-feature-ui`
- Tests: `/add-unit-test`
