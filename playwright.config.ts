import { defineConfig } from "@playwright/test";

/**
 * 全仓库 Playwright 基础配置。
 * @returns Playwright 配置对象。
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    headless: true
  }
});
