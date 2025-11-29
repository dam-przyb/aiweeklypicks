/**
 * Example E2E Test
 * 
 * This file demonstrates basic E2E testing patterns with Playwright.
 * Following guidelines from .cursor/rules/testing-e2e-playwright.mdc
 */

import { test, expect } from "@playwright/test";
import { HomePage } from "./pages/HomePage";

test.describe("Home Page", () => {
  test("should load the home page successfully", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Verify page loaded
    await expect(page).toHaveTitle(/AI Weekly Picks/i);
  });

  test("should display the main heading", async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Verify heading is visible
    await expect(homePage.heading).toBeVisible();
  });

  test("should navigate to reports page", async ({ page }) => {
    await page.goto("/");

    // Click on a navigation link
    const reportsLink = page.getByRole("link", { name: /reports/i }).first();
    if (await reportsLink.isVisible()) {
      await reportsLink.click();
      // Verify navigation occurred
      await expect(page).toHaveURL(/reports/);
    }
  });
});

test.describe("Visual Regression", () => {
  test("should match home page screenshot", async ({ page }) => {
    await page.goto("/");
    
    // Wait for content to load
    await page.waitForLoadState("networkidle");
    
    // Take screenshot and compare (uncomment when baseline is established)
    // await expect(page).toHaveScreenshot("home-page.png");
  });
});

