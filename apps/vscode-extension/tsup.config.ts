import { defineConfig } from "tsup";

/**
 * VS Code 扩展构建配置：
 * - 产物为 CJS 单文件（VS Code 主进程只支持 CJS）
 * - bundle 模式将 workspace 包一并打入，发布到 marketplace 时不依赖 node_modules
 * - vscode 模块由宿主提供，必须 external
 */
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node18",
  bundle: true,
  external: ["vscode"],
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === "production",
});
