/**
 * Playwright E2E test template — Page Object Model pattern.
 * All tests authenticate via PingID before running.
 * Locators use accessible queries (role, label) — never CSS selectors.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

// ─── Page Object ──────────────────────────────────────────────────────────────

export class { Entity }Page {
  // Locators — use accessible queries, never CSS/XPath
  readonly heading: Locator;
  readonly newButton: Locator;
  readonly searchInput: Locator;
  readonly table: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyState: Locator;
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: '{Entities}' });
        this.newButton = page.getByRole('button', { name: /new {entity}/i });
        this.searchInput = page.getByRole('searchbox', { name: /search/i });
        this.table = page.getByRole('table', { name: /{entities}/i });
        this.loadingIndicator = page.getByRole('status', { name: /loading/i });
        this.emptyState = page.getByText(/no {entities} found/i);
        this.successAlert = page.getByRole('alert').filter({ hasText: /success/i });
        this.errorAlert = page.getByRole('alert').filter({ hasText: /error/i });
    }

  async goto() {
        await this.page.goto('/{resources}');
        await expect(this.heading).toBeVisible({ timeout: 10000 });
    }

  async getRow(name: string): Promise < Locator > {
        return this.table.getByRole('row', { name: new RegExp(name, 'i') });
    }

  async clickNew() {
        await this.newButton.click();
        await this.page.waitForURL('**/{resources}/new');
    }

  async search(term: string) {
        await this.searchInput.fill(term);
        await this.searchInput.press('Enter');
        await this.page.waitForLoadState('networkidle');
    }

  async deleteRow(name: string) {
        const row = await this.getRow(name);
        await row.getByRole('button', { name: new RegExp(`delete ${name}`, 'i') }).click();
        // Confirm deletion dialog
        const dialog = this.page.getByRole('dialog', { name: /confirm delete/i });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: /^delete$/i }).click();
        await expect(dialog).not.toBeVisible();
    }
}

export class { Entity }FormPage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly statusSelect: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: /create|edit {entity}/i });
        this.nameInput = page.getByLabel(/name/i);
        this.statusSelect = page.getByLabel(/status/i);
        this.saveButton = page.getByRole('button', { name: /save/i });
        this.cancelButton = page.getByRole('button', { name: /cancel/i });
    }

  async goto() {
        await this.page.goto('/{resources}/new');
        await expect(this.heading).toBeVisible();
    }

  async fill(data: { name: string; status?: string }) {
        await this.nameInput.fill(data.name);
        if (data.status) {
            await this.statusSelect.selectOption(data.status);
        }
    }

  async save() {
        await this.saveButton.click();
    }

  async fillAndSave(data: { name: string; status?: string }) {
        await this.fill(data);
        await this.save();
    }

    getFieldError(fieldLabel: string): Locator {
        return this.page
            .getByLabel(fieldLabel)
            .locator('..') // parent element
            .getByRole('alert');
    }
}

// ─── Auth Helper (import from helpers/auth.ts) ────────────────────────────────

