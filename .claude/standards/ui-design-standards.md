# UI Design Standards

> Token optimization: load this file only for UI design or UI review tasks.
> Unload it after implementation plan is finalized and keep only the generated checklist.

## Design Philosophy

- Design system first: Use the project's configured component library and tokens as the default UI language.
- Design-reference-aligned implementation: Pull design references when available.
- Consistency over novelty: Match established patterns before introducing new visual patterns.
- Accessibility first: WCAG 2.1 AA is mandatory.
- Mobile-first: Start at 320px and scale up.

## Mandatory Pre-Read For UI Tasks

1. `@.claude/workflows/ui-design-workflow.md`
2. `@.claude/docs/component-library.md`

## Design System Integration Rules

1. Consult design references first when they exist.
2. Extract layout intent, hierarchy, and spacing rhythm.
3. Map design components to the project's component library equivalents.
4. Use design tokens only in implementation (no raw hex values, no ad-hoc spacing values).
5. If a design value has no direct token equivalent, choose the nearest token and document the decision.

## UI Quality Criteria

### Visual Hierarchy

Must have:

- One clear primary action per screen or section.
- At most three hierarchy levels.
- Consistent spacing rhythm based on the design system token scale.
- At least 24px equivalent spacing between major sections.

### Typography

- Use the project's typography variants and heading levels.
- H1 for page-level identity only.
- H2 for primary sections, H3 for secondary sections.
- Body text should be readable and never compressed.
- Prefer two font weights per page; avoid excessive variation.

### Color and Contrast

- Use design system color tokens only.
- Semantic color intent must be preserved:
  - Primary: key actions and links
  - Success: positive outcomes
  - Warning: caution and recoverable risks
  - Critical/Error: blocking failures and destructive outcomes
  - Neutral: text, borders, surfaces
- Contrast minimums:
  - Text: 4.5:1
  - Large text and UI boundaries: 3:1

### Layout and Responsiveness

- Build on a 12-column responsive mental model.
- Keep content width comfortable for readability.
- Validate behavior at 375px, 768px, and 1440px.
- No horizontal scroll on supported breakpoints.
- Use touch-friendly controls with minimum 44px interactive target size.

### Navigation and Information Flow

- Route transitions must preserve user intent and state where expected.
- Back navigation should return users to the prior decision point.
- Breadcrumbs or contextual headings should orient users on deep pages.
- Avoid dead-end pages; always provide a clear next action.

### Lists, Tables, and Pagination

- Sort order must be explicit and stable across pages.
- Pagination controls must handle first/last boundaries correctly.
- Page size should be predictable and user-understandable.
- Empty pages caused by filters should provide recovery actions.

### Testability and Observability

- UI states must be deterministic and easy to assert in tests.
- Include stable selectors for critical interactive controls.
- Critical journeys should be coverable with realistic E2E tests.
- Validation and error messages should be test-assertable and user-actionable.

### States and Feedback

Every user-facing surface must define:

- Loading state (skeleton or spinner)
- Error state (clear message + recovery action)
- Empty state (helpful message + call to action)
- Success/confirmation state when applicable
- Hover, active, and focus-visible feedback for interactive elements

### Accessibility

- Semantic HTML first.
- Logical keyboard tab order.
- Visible focus indicator.
- Form fields with explicit labels and actionable validation text.
- ARIA only where semantics alone are not enough.

## UI Smells (Reject On Review)

- Mixing the project's design system with unrelated UI libraries.
- Hardcoded colors, font sizes, or spacing not mapped to tokens.
- Missing loading/error/empty states.
- Placeholder error copy like "Something went wrong" without next action.
- Mobile layout breakage or overflow.
- Inconsistent spacing and typography hierarchy.

## Definition of Done For UI

> Load **`@.claude/docs/definition-of-done.md` §1 (UI DoD)** for the full checklist.

Key design-quality items (subset of full DoD):

- [ ] Design system components and tokens only (no unrelated library mixing)
- [ ] Responsive checks at 375px, 768px, 1440px
- [ ] Loading, error, empty states implemented
- [ ] Keyboard navigation and focus-visible states validated
- [ ] Screen-reader semantics validated
- [ ] No horizontal overflow
- [ ] Pattern consistency against `@.claude/docs/component-library.md`

## References

- `@.claude/docs/component-library.md`
- `@.claude/workflows/ui-design-workflow.md`
- WCAG 2.1 AA
