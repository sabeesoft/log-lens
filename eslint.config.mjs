// Flat config (ESLint 9 / typescript-eslint 8).
// Migrated from the previous .eslintrc.json. The former
// "@typescript-eslint/semi" rule is dropped — semicolons are handled by Prettier.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // The webview-ui workspace has its own toolchain; lint it there.
    ignores: ["out/**", "webview-ui/**", "packages/**"],
  },
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/naming-convention": "warn",
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "off",
    },
  }
);
