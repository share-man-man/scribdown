import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**", "coverage/**", "**/.vitepress/cache/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended
);