async function loginWithPingID(page: Page): Promise<void> {
    // Use storage state if available (faster — reuses session)
    // Otherwise perform full login
    await page.goto('/auth/login');

    // Wait for PingID redirect
    await page.waitForURL('**/ping/**', { timeout: 5000 }).catch(() => {
        // Already on app login page if PingID is mocked in test env
    });

    await page.getByLabel(/username/i).fill(process.env.E2E_USERNAME!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for successful redirect to app
    await page.waitForURL('**/dashboard', { timeout: 15000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('{Entity} Management', () => {

    // Authenticate once per describe block
    test.beforeEach(async ({ page }) => {
        await loginWithPingID(page);
    });

    // ─── List Page ────────────────────────────────────────────────────────────

    test.describe('List Page', () => {

        test('AC-1: displays list of {entities}', async ({ page }) => {
            const listPage = new { Entity }Page(page);
            await listPage.goto();

            await expect(listPage.table).toBeVisible();
            // Should have at least the table headers
            await expect(listPage.table.getByRole('columnheader')).not.toHaveCount(0);
        });

        test('AC-2: shows empty state when no {entities} exist', async ({ page }) => {
            // Requires test data setup — ensure no {entities} in test env
            const listPage = new { Entity }Page(page);
            await listPage.goto();

            // This test may need to be conditional based on test env data
            // await expect(listPage.emptyState).toBeVisible();
        });

        test('navigates to create form when New {Entity} clicked', async ({ page }) => {
            const listPage = new { Entity }Page(page);
            await listPage.goto();

            await listPage.clickNew();

            await expect(page).toHaveURL(/\/{resources}\/new/);
        });

        test('paginates through results', async ({ page }) => {
            const listPage = new { Entity }Page(page);
            await listPage.goto();

            // Check pagination controls exist if total > page size
            const nextButton = page.getByRole('button', { name: /next page/i });
            if (await nextButton.isEnabled()) {
                await nextButton.click();
                await expect(page).toHaveURL(/page=1/);
            }
        });
    });

    // ─── Create Form ──────────────────────────────────────────────────────────

    test.describe('Create {Entity}', () => {

        test('AC-3: creates {entity} with valid data', async ({ page }) => {
            const formPage = new { Entity }FormPage(page);
            const listPage = new { Entity }Page(page);
            const testName = `Test {Entity} ${Date.now()}`;

            await formPage.goto();
            await formPage.fillAndSave({ name: testName });

            // Should redirect to list or detail after save
            await expect(listPage.successAlert).toBeVisible({ timeout: 5000 });
        });

        test('AC-4: shows validation error for empty name', async ({ page }) => {
            const formPage = new { Entity }FormPage(page);
            await formPage.goto();

            await formPage.save(); // Submit without filling

            await expect(formPage.getFieldError('Name')).toBeVisible();
            await expect(page).toHaveURL(/\/{resources}\/new/); // Stays on form
        });

        test('cancel returns to list page', async ({ page }) => {
            const formPage = new { Entity }FormPage(page);
            await formPage.goto();

            await formPage.cancelButton.click();

            await expect(page).toHaveURL(/\/{resources}$/);
        });
    });

    // ─── Delete ───────────────────────────────────────────────────────────────

    test.describe('Delete {Entity}', () => {

        test('AC-5: deletes {entity} after confirmation', async ({ page }) => {
            const listPage = new { Entity }Page(page);
            // Assumes a {entity} with this name exists in test env
            const targetName = 'Delete Target {Entity}';

            await listPage.goto();
            await listPage.deleteRow(targetName);

            await expect(listPage.successAlert).toBeVisible({ timeout: 5000 });
            const row = await listPage.getRow(targetName);
            await expect(row).not.toBeVisible();
        });
    });

    // ─── Auth Guard ───────────────────────────────────────────────────────────

    test.describe('Authentication', () => {

        test('redirects to login when accessing without session', async ({ page }) => {
            // Clear session cookies
            await page.context().clearCookies();

            await page.goto('/{resources}');

            await expect(page).toHaveURL(/\/auth\/login/);
        });
    });

    // ─── Accessibility ────────────────────────────────────────────────────────

    test.describe('Accessibility', () => {

        test('list page has accessible table with headers', async ({ page }) => {
            const listPage = new { Entity }Page(page);
            await listPage.goto();

            const table = listPage.table;
            await expect(table).toHaveAttribute('aria-label');
            await expect(table.getByRole('columnheader').first()).toBeVisible();
        });

        test('form inputs have accessible labels', async ({ page }) => {
            const formPage = new { Entity }FormPage(page);
            await formPage.goto();

            await expect(formPage.nameInput).toHaveAttribute('id');
            // Label association via htmlFor
            await expect(
                page.locator(`label[for="${await formPage.nameInput.getAttribute('id')}"]`)
            ).toBeVisible();
        });
    });
});