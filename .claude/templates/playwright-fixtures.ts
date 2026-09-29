/**
 * Playwright fixtures template — copy to apps/web/e2e/fixtures/
 * See .claude/patterns/playwright-fixture-pattern.md for full docs
 */
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as authTest, expect as authExpect } from './auth.fixture';
import { test as mockTest, expect as mockExpect } from './api-mock.fixture';
export { test as authTest } from './auth.fixture';
export { test as mockTest } from './api-mock.fixture';

/**
 * Merged test — provides both `authenticatedPage` and `mockApi` fixtures.
 * Import { test, expect } from this file in ALL spec files.
 */
export const test = mergeTests(authTest, mockTest);
export const expect = mergeExpects(authExpect, mockExpect);
