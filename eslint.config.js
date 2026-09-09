// Flat config. Style + correctness lint on top of `tsc --strict`.
// Run: `npm run lint`  ·  gate: it's step 3 of `npm run ci`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "web/dist/**",
      "data/**",
      "eval/**",
      "**/*.json",
      "web/public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // adapters parse untyped external API JSON (Notion / Zoom / Airtable) and a `meta` bag;
      // those `any`s are deliberate and localised. Flag new ones as a warning, not an error.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "prefer-const": "error",
      "eqeqeq": ["error", "smart"],
    },
  },
  {
    files: ["web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { window: "readonly", document: "readonly", localStorage: "readonly", fetch: "readonly", HTMLInputElement: "readonly" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { fetch: "readonly", WebSocket: "readonly", process: "readonly", console: "readonly" } },
  },
);
