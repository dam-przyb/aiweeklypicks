import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");

const baseConfig = tseslint.config({
  extends: [eslint.configs.recommended, tseslint.configs.strict, tseslint.configs.stylistic],
  rules: {
    // Allow console in application code; still surfaced as warnings, not errors.
    "no-console": "warn",
    // Defer unused-vars handling to @typescript-eslint version; disable the base rule.
    "no-unused-vars": "off",
    // Relax some of the stricter TypeScript rules to keep CI linting practical for this project.
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-useless-constructor": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
});

const nodeScriptConfig = tseslint.config({
  files: ["scripts/**/*.{js,mjs,cjs}"],
  languageOptions: {
    globals: {
      // Explicitly declare the Node globals used in scripts.
      console: "readonly",
      process: "readonly",
    },
  },
  rules: {
    "no-console": "off",
  },
});

const jsxA11yConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [jsxA11y.flatConfigs.recommended],
  languageOptions: {
    ...jsxA11y.flatConfigs.recommended.languageOptions,
  },
  rules: {
    ...jsxA11y.flatConfigs.recommended.rules,
  },
});

const reactConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [pluginReact.configs.flat.recommended],
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  plugins: {
    "react-hooks": eslintPluginReactHooks,
    "react-compiler": reactCompiler,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react-compiler/react-compiler": "error",
  },
});

export default tseslint.config(
  // Ignore generated Supabase database types; ESLint sometimes mis-detects this file as binary.
  {
    ignores: ["src/db/database.types.ts"],
  },
  includeIgnoreFile(gitignorePath),
  baseConfig,
  nodeScriptConfig,
  jsxA11yConfig,
  reactConfig,
  eslintPluginAstro.configs["flat/recommended"]
);
