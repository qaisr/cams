/**
 * API mock helpers for Playwright tests.
 * Import and use inside tests or Page Objects for API interception.
 */
import type { Page } from '@playwright/test';

/**
 * Block all analytics, logging, and asset requests to speed up tests.
 * Call once in beforeEach or a fixture.
 */
export async function blockNonEssentialRequests(page: Page): Promise<void> {
  await page.route(
    /\.(png|jpg|jpeg|gif|svg|woff|woff2|ico|css)(\?.*)?$/,
    route => route.abort()
  );
  await page.route(/\/(analytics|tracking|metrics|hotjar|segment)\//, route =>
    route.abort()
  );
}

/**
 * Intercept an API call and return mock data.
 * Returns the number of times the route was matched.
 */
export async function mockGetEndpoint<T>(
  page: Page,
  urlPattern: string,
  data: T,
  options: { status?: number; delay?: number } = {}
): Promise<() => number> {
  let callCount = 0;
  await page.route(`**${urlPattern}**`, async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    callCount++;
    if (options.delay) await new Promise(r => setTimeout(r, options.delay));
    await route.fulfill({
      status: options.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  return () => callCount;
}

/**
 * Simulate a paginated list endpoint.
 * Intercepts GET requests and returns the appropriate page slice.
 */
export async function mockPaginatedEndpoint<T extends { id: string }>(
  page: Page,
  urlPattern: string,
  allItems: T[]
): Promise<void> {
  await page.route(`**${urlPattern}**`, route => {
    const url = new URL(route.request().url());
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const pageNum = parseInt(url.searchParams.get('page') ?? '0', 10);
    const skip = offset || pageNum * limit;
    const items = allItems.slice(skip, skip + limit);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        total: allItems.length,
        page: pageNum,
        limit,
      }),
    });
  });
}

/**
 * Assert that an endpoint was called with specific request body.
 * Use BEFORE the action that triggers the request.
 */
export function expectApiCall(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  urlPattern: string
) {
  return page.waitForRequest(
    req =>
      req.method() === method &&
      req.url().includes(urlPattern),
    { timeout: 10_000 }
  );
}

/**
 * Factory: generate mock list response matching standard API contract.
 */
export function mockListResponse<T>(
  items: T[],
  overrides: { total?: number; page?: number; limit?: number } = {}
) {
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 0,
    limit: overrides.limit ?? 20,
  };
}
```

---

## 11. `apps/web/e2e/helpers/auth.ts`

```typescript
/**
 * Authentication helpers for Playwright tests.
 * These are used by global-setup.ts to generate auth state files.
 * Individual tests should use the authenticatedPage fixture instead.
 */
import { type Page, expect } from '@playwright/test';

export type UserRole = 'superadmin' | 'admin' | 'viewer' | 'readonly';

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  viewer:     'Viewer',
  readonly:   'Read Only',
};

/**
 * Authenticate via the mock login page (/login-mock).
 * Used in global-setup to generate stored auth states.
 *
 * Do NOT call this in individual tests — use the authenticatedPage fixture.
 */
export async function authenticateAs(page: Page, role: UserRole): Promise<void> {
  const displayName = ROLE_DISPLAY_NAMES[role];

  await page.goto('/login-mock');
  await expect(
    page.getByRole('heading', { name: /select user/i })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByText(displayName, { exact: false }).click();
  await page.waitForURL('**/secure', { timeout: 15_000 });
}

/**
 * Clear all auth state from the browser context.
 * Use to test unauthenticated / session-expired scenarios.
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.context().clearPermissions();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Verify the current page is the authenticated home (/secure).
 * Called after login to confirm successful authentication.
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/secure/, { timeout: 15_000 });
}

/**
 * Verify the current page redirected to login (session expired / no auth).
 */
export async function expectRedirectedToLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}
