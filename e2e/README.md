# E2E Tests

End-to-end tests for AI Weekly Picks using Playwright.

## Directory Structure

```
e2e/
├── fixtures/          # Test fixtures and custom test extensions
│   └── auth.ts       # Authentication fixtures
├── pages/            # Page Object Models
│   ├── HomePage.ts
│   └── AuthPage.ts
└── *.spec.ts         # Test specifications
```

## Page Object Models

Page Object Models (POM) encapsulate page interactions for maintainability:

```typescript
import { HomePage } from "./pages/HomePage";

test("should navigate home", async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  await expect(homePage.heading).toBeVisible();
});
```

## Writing Tests

### Basic Test

```typescript
import { test, expect } from "@playwright/test";

test("should load page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AI Weekly Picks/);
});
```

### Using Page Objects

```typescript
import { HomePage } from "./pages/HomePage";

test("should display reports", async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();

  const reports = await homePage.getReportCards();
  expect(reports.length).toBeGreaterThan(0);
});
```

### Using Fixtures

```typescript
import { test, expect } from "./fixtures/auth";

test("should access protected route", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/admin");
  await expect(authenticatedPage).toHaveURL(/admin/);
});
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e example.spec.ts

# Run in UI mode
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Generate tests
npm run test:e2e:codegen
```

## Debugging

### Interactive Mode

```bash
npm run test:e2e:ui
```

### Debug Mode

```bash
npm run test:e2e:debug
```

### View Trace

```bash
npm run test:e2e:report
```

### Pause in Test

```typescript
test("should debug", async ({ page }) => {
  await page.goto("/");
  await page.pause(); // Opens inspector
});
```

## Best Practices

1. **Use Page Object Models** - Encapsulate page logic
2. **Resilient Locators** - Use roles, labels, text
3. **Wait for Elements** - Don't use fixed timeouts
4. **Independent Tests** - Each test should be isolated
5. **Descriptive Names** - Clear test descriptions
6. **Clean Up** - Use hooks for setup/teardown

## Common Patterns

### Wait for Navigation

```typescript
await Promise.all([page.waitForNavigation(), page.click('a[href="/reports"]')]);
```

### Handle Dialogs

```typescript
page.on("dialog", (dialog) => dialog.accept());
await page.click('button[data-action="delete"]');
```

### Network Interception

```typescript
await page.route("/api/reports", (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ reports: [] }),
  });
});
```

### File Upload

```typescript
await page.setInputFiles('input[type="file"]', "path/to/file.json");
```

## Configuration

See `playwright.config.ts` for:

- Browser settings
- Timeouts
- Screenshots/videos
- Reporters
- Dev server integration

## Resources

- [Playwright Docs](https://playwright.dev/)
- [E2E Guidelines](../.cursor/rules/testing-e2e-playwright.mdc)
- [Testing Guide](../.ai/testing-guide.md)
