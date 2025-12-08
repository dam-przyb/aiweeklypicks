/**
 * Test Helper Utilities
 *
 * Reusable utilities for testing across the application.
 */

import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";

/**
 * Custom render function that wraps components with common providers
 * Extend this as your app grows to include context providers, routers, etc.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { ...options });
}

/**
 * Creates a mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  };
}

/**
 * Waits for a promise to reject with a specific error
 */
export async function expectToReject(promise: Promise<any>, errorMessage?: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject, but it resolved");
  } catch (error) {
    if (errorMessage && error instanceof Error) {
      expect(error.message).toContain(errorMessage);
    }
    return error;
  }
}

// Re-export vitest utilities for convenience
export { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
