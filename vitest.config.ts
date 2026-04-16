import { defineConfig } from "vitest/config";

/**
 * 全仓库 Vitest 基础配置。
 * @returns Vitest 配置对象。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"]
  }
});
