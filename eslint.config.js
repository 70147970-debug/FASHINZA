// Lint config for the Node.js code: server/, shared/, tests/ and root config files.
// The React client has its own config (client/eslint.config.js) and is linted by `npm run lint` separately.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["client/**", "node_modules/**", "**/node_modules/**", "playwright-report/**", "test-results/**", "uploads/**", "docs/**", "public/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true }],
    },
  },
  {
    // Playwright callbacks passed to page.evaluate() run in the browser.
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
