import { test, expect } from "@playwright/test";
import { AuthPage } from "./pages/AuthPage";
// import { supabase } from "./utils/supabase";

test.describe("Authentication Flow", () => {
  test.describe.configure({ mode: "serial" });

  test("should allow user to login and logout", async ({ page }) => {
    const authPage = new AuthPage(page);
    const email = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      test.skip(true, "E2E credentials not found in environment variables");
      return;
    }

    // Navigate to login page
    await authPage.gotoLogin();

    // Perform login
    await authPage.login(email, password);

    // Check for error messages if URL is not home
    try {
      await expect(page).toHaveURL("/", { timeout: 5000 });
    } catch (e) {
      const errorVisible = await authPage.errorMessage.isVisible();
      if (errorVisible) {
        const errorText = await authPage.errorMessage.innerText();
        // console.error(`Login failed with error: ${errorText}`);
        throw new Error(`Login failed: ${errorText}`);
      }
      throw e;
    }

    // Verify user is logged in (check for Logout button or user greeting)
    // utilizing first() to avoid strict mode violation if multiple elements exist (e.g. mobile menu)
    await expect(page.getByRole("button", { name: /logout/i }).first()).toBeVisible();

    // Optional: Verify user email/name is displayed
    // The header displays "Hi, {username}". We use first() to avoid ambiguity with mobile menu
    await expect(page.getByText(`Hi,`).first()).toBeVisible();

    // Perform Logout
    // Use first() to target the visible logout button in desktop header
    await page
      .getByRole("button", { name: /logout/i })
      .first()
      .click();

    // Verify redirected to login or home (depending on app behavior)
    // Usually logout keeps you on the page or goes to home/login.
    // Let's assume it reloads or stays on home but without auth.
    // Checking for Login button again.
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });

  test.afterAll(async () => {
    // Teardown mechanism: Ensure Supabase client is clean or log teardown
    // console.log("Teardown: Authentication tests completed.");
    // If we had created data in Supabase, we would clean it up here using the supabase client.
    // Example: await supabase.from('users').delete().eq('email', 'temp@example.com');
  });
});
