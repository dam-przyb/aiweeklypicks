/**
 * Auth Page Object Model
 *
 * Page Object Model for authentication pages (login, register).
 * Encapsulates authentication-related interactions.
 */

import { Page, Locator } from "@playwright/test";

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"], input[type="email"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"], .error-message');
  }

  async gotoLogin() {
    await this.page.goto("/auth/login");
  }

  async gotoRegister() {
    await this.page.goto("/auth/register");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async register(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
