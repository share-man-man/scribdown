import { defineConfig } from "tsup";

/**
 * markdown-renderer 构建配置：
 * 同时输出 ESM 与 CJS，便于浏览器扩展与 VS Code 主进程分别消费。
 * 重依赖（shiki、unified 体系、dompurify）保持 external，避免被打入产物。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["shiki", "dompurify", "unified", /^remark-/, /^rehype-/],
});
