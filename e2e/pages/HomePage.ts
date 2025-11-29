/**
 * Home Page Object Model
 * 
 * Page Object Model for the home page.
 * Encapsulates page interactions for maintainable E2E tests.
 */

import { Page, Locator } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly reportsSection: Locator;
  readonly navigationLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
    this.reportsSection = page.locator('[data-testid="reports-list"]');
    this.navigationLinks = page.locator("nav a");
  }

  async goto() {
    await this.page.goto("/");
  }

  async getReportCards() {
    return this.page.locator('[data-testid="report-card"]').all();
  }

  async clickFirstReport() {
    const firstReport = this.page.locator('[data-testid="report-card"]').first();
    await firstReport.click();
  }

  async navigateToPicksTable() {
    await this.page.getByRole("link", { name: /picks/i }).click();
  }
}

