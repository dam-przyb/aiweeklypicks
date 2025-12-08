/**
 * Auth Fixtures for E2E Tests
 *
 * Provides test fixtures for authentication-related E2E tests
 */

import { test as base } from "@playwright/test";

// Extend the base test with custom fixtures
export const test = base.extend({
  // You can add custom fixtures here, for example:
  // authenticatedPage: async ({ page }, use) => {
  //   // Perform authentication
  //   await page.goto('/auth/login');
  //   await page.fill('[name="email"]', 'test@example.com');
  //   await page.fill('[name="password"]', 'password123');
  //   await page.click('button[type="submit"]');
  //   await page.waitForURL('/');
  //   await use(page);
  // },
});

export { expect } from "@playwright/test";
