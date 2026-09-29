---
name: ui-add-component-with-design
description: Create UI component with design-first workflow and full state coverage
applyTo: "**"
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Add Component With Design

**Purpose**: Build UI component using design-first workflow with all states and tests

**Use this command when**:
- Creating new component from design spec
- Want design-driven development
- Need comprehensive state coverage (loading, error, empty, success)
- Building component library patterns
- Design spec exists (from design tool or manual spec)

---

## Workflow

### Step 1: Specification

Have or create a UI spec:
- `.claude/specs/ui-specs/<component>-spec.md`
- OR a design spec from your design tool

Required spec sections:
- User flow and interactions
- Layout and hierarchy
- Component inventory with design system mapping
- Design tokens
- State definitions
- Accessibility requirements

### Step 2: Load References

- `@.claude/standards/ui-design-standards.md`
- `@.claude/standards/component-usage.md` — check Storybook library before creating new component
- `@.claude/docs/component-library.md`

### Step 3: Design Phase

Review design intent:
- Query design tool MCP if available and configured
- Confirm design system component mapping
- Identify reusable patterns
- Plan state handling

### Step 4: Implementation

Build component with:

```tsx
// 1. TypeScript types (strict, no `any`)
interface CardProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: Error;
  isEmpty?: boolean;
  onAction?: () => void;
}

// 2. Design system components
import { Box, Flex, Heading, Text, Button, Spinner } from '@your-ui-lib/react';

// 3. Token-based styling
export function Card({
  title,
  description,
  isLoading,
  error,
  isEmpty,
  onAction,
}: CardProps) {
  // 4. State rendering function
  if (isLoading) {
    return (
      <Box surface="container" padding="tile" role="status" aria-label="Loading">
        <SkeletonLoader height="120px" />
      </Box>
    );
  }

  if (error) {
    return (
      <MessageBanner
        variant="error"
        title="Error"
        message={error.message}
      />
    );
  }

  if (isEmpty) {
    return (
      <Box surface="container" padding="tile" textAlign="center">
        <Text variant="body-secondary">No content available</Text>
      </Box>
    );
  }

  // 5. Success state with full interactivity
  return (
    <Box surface="container" padding="tile" radius="medium">
      <Heading variant="h3">{title}</Heading>
      {description && <Text variant="body-secondary">{description}</Text>}
      <Button onPress={onAction} style={{ marginTop: 'var(--spacing-tile)' }}>
        Action
      </Button>
    </Box>
  );
}
```

### Step 5: Testing

Create comprehensive tests:

```typescript
// __tests__/Card.test.tsx
describe('Card Component', () => {
  test('renders success state', () => {
    const { getByText } = render(<Card title="Test" />);
    expect(getByText('Test')).toBeInTheDocument();
  });

  test('shows loading skeleton', () => {
    const { getByRole } = render(<Card isLoading />);
    expect(getByRole('status')).toBeInTheDocument();
  });

  test('displays error message', () => {
    const error = new Error('Failed to load');
    const { getByText } = render(<Card error={error} />);
    expect(getByText('Failed to load')).toBeInTheDocument();
  });

  test('shows empty state', () => {
    const { getByText } = render(<Card isEmpty />);
    expect(getByText('No content available')).toBeInTheDocument();
  });

  test('is keyboard accessible', async () => {
    const { getByRole } = render(<Card onAction={jest.fn()} />);
    const button = getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });
});
```

### Step 6: Documentation

Add JSDoc and usage:

```tsx
/**
 * Card Component
 *
 * A reusable card container with full state support.
 *
 * @component
 * @example
 * <Card title="Users" description="Active users list" />
 *
 * @param {CardProps} props
 * @param {string} props.title - Card heading
 * @param {string} [props.description] - Optional subtitle
 * @param {boolean} [props.isLoading] - Shows loading skeleton
 * @param {Error} [props.error] - Shows error message
 * @param {boolean} [props.isEmpty] - Shows empty state
 * @param {() => void} [props.onAction] - Primary action handler
 *
 * @returns {React.ReactElement}
 */
```

### Step 7: Validation

- [ ] TypeScript compiles without errors
- [ ] All 4 states (loading, error, empty, success) work
- [ ] Tests pass with >80% coverage
- [ ] Responsive at 375px, 768px, 1440px
- [ ] Keyboard navigation works
- [ ] Design system tokens only (no custom CSS)
- [ ] Accessibility validated (axe)

---

## Deliverables

✅ React component file (TypeScript)
✅ Full state support (loading, error, empty, success)
✅ Tests (>80% coverage)
✅ JSDoc documentation
✅ Responsive design validation
✅ Accessibility tested
✅ Token-safe styling
✅ Theme-aligned colors

---

## State Coverage Matrix

| State | Display | Context | User Feedback |
|-------|---------|---------|---------------|
| **Loading** | Skeleton or spinner | Data fetching | "Loading..." aria-label |
| **Error** | Error message | Request failed | Error icon, dismissible |
| **Empty** | Empty state guidance | No data available | Helpful message, action |
| **Success** | Full content | Data loaded | Interactive, actionable |

---

## After Creation

Next steps:

1. Export to component-library.md if reusable pattern
2. `/ui-review` for final quality check
3. Create Storybook story (optional)
4. Merge and use in features

---

## Related Commands

- `/ui-review` — Final quality check
- `/ui-audit` — Component quality audit
- `/ui-improve` — Refactor component

---

## References

- UI spec template: `@.claude/templates/ui-spec-template.md`
- Component library: `@.claude/docs/component-library.md`
- UI standards: `@.claude/standards/ui-design-standards.md`
