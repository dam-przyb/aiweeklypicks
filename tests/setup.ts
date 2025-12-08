/**
 * Vitest Setup File
 *
 * This file runs before all tests and sets up the testing environment.
 * Global configurations, mocks, and custom matchers should be defined here.
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock environment variables if needed
beforeAll(() => {
  // Setup global mocks
  if (typeof window !== "undefined") {
    // Mock window.matchMedia for components that use responsive design
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    } as any;
  }
});

// Clean up after each test
afterEach(() => {
  // Clean up React Testing Library
  cleanup();
  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Final cleanup
  vi.restoreAllMocks();
});
