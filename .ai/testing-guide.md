# Testing Guide

This document provides comprehensive guidance for writing and running tests in the AI Weekly Picks project.

## Table of Contents

- [Overview](#overview)
- [Unit Testing with Vitest](#unit-testing-with-vitest)
- [E2E Testing with Playwright](#e2e-testing-with-playwright)
- [Running Tests](#running-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The project uses two complementary testing frameworks:

- **Vitest** for unit and integration tests (fast, isolated tests)
- **Playwright** for end-to-end tests (full browser automation)

## Unit Testing with Vitest

### Configuration

The Vitest configuration is located in `vitest.config.ts`. Key features:

- **jsdom environment** for component tests
- **node environment** for API/service tests (auto-detected by file path)
- **Coverage reporting** with v8 provider
- **Global test utilities** via setup file

### Test Structure

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

describe("ComponentName", () => {
  it("should do something specific", () => {
    // Arrange
    const props = { value: "test" };

    // Act
    render(<ComponentName {...props} />);

    // Assert
    expect(screen.getByText("test")).toBeInTheDocument();
  });
});
```

### Environment Selection

Tests automatically use the appropriate environment:

- **jsdom**: `*.test.tsx` files and React components
- **node**: API routes (`**/pages/api/**/*.test.ts`), services, validation logic

Override per-file with:

```typescript
// @vitest-environment node
```

### Mocking Patterns

#### Function Mocks

```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue("result");
mockFn.mockResolvedValue("async result");
```

#### Module Mocks

```typescript
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));
```

#### Spy on Existing Functions

```typescript
const spy = vi.spyOn(object, "method");
expect(spy).toHaveBeenCalledWith(expectedArg);
```

### Testing React Components

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

it("should handle user interactions", async () => {
  render(<MyComponent />);

  const button = screen.getByRole("button", { name: /submit/i });
  await fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByText("Success")).toBeVisible();
  });
});
```

### Snapshot Testing

Use inline snapshots for readable, version-controlled snapshots:

```typescript
expect(data).toMatchInlineSnapshot(`
  {
    "id": 1,
    "name": "Test",
  }
`);
```

### Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

Coverage is configured to exclude:

- Test files
- Type definitions
- Configuration files
- E2E tests

## E2E Testing with Playwright

### Configuration

The Playwright configuration is located in `playwright.config.ts`. Key features:

- **Chromium only** (Desktop Chrome profile)
- **Parallel execution** for fast test runs
- **Trace on retry** for debugging
- **Screenshots and videos** on failure
- **Integrated dev server** startup

### Page Object Model

Use Page Object Models to encapsulate page interactions:

```typescript
// e2e/pages/HomePage.ts
export class HomePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
  }

  async goto() {
    await this.page.goto("/");
  }

  async clickReport(title: string) {
    await this.page.getByRole("link", { name: title }).click();
  }
}
```

### Test Structure

```typescript
import { test, expect } from "@playwright/test";
import { HomePage } from "./pages/HomePage";

test.describe("Feature Name", () => {
  test("should perform action", async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.heading).toBeVisible();
  });
});
```

### Locator Strategies

Prefer resilient locators in this order:

1. **Role-based**: `page.getByRole("button", { name: "Submit" })`
2. **Label**: `page.getByLabel("Email")`
3. **Placeholder**: `page.getByPlaceholder("Enter email")`
4. **Text**: `page.getByText("Welcome")`
5. **Test ID**: `page.getByTestId("submit-button")` (last resort)

### API Testing

Test backend APIs directly:

```typescript
test("should return valid response", async ({ request }) => {
  const response = await request.get("/api/reports");
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data).toHaveProperty("reports");
});
```

### Visual Testing

Compare screenshots for visual regressions:

```typescript
test("should match screenshot", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveScreenshot("homepage.png", {
    maxDiffPixels: 100,
  });
});
```

### Browser Contexts

Use contexts for isolated test environments:

```typescript
test("should work in authenticated context", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "auth.json", // Load saved auth state
  });
  const page = await context.newPage();

  // Test as authenticated user
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin/);

  await context.close();
});
```

## Running Tests

### Unit Tests

```bash
# Run tests in watch mode (development)
npm test

# Run all tests once
npm run test:run

# Run with UI
npm run test:ui

# Generate coverage
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run with debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Generate tests with codegen
npm run test:e2e:codegen
```

### Run All Tests

```bash
npm run test:all
```

## Best Practices

### General

1. **Write tests first** or immediately after implementation
2. **Keep tests simple** and focused on one behavior
3. **Use descriptive names** that explain what is being tested
4. **Follow AAA pattern**: Arrange, Act, Assert
5. **Avoid test interdependence** - each test should be isolated

### Unit Tests

1. **Mock external dependencies** (database, APIs, services)
2. **Test edge cases** (empty inputs, errors, boundary conditions)
3. **Use snapshots sparingly** - prefer explicit assertions
4. **Keep tests fast** - unit tests should run in milliseconds
5. **Test behavior, not implementation** - avoid testing internal details

### E2E Tests

1. **Use Page Object Models** for maintainability
2. **Leverage resilient locators** (roles, labels, text)
3. **Wait for elements** instead of hard-coded delays
4. **Test critical user flows** - don't test everything
5. **Run in CI/CD** to catch regressions early
6. **Use trace viewer** to debug failures
7. **Keep tests independent** - can run in any order

### Component Tests

1. **Test user interactions** - clicks, typing, form submission
2. **Verify accessibility** - use semantic HTML and ARIA
3. **Test error states** - loading, errors, empty states
4. **Mock async operations** - API calls, timers
5. **Test responsive behavior** when relevant

## Troubleshooting

### Vitest

**Tests not found**

- Check `vitest.config.ts` include/exclude patterns
- Ensure test files match `*.{test,spec}.{ts,tsx}`

**jsdom errors**

- Verify jsdom is installed: `npm install -D jsdom`
- Check environment setting in config

**Import errors**

- Verify path aliases in `vitest.config.ts` match `tsconfig.json`
- Check that all dependencies are installed

### Playwright

**Tests timeout**

- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify `baseURL` is correct

**Elements not found**

- Use `page.pause()` to debug interactively
- Check if element is visible with `await element.waitFor()`
- Verify locator strategy is correct

**Screenshots don't match**

- Update baseline: `npm run test:e2e -- --update-snapshots`
- Check if content is dynamic (dates, random data)
- Consider increasing `maxDiffPixels`

**Browser not launching**

- Install browser: `npx playwright install chromium`
- Check system dependencies on Linux

## Continuous Integration

Tests are designed to run in CI environments:

- **Unit tests**: Run on every commit
- **E2E tests**: Run on PRs and main branch
- **Coverage reports**: Generated and tracked
- **Test reports**: Saved as artifacts

### Environment Variables

```bash
# CI environment detection
CI=true

# Base URL for E2E tests
BASE_URL=http://localhost:3000
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Test Guidelines](.cursor/rules/testing-unit-vitest.mdc)
- [E2E Guidelines](.cursor/rules/testing-e2e-playwright.mdc)
