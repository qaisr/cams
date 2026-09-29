---
model: @bedrock-eus1/us.anthropic.claude-sonnet-5
reasoning_effort: high
---

# Command: playwright-ui-audit

Audit existing Playwright tests against best practices, fix violations in-place,
back-fill missing `data-testid` attributes in NextJS components, then validate
by running the affected tests.

## Usage

```
/playwright-ui-audit [path]
```

**Default path:** `apps/web`

**Examples:**
```
/playwright-ui-audit
/playwright-ui-audit apps/web/e2e/pipeline.spec.ts
/playwright-ui-audit apps/web/e2e/features/users/
```

---

## Agent Role

You are a **Senior Test Engineer** with deep expertise in Playwright, NextJS, and
accessibility-first test design. You audit, fix, and validate — never just report.

---

## EXECUTION PROTOCOL

### PHASE 0 — Scope Resolution

```typescript
// If path argument is a .spec.ts file → audit that single file
// If path argument is a directory    → audit all *.spec.ts within it (recursive)
// If no argument                     → audit apps/web/e2e/**/*.spec.ts
```

Emit a scope summary before proceeding:
```
📋 AUDIT SCOPE
──────────────
Files: 12 spec files
Path:  apps/web/e2e/
```

---

### PHASE 1 — Static Analysis (Read all spec files)

For each spec file, check ALL of the following. Track every violation with its
file path, line number, and severity.

#### 1.1 Selector Strategy Violations

| Rule | Severity | Bad Example | Good Example |
|------|----------|-------------|--------------|
| CSS class selectors | 🔴 CRITICAL | `.locator('.btn-primary')` | `.getByTestId('submit-btn')` |
| XPath selectors | 🔴 CRITICAL | `.locator('//div/button')` | `.getByRole('button', { name: /submit/i })` |
| nth-child / index selectors | 🔴 CRITICAL | `.locator('li:nth-child(2)')` | `.getByTestId('item-row').nth(1)` |
| Tag-only selectors | 🔴 CRITICAL | `.locator('button').click()` | `.getByRole('button', { name: /…/i })` |
| Chained `.locator().locator()` depth > 2 | 🟡 WARNING | `page.locator('div').locator('ul').locator('li')` | `.getByTestId('list-item')` |
| Fragile text selectors (exact strings) | 🟡 WARNING | `.getByText('Submit Form')` | `.getByRole('button', { name: /submit/i })` |
| ID selectors | 🟡 WARNING | `.locator('#submit-btn')` | `.getByTestId('submit-btn')` |

**Selector priority to enforce:**
```
1. getByTestId  — for interactive elements unique to a feature
2. getByRole    — for semantic elements (button, heading, dialog, etc.)
3. getByLabel   — for form inputs
4. getByText    — ONLY for static read-only content, never for actions
5. NEVER        — CSS classes, XPath, nth-child, tag-only
```

#### 1.2 Timing & Waiting Violations

| Rule | Severity |
|------|----------|
| `page.waitForTimeout()` / `setTimeout` / `sleep` | 🔴 CRITICAL |
| Missing `waitUntil` on navigation to CSR routes | 🟡 WARNING |
| Raw `await page.click()` without subsequent assertion or wait | 🟡 WARNING |
| Missing `waitForResponse` after form submit to API | 🟡 WARNING |
| Hardcoded `timeout` values in assertions (< 3000ms) | 🟡 WARNING |

#### 1.3 Page Object Model Violations

| Rule | Severity |
|------|----------|
| Inline locators defined inside `test()` blocks (not in Page Object) | 🟡 WARNING |
| Page Object methods that contain `expect()` assertions | 🟡 WARNING |
| Page Object locators defined as `string` not `Locator` | 🔴 CRITICAL |
| Page Object constructor not using `readonly` locators | 🟡 WARNING |
| Locators defined as methods returning `Locator` but called without `()` | 🔴 CRITICAL |
| Page Objects NOT stored in `apps/web/e2e/pages/` | 🟡 WARNING |
| Missing `goto()` method in Page Object | 🟡 WARNING |

#### 1.4 Test Structure & Naming Violations

| Rule | Severity |
|------|----------|
| Test name does not describe user behaviour (e.g., `'test 1'`, `'check it'`) | 🟡 WARNING |
| `test.describe` block missing | 🟡 WARNING |
| `test.beforeEach` not used for repeated setup | 🟡 WARNING |
| Hard-coded test data (names, emails, IDs) without `@faker-js/faker` | 🟡 WARNING |
| Dependent tests NOT in `test.describe.serial` | 🔴 CRITICAL |
| `test.only` or `test.skip` committed without `// TODO:` comment | 🟡 WARNING |
| No `@smoke`, `@regression`, or `@accessibility` tag on any tests | ℹ️ INFO |

#### 1.5 Assertion Quality Violations

