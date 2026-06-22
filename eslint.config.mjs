import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**", "coverage/**", "**/.vitepress/cache/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node 脚本与配置文件：提供 console / process / __dirname 等 Node 全局变量
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/**"],
    languageOptions: {
      globals: globals.node
    }
  }
);
