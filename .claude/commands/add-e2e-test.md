---
name: add-e2e-test
description: >
  Generate Playwright E2E tests using Page Object Model + PingID auth fixtures.
  Activated by /add-e2e-test. Unload after test generation is complete.
version: 2.0.0
agent: test-engineer
subtask: true
arguments:
  - name: TARGET
    required: true
    examples:
      - "apps/web/src/features/invoices"
      - "apps/web/app/(protected)/users/page.tsx"
      - "the invoice creation flow covering US-042"
  - name: coverage
    required: false
    description: "smoke (happy path only, default) | full (+ edge cases, error states, every Zod rule) | accessibility (WCAG audit + keyboard nav)"
    examples:
      - "--coverage=full"
      - "--coverage=accessibility"
---

# E2E Test Generation (Playwright)

> Standards: `@.claude/standards/playwright-e2e-standards.md`
> Pattern: `@.claude/patterns/playwright-page-object-pattern.md`
> Fixtures: `@.claude/patterns/playwright-fixture-pattern.md`
> Workflow (TDD): `@.claude/workflows/playwright-tdd-workflow.md`
> Auth helpers: `apps/web/e2e/helpers/auth.ts`

## Input

$ARGUMENTS

---

## Step 0 — Preflight

```bash
pnpm test:preflight --scope=e2e
```

Verify Postgres + API + Frontend are running. Stop and report if not.

---

## Step 1 — Read Context

```bash
# Read referenced component/page
cat $TARGET_FILE

# Check existing E2E tests
find apps/web/e2e -name "*.spec.ts" | grep -i "{feature}"

# Check existing Page Objects
ls apps/web/e2e/pages/ 2>/dev/null

# Read Zod validation schemas for form fields
find packages/validation/src -name "*.ts" | xargs grep -l "{entity}" | head -3 | xargs cat

# Read orval-generated API hooks for endpoint/response shapes
find apps/web/src/hooks/generated -name "*.ts" | xargs grep -l "{entity}" | head -2 | xargs cat
```

---

## Step 2 — Plan Test Scenarios

Map to scenarios:

- Happy path (complete user flow)
- Validation error path (required fields, format errors)
- Permission / auth scenario (viewer vs editor)
- Empty state scenario
- Pagination (if list)
- Accessibility: keyboard navigation, ARIA roles

---

## Step 3 — Generate Page Object

File: `apps/web/e2e/pages/{feature}-{view}.page.ts`

Follow `@.claude/patterns/playwright-page-object-pattern.md`:

```typescript
import { type Page, type Locator, expect } from '@playwright/test';

export class {Feature}Page {
  // ── ALL locators readonly, defined in constructor ──────────────────────────
  readonly heading: Locator;
  readonly submitBtn: Locator;
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(readonly page: Page) {
    this.heading     = page.getByRole('heading', { name: /{feature}/i });
    this.submitBtn   = page.getByTestId('{feature}-submit-btn');
    this.successAlert = page.getByRole('alert').filter({ hasText: /success/i });
    this.errorAlert   = page.getByRole('alert').filter({ hasText: /error/i });
  }

  /** Navigate to page and wait for heading — NEVER resolves on redirect */
  async goto() {
    await this.page.goto('/{route}');
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  // ── Actions — NO assertions in Page Object methods ────────────────────────
  async fillForm(data: { name: string }) {
    await this.page.getByLabel('Name').fill(data.name);
  }

  async submit() {
    await this.submitBtn.click();
  }
}
```

**Rules:**
- Use `getByTestId` for interactive elements, `getByRole` for semantic elements
- NEVER define assertions inside Page Object methods
- ALL locators `readonly` and defined in constructor

---

## Step 4 — Generate Test Spec

File: `apps/web/e2e/features/{feature}/{feature}.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { {Feature}Page } from '../../pages/{feature}.page';

test.describe('{Feature}', () => {
  let featurePage: {Feature}Page;

  test.beforeEach(async ({ page }) => {
    featurePage = new {Feature}Page(page);
    await featurePage.goto();
  });

  test('displays list correctly @smoke', async () => {
    await expect(featurePage.heading).toBeVisible();
    // ...
  });

  test('shows validation error for empty required fields', async ({ page }) => {
    await featurePage.submit();
    await expect(page.getByRole('alert')).toContainText(/required/i);
  });

  test('succeeds with valid input and shows confirmation', async () => {
    await featurePage.fillForm({ name: 'Test Record' });
    await featurePage.submit();
    await expect(featurePage.successAlert).toBeVisible();
  });
});
```

---

## Step 5 — Check Auth Setup

Use `apps/web/e2e/helpers/auth.ts` for mock authentication.
Use `apps/web/e2e/fixtures/auth.fixture.ts` for authenticated Playwright fixtures.
Do NOT hardcode credentials or re-implement auth logic.

---

## Step 6 — Run Tests

```bash
npx playwright test apps/web/e2e/features/{feature}/{feature}.spec.ts --reporter=line
```

On failure: capture screenshot, read trace, diagnose and fix before finishing.

---

## Step 7 — Back-fill Missing data-testid Attributes

For every `getByTestId('x')` in the generated tests, verify `data-testid="x"` exists
in the corresponding component. Add any missing attributes to the components so the
tests resolve against real selectors.

## Step 8 — Quality Check

Run `/playwright-ui-audit apps/web/e2e/features/{feature}/` to verify the generated tests
pass all Playwright best-practice rules before completing.

## Cross-References

- Unit tests: `/add-unit-test`
- Stories (acceptance criteria): `.claude/docs/stories-*.md`
- Standards: `@.claude/standards/testing-standards.md`
- Playwright config: `frontend/playwright.config.ts`
