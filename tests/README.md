# Unit Tests

Unit and integration tests for AI Weekly Picks using Vitest.

## Directory Structure

```
tests/
├── setup.ts          # Global test setup
├── utils/            # Test utilities and helpers
│   └── test-helpers.ts
└── (mirrors src/)    # Tests colocated with source files
```

## Test Organization

Tests are colocated with the code they test:

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx       # Component test
├── lib/
│   ├── services/
│   │   ├── reports.ts
│   │   └── reports.test.ts   # Service test
│   └── utils.ts
└── pages/
    └── api/
        ├── events.ts
        └── events.test.ts    # API test
```

## Writing Tests

### Component Tests

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

describe("Button", () => {
  it("should render with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should handle click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    
    await fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Service Tests

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReports } from "./reports";

describe("getReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch reports from database", async () => {
    const mockData = [{ id: "1", title: "Report 1" }];
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })),
    };

    const result = await getReports(mockClient);
    expect(result).toEqual(mockData);
  });

  it("should handle errors", async () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ 
          data: null, 
          error: new Error("DB error") 
        }),
      })),
    };

    await expect(getReports(mockClient)).rejects.toThrow("DB error");
  });
});
```

### API Route Tests

```typescript
import { describe, it, expect, vi } from "vitest";

describe("GET /api/reports", () => {
  it("should return reports", async () => {
    const mockRequest = new Request("http://localhost/api/reports");
    const response = await GET(mockRequest);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("reports");
  });

  it("should require authentication", async () => {
    const mockRequest = new Request("http://localhost/api/admin/imports");
    const response = await GET(mockRequest);
    
    expect(response.status).toBe(401);
  });
});
```

## Test Utilities

### Custom Render

```typescript
import { renderWithProviders } from "./utils/test-helpers";

it("should render with providers", () => {
  renderWithProviders(<MyComponent />);
  expect(screen.getByText("Content")).toBeInTheDocument();
});
```

### Mock Supabase

```typescript
import { createMockSupabaseClient } from "./utils/test-helpers";

it("should query database", async () => {
  const mockClient = createMockSupabaseClient();
  mockClient.from().select.mockResolvedValue({ data: [], error: null });
  
  const result = await fetchData(mockClient);
  expect(mockClient.from).toHaveBeenCalledWith("reports");
});
```

## Mocking Patterns

### Function Mocks

```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue("result");
mockFn.mockResolvedValue("async result");
mockFn.mockRejectedValue(new Error("error"));
```

### Module Mocks

```typescript
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockClient),
}));
```

### Spy on Functions

```typescript
const spy = vi.spyOn(console, "error").mockImplementation(() => {});
// ... test code ...
expect(spy).toHaveBeenCalledWith("Error message");
spy.mockRestore();
```

### Global Mocks

```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: "test" }),
});
```

## Running Tests

```bash
# Watch mode (development)
npm test

# Run once
npm run test:run

# With UI
npm run test:ui

# With coverage
npm run test:coverage

# Filter by name
npm test -- -t "Button"

# Run specific file
npm test -- src/components/Button.test.tsx
```

## Environment Selection

Tests automatically use the correct environment:

- **jsdom**: Component tests (`*.test.tsx`)
- **node**: API and service tests (auto-detected by path)

Override with:
```typescript
// @vitest-environment node
```

## Best Practices

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **One Assertion Per Test**: Focus on single behavior
3. **Mock External Dependencies**: Isolate units
4. **Test Edge Cases**: Empty, null, errors
5. **Use Descriptive Names**: Explain what's tested
6. **Keep Tests Fast**: Mock slow operations
7. **Avoid Implementation Details**: Test behavior

## Coverage

Coverage is tracked but not enforced. Focus on:

- Critical business logic
- Edge cases and error handling
- User interactions
- Data transformations

## Debugging

### VS Code

Set breakpoints and run:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

### Browser DevTools

```bash
npm test -- --inspect-brk
```

Then open `chrome://inspect` in Chrome.

## Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Unit Test Guidelines](../.cursor/rules/testing-unit-vitest.mdc)
- [Testing Guide](../.ai/testing-guide.md)