| Rule | Severity |
|------|----------|
| `expect(x).toBeTruthy()` on a Locator (use Playwright assertions) | 🔴 CRITICAL |
| `expect(await page.locator(…).textContent())` (not auto-retrying) | 🔴 CRITICAL |
| Missing assertion after navigation | 🟡 WARNING |
| `expect(x).toEqual(true)` instead of `expect(x).toBe(true)` | ℹ️ INFO |
| No soft assertions for multi-field form validation tests | ℹ️ INFO |

#### 1.6 Missing `data-testid` Coverage

For every `getByTestId('some-id')` call found in spec files:

1. Search `apps/web/src/**/*.tsx` and `apps/web/app/**/*.tsx` for `data-testid="some-id"`
2. If NOT found in any component → flag as **MISSING TESTID**
3. Record: `{ testId: string, specFile: string, specLine: number, componentFile: string | null }`

---

### PHASE 2 — Audit Report

Emit a structured report BEFORE making any changes:

```
╔══════════════════════════════════════════════════════════════╗
║           PLAYWRIGHT AUDIT REPORT                            ║
╠══════════════════════════════════════════════════════════════╣
║  Files Audited:     12                                       ║
║  Total Violations:  34                                       ║
║  🔴 Critical:        8                                       ║
║  🟡 Warnings:       19                                       ║
║  ℹ️  Info:            7                                       ║
║  Missing test IDs:   5                                       ║
╚══════════════════════════════════════════════════════════════╝

🔴 CRITICAL VIOLATIONS
──────────────────────
1. [CSS Selector] apps/web/e2e/features/users/users.spec.ts:34
   await page.locator('.action-button').click();
   → Fix: await page.getByTestId('user-action-btn').click();
   → Component to update: apps/web/src/features/users/UserActions.tsx

2. [waitForTimeout] apps/web/e2e/features/pipeline/pipeline.spec.ts:89
   await page.waitForTimeout(2000);
   → Fix: await expect(page.getByTestId('pipeline-ready')).toBeVisible();

[… all violations listed …]

🟡 WARNING VIOLATIONS
─────────────────────
[… listed …]

🔍 MISSING data-testid ATTRIBUTES
──────────────────────────────────
1. data-testid="user-action-btn"
   Referenced in: users.spec.ts:34
   Likely component: apps/web/src/features/users/UserActions.tsx
   → Need to add: data-testid="user-action-btn"

[… all missing IDs listed …]
```

**PAUSE HERE** — Ask user:
```
Found [N] violations across [M] files.
🔴 Critical: X  |  🟡 Warnings: Y  |  Missing testIDs: Z

Options:
  A) Fix ALL violations automatically
  B) Fix CRITICAL only
  C) Fix specific file: [enter path]
  D) Show me the fix plan first, then confirm

Which option? [A/B/C/D]
```

---

### PHASE 3 — Fix Execution

#### 3.1 Fix Spec File Violations

Apply fixes in this order per file:

**Fix: CSS/XPath selectors → getByTestId or getByRole**

Strategy:
1. If element has a semantic role (button, heading, dialog, link, checkbox, etc.)
   and the name can be inferred from visible text → use `getByRole`
2. If element is an interactive UI element without a unique semantic role
   → use `getByTestId` (and schedule component update in Phase 3.2)
3. If element contains static text only → use `getByText`

```typescript
// Before
await page.locator('.submit-button').click();

// After (if button has visible label)
await page.getByRole('button', { name: /submit/i }).click();

// After (if no reliable visible text, or to be more precise)
await page.getByTestId('form-submit-btn').click();
// → Queue: add data-testid="form-submit-btn" to <button> in component
```

**Fix: waitForTimeout → explicit waits**

```typescript
// Before
await page.waitForTimeout(2000);

// After — use whichever is most appropriate:
await expect(page.getByTestId('content-loaded')).toBeVisible();
// OR
await page.waitForLoadState('networkidle');
// OR
await page.waitForResponse(resp => resp.url().includes('/api/') && resp.status() === 200);
```

**Fix: Inline locators → move to Page Object**

If spec file does NOT have a Page Object:
1. Create `apps/web/e2e/pages/{feature}.page.ts` using the canonical POM template
2. Move all locator definitions into the Page Object constructor
3. Update spec file to instantiate and use the Page Object

If spec file DOES have a Page Object:
1. Move inline locators into the existing Page Object
2. Update all references in tests

**Fix: Test naming**

```typescript
// Before
test('test 1', async ({ page }) => { … });
test('check functionality', async ({ page }) => { … });

// After (derive from what the test actually does)
test('displays error when submitting empty form', async ({ page }) => { … });
test('navigates to detail page when row is clicked', async ({ page }) => { … });
```

**Fix: Add missing assertions after navigation**

```typescript
// Before
await page.goto('/users');
// Test proceeds without verifying page loaded

// After
await page.goto('/users');
await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
```

#### 3.2 Back-fill Missing `data-testid` Attributes in Components

For each missing `data-testid` identified in Phase 1.6:

1. **Locate the component** — search for the element being tested:
   ```bash
   grep -r "submit\|action-button\|{element-hint}" apps/web/src --include="*.tsx" -l
   ```

