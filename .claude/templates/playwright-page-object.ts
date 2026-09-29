/**
 * Page Object template — copy and replace {Entity}/{entities}/{feature}
 *
 * Naming convention:
 *   File:  apps/web/e2e/pages/{feature}-{list|form|detail|modal}.page.ts
 *   Class: {Entity}{List|Form|Detail|Modal}Page
 */
import { type Page, type Locator } from '@playwright/test';
// Import Zod type for typed form fill — replace with actual schema path
// import type { Create{Entity}Input } from '@repo/validation';

// ─── List Page ────────────────────────────────────────────────────────────────
export class {Entity}ListPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly newBtn: Locator;
  readonly searchInput: Locator;
  readonly paginationNext: Locator;
  readonly paginationPrev: Locator;
  readonly paginationInfo: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(readonly page: Page) {
    this.heading        = page.getByRole('heading', { name: /{entities}/i });
    this.table          = page.getByRole('table', { name: /{entities}/i });
    this.newBtn         = page.getByTestId('{feature}-new-btn');
    this.searchInput    = page.getByTestId('{feature}-search-input');
    this.paginationNext = page.getByTestId('pagination-next-btn');
    this.paginationPrev = page.getByTestId('pagination-prev-btn');
    this.paginationInfo = page.getByTestId('pagination-info');
    this.loadingSpinner = page.getByTestId('loading-spinner');
    this.emptyState     = page.getByTestId('empty-state-message');
    this.successAlert   = page.getByRole('alert').filter({ hasText: /success/i });
    this.errorAlert     = page.getByRole('alert').filter({ hasText: /error/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/{resources}');
    await this.heading.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async clickNew(): Promise<void> {
    await this.newBtn.click();
    await this.page.waitForURL('**/{resources}/new');
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async goToNextPage(): Promise<void> {
    await this.paginationNext.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Row helpers
  getRow(identifier: string): Locator {
    return this.table.getByRole('row', { name: new RegExp(identifier, 'i') });
  }

  getRowByTestId(id: string | number): Locator {
    return this.page.getByTestId(`{feature}-row-${id}`);
  }

  getRowAction(identifier: string, action: string): Locator {
    return this.getRow(identifier).getByTestId(`{feature}-${action}-btn`);
  }
}

// ─── Form Page ────────────────────────────────────────────────────────────────
export class {Entity}FormPage {
  readonly heading: Locator;
  // TODO: add all form field locators
  readonly nameInput: Locator;
  readonly submitBtn: Locator;
  readonly cancelBtn: Locator;
  readonly formErrorSummary: Locator;

  constructor(readonly page: Page) {
    this.heading          = page.getByRole('heading', { name: /create|edit {entity}/i });
    this.nameInput        = page.getByLabel(/name/i);
    this.submitBtn        = page.getByTestId('{feature}-form-submit-btn');
    this.cancelBtn        = page.getByTestId('{feature}-form-cancel-btn');
    this.formErrorSummary = page.getByRole('alert', { name: /form errors/i });
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/{resources}/new');
    await this.heading.waitFor({ state: 'visible' });
  }

  async gotoEdit(id: string): Promise<void> {
    await this.page.goto(`/{resources}/${id}/edit`);
    await this.heading.waitFor({ state: 'visible' });
  }

  async fill(data: { name?: string }): Promise<void> {
    if (data.name !== undefined) await this.nameInput.fill(data.name);
  }

  async submit(): Promise<void> {
    await this.submitBtn.click();
  }

  async fillAndSubmit(data: Parameters<this['fill']>[0]): Promise<void> {
    await this.fill(data);
    await this.submit();
  }

  async cancel(): Promise<void> {
    await this.cancelBtn.click();
    await this.page.waitForURL('**/{resources}');
  }

  getFieldError(fieldLabel: string): Locator {
    return this.page
      .getByLabel(fieldLabel)
      .locator('xpath=ancestor::div[1]')
      .getByRole('alert');
  }
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
export class DeleteConfirmModal {
  readonly dialog: Locator;
  readonly confirmBtn: Locator;
  readonly cancelBtn: Locator;

  constructor(readonly page: Page) {
    this.dialog     = page.getByRole('dialog', { name: /confirm delete/i });
    this.confirmBtn = this.dialog.getByRole('button', { name: /^delete$/i });
    this.cancelBtn  = this.dialog.getByRole('button', { name: /cancel/i });
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
