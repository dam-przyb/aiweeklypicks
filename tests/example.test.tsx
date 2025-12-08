/**
 * Example Unit Test for React Components
 *
 * This file demonstrates unit testing patterns with Vitest and React Testing Library.
 * Following guidelines from .cursor/rules/testing-unit-vitest.mdc
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

// Example: Testing a simple button component
describe("Button Component (Example)", () => {
  it("should render with correct text", () => {
    const { container } = render(<button>Click me</button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("should call onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    render(<button onClick={handleClick}>Click me</button>);

    const button = screen.getByText("Click me");
    await fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<button disabled>Click me</button>);
    const button = screen.getByText("Click me");
    expect(button).toBeDisabled();
  });
});

// Example: Testing with async operations
describe("Async Operations (Example)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle async data fetching", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ data: "test" }),
    });
    global.fetch = mockFetch;

    const result = await fetch("/api/test").then((r) => r.json());

    expect(result).toEqual({ data: "test" });
    expect(mockFetch).toHaveBeenCalledWith("/api/test");
  });

  it("should handle errors gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    await expect(fetch("/api/test")).rejects.toThrow("Network error");
  });
});

// Example: Testing with inline snapshots
describe("Snapshot Testing (Example)", () => {
  it("should match inline snapshot", () => {
    const data = {
      id: 1,
      name: "Test Report",
      date: "2024-01-01",
    };

    expect(data).toMatchInlineSnapshot(`
      {
        "date": "2024-01-01",
        "id": 1,
        "name": "Test Report",
      }
    `);
  });
});

// Example: Testing with mocked modules
describe("Module Mocking (Example)", () => {
  it("should mock external dependencies", () => {
    // Mock a utility function
    const mockUtils = {
      formatDate: vi.fn().mockReturnValue("2024-01-01"),
    };

    const result = mockUtils.formatDate(new Date());
    expect(result).toBe("2024-01-01");
    expect(mockUtils.formatDate).toHaveBeenCalled();
  });
});
