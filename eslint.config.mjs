import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // 构建产物与工具生成的类型声明一律不参与 lint：
    // .output / .wxt 是 WXT 生成的扩展产物与类型，.rspress 是文档站的中间产物。
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "coverage/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/.rspress/**"
    ]
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
