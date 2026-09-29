# Pattern: Playwright Page Object Model

## Overview

The Page Object Model (POM) abstracts UI interactions into reusable classes,
keeping test files clean and making maintenance easy when UI changes.

## Structure

```
apps/web/e2e/pages/
├── {feature}-list.page.ts      # List/index view
├── {feature}-form.page.ts      # Create/edit form
├── {feature}-detail.page.ts    # Detail/view page
└── {feature}-modal.page.ts     # Modals (if complex enough)
```

## Canonical Implementation

```typescript
// apps/web/e2e/pages/users-form.page.ts
import { type Page, type Locator } from '@playwright/test';

// Import the Zod schema to type form data — single source of truth
import type { CreateUserInput } from '@repo/validation';

export class UsersFormPage {
  // ── Locators ────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly activeCheckbox: Locator;
  readonly submitBtn: Locator;
  readonly cancelBtn: Locator;
  readonly formErrorSummary: Locator;

  constructor(readonly page: Page) {
    // Use getByLabel for form inputs — ties to accessible label, not testid
    this.heading       = page.getByRole('heading', { name: /create user|edit user/i });
    this.nameInput     = page.getByLabel(/full name/i);
    this.emailInput    = page.getByLabel(/email address/i);
    this.roleSelect    = page.getByLabel(/role/i);
    this.activeCheckbox = page.getByLabel(/active/i);
    this.submitBtn     = page.getByTestId('user-form-submit-btn');
    this.cancelBtn     = page.getByTestId('user-form-cancel-btn');
    this.formErrorSummary = page.getByRole('alert', { name: /form errors/i });
  }

  // ── Navigation ──────────────────────────────────────────────────
  async gotoCreate(): Promise<void> {
    await this.page.goto('/users/new');
    await this.heading.waitFor({ state: 'visible' });
  }

  async gotoEdit(userId: string): Promise<void> {
    await this.page.goto(`/users/${userId}/edit`);
    await this.heading.waitFor({ state: 'visible' });
  }

  // ── Actions ─────────────────────────────────────────────────────

  /** Fill form fields. Only fills provided fields (supports partial update). */
  async fill(data: Partial<CreateUserInput>): Promise<void> {
    if (data.name !== undefined)  await this.nameInput.fill(data.name);
    if (data.email !== undefined) await this.emailInput.fill(data.email);
    if (data.role !== undefined)  await this.roleSelect.selectOption(data.role);
    if (data.active !== undefined) {
      const isChecked = await this.activeCheckbox.isChecked();
      if (data.active !== isChecked) await this.activeCheckbox.click();
    }
  }

  async submit(): Promise<void> {
    await this.submitBtn.click();
  }

  async fillAndSubmit(data: Partial<CreateUserInput>): Promise<void> {
    await this.fill(data);
    await this.submit();
  }

  async cancel(): Promise<void> {
    await this.cancelBtn.click();
    await this.page.waitForURL('**/users');
  }

  // ── Field error helpers ──────────────────────────────────────────

  /** Get the error message element for a specific field label. */
  getFieldError(fieldLabel: string): Locator {
    // Assumes error is rendered adjacent to field in a [role="alert"] or
    // with a data-testid of {field-name}-error
    return this.page
      .getByLabel(fieldLabel)
      .locator('xpath=ancestor::div[1]')
      .getByRole('alert');
  }

  /** Get all visible field errors */
  getAllFieldErrors(): Locator {
    return this.page.getByRole('alert').filter({ hasNotText: /success/i });
  }
}
```

## When to Create a Separate Modal Page Object

Create a separate `{feature}-modal.page.ts` when a modal:
- Has more than 3 interactive elements
- Is reused across multiple spec files
- Has its own form validation

```typescript
// apps/web/e2e/pages/delete-confirm-modal.page.ts
export class DeleteConfirmModal {
  readonly dialog: Locator;
  readonly confirmBtn: Locator;
  readonly cancelBtn: Locator;
  readonly entityName: Locator;

  constructor(readonly page: Page) {
    this.dialog     = page.getByRole('dialog', { name: /confirm delete/i });
    this.confirmBtn = this.dialog.getByRole('button', { name: /^delete$/i });
    this.cancelBtn  = this.dialog.getByRole('button', { name: /cancel/i });
    this.entityName = this.dialog.getByTestId('delete-target-name');
  }

  async confirm(): Promise<void> {
    await this.confirmBtn.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  async cancel(): Promise<void> {
    await this.cancelBtn.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
```

## Composition Pattern (Complex Pages)

```typescript
// Large pages can compose multiple sub-objects
export class DashboardPage {
  readonly statsPanel: StatsPanel;
  readonly activityFeed: ActivityFeed;
  readonly quickActions: QuickActions;

  constructor(readonly page: Page) {
    this.statsPanel   = new StatsPanel(page);
    this.activityFeed = new ActivityFeed(page);
    this.quickActions = new QuickActions(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.getByTestId('dashboard-ready')).toBeVisible();
  }
}

class StatsPanel {
  readonly container: Locator;
  readonly totalUsers: Locator;
  readonly activeInvoices: Locator;

  constructor(page: Page) {
    this.container      = page.getByTestId('stats-panel');
    this.totalUsers     = page.getByTestId('stat-total-users');
    this.activeInvoices = page.getByTestId('stat-active-invoices');
  }
}
```

## Token Optimization

**Load when** when writing Playwright Page Objects or refactoring locators. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
