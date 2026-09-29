# Workflow: Playwright TDD — Test-Driven E2E Development

> **Operating Discipline (always applies).** Follow `@.claude/CLAUDE.md` → Operating Discipline throughout this workflow: never hallucinate paths/APIs/versions, never assume intent to fill a gap, never implement unrequested scope, clarify ambiguities before acting, and get **explicit human approval** before anything hard-to-reverse or beyond the stated request. Report faithfully what was done, skipped, or failed.


Use this workflow when building a NEW feature to write E2E tests BEFORE
(or alongside) implementation.

## When to Use This Workflow

- Starting a new feature page or flow
- Implementing a new form with validation
- Adding a new user-facing CRUD module

## Workflow Steps

### Step 1 — Write failing Page Object

Before any component exists, write the Page Object based on the
planned UI structure:

```typescript
// apps/web/e2e/pages/invoices-list.page.ts
// Written BEFORE the component exists
export class InvoicesListPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly newInvoiceBtn: Locator;

  constructor(readonly page: Page) {
    this.heading      = page.getByRole('heading', { name: /invoices/i });
    this.table        = page.getByRole('table', { name: /invoices/i });
    this.newInvoiceBtn = page.getByTestId('new-invoice-btn');
  }

  async goto() {
    await this.page.goto('/invoices');
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }
}
```

The Page Object defines your component's required `data-testid` contract.

### Step 2 — Write failing smoke tests

```typescript
test('displays invoice list @smoke', async ({ authenticatedPage }) => {
  const page = authenticatedPage;
  const listPage = new InvoicesListPage(page);
  await listPage.goto();
  await expect(listPage.heading).toBeVisible();
  await expect(listPage.table).toBeVisible();
});
```

Run: `npx playwright test invoices.spec.ts --reporter=line`
Expected: ❌ FAIL (component doesn't exist yet)

### Step 3 — Implement the component

Implement the NextJS component, ensuring:
- All `data-testid` attributes from the Page Object are present
- Semantic HTML matches the `getByRole` queries in the Page Object
- Accessible labels match the `getByLabel` queries

### Step 4 — Run tests (should be green now)

```bash
npx playwright test invoices.spec.ts --reporter=line
```

Expected: ✅ PASS

### Step 5 — Expand test coverage

With smoke tests passing, add full coverage:
- Validation tests
- Error state tests
- Edge case tests

### Step 6 — Run /playwright-ui-audit to verify quality

```
/playwright-ui-audit apps/web/e2e/features/invoices
```

## Benefits

- Page Objects define the `data-testid` contract BEFORE implementation
- Forces accessible HTML from the start
- Tests document expected behaviour as specification
- No retrofitting tests onto existing components

## Token Optimization

- **Load when**: building a new user-facing flow or page with E2E coverage requirement.
- **Load only**: `playwright-e2e-standards.md`, `playwright-page-object-pattern.md`, `playwright-fixture-pattern.md`, plus the relevant POM template.
- **Unload after**: failing E2E test drives implementation green; baseline POM committed.
- **Hand-off to**: `frontend-developer` for component implementation, `test-engineer` for unit-level coverage.
