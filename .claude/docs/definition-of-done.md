# Definition of Done

> **Token Policy**: Load this file when verifying completion, generating task
> checklists, or writing epic DoD sections. Unload after use — do not keep in
> context during active implementation phases.

---

## 1. UI Definition of Done

> **A UI task, epic, or story is NOT complete until ALL of the following are
> satisfied.**

### 1.1 UI Protocol Checklist

Follow `.claude/workflows/frontend-ui-protocol.md` — **non-negotiable**.

- [ ] Wireframe gate passed — `.claude/wireframes/*` inspected before any UI
      code written (if wireframes exist)
- [ ] `pnpm start` used (not `pnpm dev`) — full stack running (frontend :3000 +
      backend :3001)
- [ ] Mock auth performed via `/login-mock` before inspecting any protected page
- [ ] Browser inspection run BEFORE changes (`pnpm inspect:ui`) — baseline
      captured
- [ ] Code changes implemented
- [ ] UI tests implemented or updated
- [ ] Browser inspection run AFTER changes (`pnpm inspect:ui`) — result verified
- [ ] Zero console errors
- [ ] Zero console warnings (React warnings, hydration errors)
- [ ] Zero network failures (no 4xx/5xx API calls in report)
- [ ] Screenshot matches expected UI (layout, typography, spacing, states)

### 1.2 Accessibility Checklist

> Target: WCAG 2.1 AA minimum.

- [ ] All interactive elements have `aria-label` or visible label
- [ ] All form inputs have associated `<label>` (`htmlFor`/`id`)
- [ ] Loading states use `aria-busy` + `role="status"`
- [ ] Error states use `role="alert"` + `aria-describedby`
- [ ] Icons without text have `aria-hidden="true"` + sibling visible text
- [ ] Dynamic content regions have `aria-live`
- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrow keys for menus/lists)
- [ ] Visible focus indicator present on all interactive elements
- [ ] Logical keyboard tab order maintained
- [ ] No axe-core violations in Storybook (if component has a story)

### 1.3 UI Design Quality

- [ ] Design system components and tokens only (no unrelated UI library mixing)
- [ ] No hardcoded colors, font sizes, or spacing — use design tokens
- [ ] Loading, error, and empty states all implemented
- [ ] Responsive: verified at 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] No horizontal overflow at any breakpoint
- [ ] Consistent spacing and typography hierarchy
- [ ] Pattern consistency with `@.claude/docs/component-library.md`
- [ ] Storybook story covers all documented visual states (if project uses
      Storybook)

### 1.4 UI Test Checklist

**Component unit tests** (Jest + RTL + MSW):

- [ ] `{Component}.test.tsx` created or updated alongside source file
- [ ] All visual states covered: loading, error, empty, success
- [ ] All user interactions tested: click, change, submit, close, keyboard
- [ ] Form validation messages tested (match Zod schema errors)
- [ ] `renderWithProviders()` used — fresh `QueryClient` per test
- [ ] MSW handlers from `mocks/generated/` used as baseline; overridden per test
      for error/edge scenarios
- [ ] `pnpm --filter @repo/web test --testPathPattern="{Component}"` passes

**Playwright E2E tests** (for any new page, route, or user-visible feature):

- [ ] Page Object created or updated in `apps/web/e2e/pages/`
- [ ] All `data-testid` attributes referenced in POM are present on rendered
      elements
- [ ] Happy path scenario covered
- [ ] Error / validation scenario covered
- [ ] Auth guard scenario covered (unauthenticated redirect)
- [ ] `npx playwright test {feature}.spec.ts --reporter=line` passes
- [ ] `/playwright-ui-audit` run on new/modified spec files — zero critical
      violations

### 1.5 UI Code Quality

- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm type-check` — zero TypeScript errors
- [ ] No manually written `useQuery`/`useMutation` — use generated orval hooks
- [ ] No direct edits to `hooks/generated/` or `mocks/generated/`
- [ ] Shared Zod schema from `@repo/validation` used for form validation

---

## 2. Backend / API Definition of Done

> **A backend change is NOT complete until ALL applicable items are satisfied.**

### 2.1 Test Coverage Matrix

| Change type           | Minimum required tests                                               |
| --------------------- | -------------------------------------------------------------------- |
| NestJS service method | Unit test — all branches, EventBridge assertions, error propagation  |
| NestJS controller     | Unit test — HTTP codes, DTO passthrough, guard delegation            |
| New API endpoint      | Integration test (Testcontainers) — real DB, 201/400/401/403/404/409 |
| API contract          | API contract test — OpenAPI shape, RFC 7807 errors, correlation IDs  |
| Full-stack feature    | All of the above                                                     |

### 2.2 Backend Test Checklist

- [ ] Service unit tests: all branches, EventBridge publish assertions, error
      propagation
- [ ] Controller unit tests: HTTP codes, DTO passthrough, guard delegation
- [ ] Integration tests (Testcontainers) if any DB or auth behaviour changed —
      real DB state, auth/400/401/403/404/409 covered
- [ ] `pnpm test:preflight` passes before running integration tests
- [ ] `pnpm test` and `pnpm test:integration --runInBand` pass
- [ ] Coverage ≥ 80% branches, ≥ 85% lines/functions

### 2.3 Backend Code Quality

- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm type-check` — zero TypeScript errors
- [ ] OpenAPI spec updated before implementation if APIs changed
- [ ] No direct edits to `packages/api-spec/generated/`

---

## 3. Component Definition of Done

Applies when using `/add-component` or creating any standalone React component.

- [ ] All items from **Section 1** (UI DoD) satisfied
- [ ] `{ComponentName}.test.tsx` created alongside source file
- [ ] `data-testid` attributes added to all interactive elements
- [ ] Export added to `{feature}/index.ts` barrel file
- [ ] If component is used in a page/route: Page Object updated in
      `apps/web/e2e/pages/`
- [ ] Storybook story covers all documented visual states

---

## 4. Epic / Feature Quality Close

At the end of each epic implementation, satisfy the relevant gates below before
marking `complete`.

### 4.1 UI-Only or Full-Stack Epics

1. Follow `.claude/workflows/frontend-ui-protocol.md` in full — browser
   inspection clean, zero console errors, zero network failures
2. Verify all component tests pass: `pnpm --filter @repo/web test`
3. Run Playwright E2E tests covering every acceptance criteria user journey:
   `npx playwright test {feature}.spec.ts --reporter=line`
4. Run `/playwright-ui-audit` on new/modified E2E spec files — zero critical
   violations
5. Confirm all accessibility requirements met (aria attributes, keyboard
   navigation)

### 4.2 API-Only or Full-Stack Epics

1. Service unit tests: all branches covered, EventBridge assertions included
2. Controller unit tests: delegation, HTTP codes, DTO passthrough
3. Integration tests (Testcontainers): real DB state verified, auth/403/400/409
   covered
4. API contract tests if endpoint is public: `pnpm test:api`
5. Run `pnpm test:preflight` before integration/API tests

### 4.3 Final Gate (All Epics)

- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm type-check` — zero TypeScript errors
- [ ] `pnpm test` — all unit tests pass, coverage thresholds met
- [ ] All acceptance criteria from the epic file are satisfied
- [ ] No unresolved critical issues or failing assertions
- [ ] `specs/epics-implemented/<epic-file-name>.md` written
- [ ] Epic marked `complete` in `specs/epics/0-epics-index.md`

---

## 5. Story Definition of Done

Standard DoD items for user stories:

- [ ] API endpoint implemented and documented in OpenAPI
- [ ] Frontend component implemented with project design system
- [ ] PingID auth applied to all new endpoints
- [ ] Unit tests passing (≥ 80% coverage)
- [ ] Integration tests passing
- [ ] E2E test covering happy path
- [ ] Code review approved
- [ ] Security checklist passed
- [ ] Acceptance criteria demonstrated

---

## 6. Code Quality Gate (All Changes)

Apply to every change regardless of type:

- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm type-check` — zero TypeScript errors
- [ ] No hardcoded secrets — use Secrets Manager / Parameter Store
- [ ] No dead code or unused imports introduced
- [ ] No `any` types without explicit justification

---

## 7. UI/UX Standards & Best Practices

> Reference when implementing UI. Enforce during review.

### 7.1 Usability

- Clear, actionable error messages — never "Something went wrong" without a next
  step
