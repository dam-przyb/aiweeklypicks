import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Use 'jsdom' for component tests, 'node' for API/service tests
    environment: "jsdom",
    // Override environment per file with @vitest-environment comment
    environmentMatchGlobs: [
      ["**/*.test.tsx", "jsdom"],
      ["**/pages/api/**/*.test.ts", "node"],
      ["**/lib/services/**/*.test.ts", "node"],
      ["**/lib/validation/**/*.test.ts", "node"],
    ],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/.{idea,git,cache,output,temp}/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "tests/",
        "e2e/",
        "dist/",
        "**/*.config.*",
        "**/*.d.ts",
        "**/types.ts",
        "src/env.d.ts",
      ],
      // Run with --coverage.enabled to generate coverage reports
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