2. **Identify the correct element** — find the JSX element that the test is targeting

3. **Add `data-testid`** following this convention:
   ```
   {feature}-{element}-{variant?}

   Examples:
   user-submit-btn
   pipeline-status-badge
   invoice-row (on <tr> elements)
   modal-confirm-btn
   search-input
   filter-dropdown
   pagination-next-btn
   empty-state-message
   loading-spinner
   error-alert
   success-alert
   ```

4. **Rule:** Never add `data-testid` to wrapper/layout divs.
   Add them only to:
   - Interactive elements (buttons, inputs, selects, checkboxes)
   - Data display elements referenced in assertions (headings, badges, text)
   - Container elements for list items, rows, cards
   - Loading/error/empty states
   - Modals and dialogs

5. **Preserve existing props** — add `data-testid` without altering other attributes:
   ```tsx
   // Before
   <Button variant="primary" onClick={handleSubmit}>
     Submit
   </Button>

   // After
   <Button
     data-testid="user-form-submit-btn"
     variant="primary"
     onClick={handleSubmit}
   >
     Submit
   </Button>
   ```

6. **For lists/tables** — use dynamic test IDs:
   ```tsx
   // Before
   {users.map(user => (
     <tr key={user.id}>
       <td>{user.name}</td>
     </tr>
   ))}

   // After
   {users.map(user => (
     <tr key={user.id} data-testid={`user-row-${user.id}`}>
       <td data-testid={`user-name-${user.id}`}>{user.name}</td>
     </tr>
   ))}
   ```

   And update the spec to match:
   ```typescript
   // Spec — finding by partial testid for dynamic IDs
   await page.getByTestId(`user-row-${userId}`).click();
   // OR use role-based for non-ID-specific assertions
   await expect(page.getByRole('row', { name: userName })).toBeVisible();
   ```

---

### PHASE 4 — Validation Run

After ALL fixes are applied, run the affected tests:

```bash
# 1. Ensure dev server is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# If not 200:
pnpm start &
npx wait-on http://localhost:3000 --timeout 60000

# 2. Run ONLY the audited/fixed spec files
npx playwright test [file1] [file2] … --reporter=line

# 3. On failure — read output carefully:
#    - Selector not found → re-check data-testid spelling in component vs test
#    - Timeout → element may need different wait strategy
#    - Navigation mismatch → URL pattern may have changed
```

**On test failure:**
1. Read the failure output in full
2. Identify whether the failure is in the spec fix or the component update
3. Apply targeted fix
4. Re-run ONLY the failing test:
   ```bash
   npx playwright test [file] --grep "test name" --reporter=line
   ```
5. Repeat until green

**Do NOT move to the next file until current file is green.**

---

### PHASE 5 — Summary Report

```
╔══════════════════════════════════════════════════════════════╗
║           PLAYWRIGHT AUDIT COMPLETE                          ║
╠══════════════════════════════════════════════════════════════╣
║  Files Fixed:        12                                      ║
║  Violations Fixed:   34                                      ║
║  Components Updated:  5                                      ║
║  Tests Passing:      ✅ 47/47                                ║
╚══════════════════════════════════════════════════════════════╝

CHANGES MADE
────────────
Spec Files Modified:
  ✅ apps/web/e2e/features/users/users.spec.ts       (8 fixes)
  ✅ apps/web/e2e/features/pipeline/pipeline.spec.ts (5 fixes)
  …

Components Updated (data-testid added):
  ✅ apps/web/src/features/users/UserActions.tsx
     → Added: user-action-btn, user-delete-btn, user-edit-btn
  …

Page Objects Created:
  ✅ apps/web/e2e/pages/users.page.ts
  …

REMAINING MANUAL ACTIONS
────────────────────────
⚠️  pipeline.spec.ts:145 — Test requires real API data (no mock available)
    Recommend: add API mock or mark @manual-only
⚠️  auth.spec.ts — PingID flow cannot be fully automated in local env
    Recommend: use storageState fixture (see .claude/patterns/playwright-fixture-pattern.md)
```

---

## Files This Command May Read

- `apps/web/e2e/**/*.spec.ts` — spec files under audit
- `apps/web/e2e/pages/**/*.ts` — existing Page Objects
- `apps/web/src/**/*.tsx` — NextJS components (to find/add data-testid)
- `apps/web/app/**/*.tsx` — NextJS App Router pages
- `.claude/standards/playwright-e2e-standards.md` — enforcement rules
- `.claude/patterns/playwright-page-object-pattern.md` — POM canonical pattern
- `apps/web/playwright.config.ts` — config validation

## Files This Command May Write

- `apps/web/e2e/**/*.spec.ts` — fixed spec files
- `apps/web/e2e/pages/**/*.ts` — new/updated Page Objects
- `apps/web/src/**/*.tsx` — components with added `data-testid`
- `apps/web/app/**/*.tsx` — App Router pages with added `data-testid`