- Optimistic UI updates where appropriate with rollback on error
- Loading indicators for all async operations > 200ms
- Empty states with helpful guidance (not blank screens)
- Confirmations for destructive actions (modals, not browser `confirm()`)
- Field-level validation feedback inline — do not wait for submit
- Toast/notification placement consistent (top-right or bottom-center — pick
  one)

### 7.2 Navigation Best Practices

- Breadcrumbs for deep page hierarchies (3+ levels)
- Active state clearly indicated in navigation links
- `aria-current="page"` on the active nav link
- Focus managed on route transitions (move focus to main heading or `<main>`)
- Browser back/forward navigation preserved (URL-based state, not component-only
  state)
- 404 page with navigation back to a valid route

### 7.3 Pagination Standards

- URL-based pagination params (`?page=2&limit=25`) — shareable and bookmarkable
- Keyboard-navigable pagination controls with `aria-label` (e.g., "Go to page
  3")
- Show total count and current range: "Showing 26–50 of 143"
- Loading indicator during page transitions
- Preserve sort/filter state across page changes
- Sensible default page sizes (25/50/100); let the user choose
- "Load more" pattern as an alternative to numbered pagination for
  infinite-scroll UIs

### 7.4 Accessibility Standards

> Canonical reference: WCAG 2.1 AA

| Element              | Requirement                                                     |
| -------------------- | --------------------------------------------------------------- |
| Interactive elements | `aria-label` or visible text label                              |
| Form inputs          | `<label htmlFor>` + `id` association                            |
| Loading states       | `aria-busy="true"` + `role="status"`                            |
| Error states         | `role="alert"` + `aria-describedby`                             |
| Icon-only buttons    | `aria-label` on button; icon has `aria-hidden="true"`           |
| Dynamic content      | `aria-live="polite"` region                                     |
| Modals/dialogs       | `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes |
| Tables               | `<caption>`, `<th scope>`, `aria-sort` for sortable columns     |
| Skip links           | "Skip to main content" as first focusable element               |

### 7.5 Testability Standards

- Every interactive element has a stable `data-testid` attribute
- `data-testid` values follow `kebab-case` convention:
  `data-testid="submit-button"`
- Avoid coupling `data-testid` to implementation details (e.g. CSS class names)
- Page Objects (POM) own all `data-testid` lookups — never hardcode in test
  bodies
- MSW handlers mock at the API boundary, not inside components
- Use `renderWithProviders()` for all React component tests requiring React
  Query
- Test IDs survive refactoring — use semantic names, not positional (e.g.,
  `first-item`)

### 7.6 Performance Best Practices

- Avoid unnecessary re-renders: memoize expensive computations with `useMemo`
- Paginate lists > 50 items — never load unbounded datasets
- Images: use `next/image` for automatic optimization and lazy loading
- Code-split large routes with dynamic imports (`next/dynamic`)
- Debounce search inputs (≥ 300ms) to avoid excessive API calls
- Use generated orval hooks — built-in caching via React Query

---

## 8. Standards References

> Load lazily — only what is needed for the current task.

| Topic                                        | Reference                                             |
| -------------------------------------------- | ----------------------------------------------------- |
| UI design system                             | `@.claude/standards/ui-design-standards.md`           |
| Frontend standards                           | `@.claude/standards/frontend-standards.md`            |
| Storybook component library                  | `@.claude/standards/component-usage.md`               |
| Testing (canonical, all layers)              | `@.claude/standards/testing-standards.md`             |
| Playwright E2E                               | `@.claude/standards/playwright-e2e-standards.md`      |
| API / backend                                | `@.claude/standards/api-standards.md`                 |
| Security                                     | `@.claude/standards/security-standards.md`            |
| Database                                     | `@.claude/standards/database-standards.md`            |
| Quality gate                                 | `@.claude/standards/quality-gate-standards.md`        |
| UI protocol (dev server, browser inspection) | `.claude/workflows/frontend-ui-protocol.md`           |
| MSW handler patterns                         | `@.claude/patterns/msw-handler-pattern.md`            |
| Playwright POM pattern                       | `@.claude/patterns/playwright-page-object-pattern.md` |
| Fixture factories                            | `@.claude/patterns/fixture-factory-pattern.md`        |
| Testcontainers integration tests             | `@.claude/patterns/testcontainers-pattern.md`         |

---

> **Unload this file** after completing verification. Retain only a summary of
> any DoD items that failed and require follow-up.
