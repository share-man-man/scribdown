import { defineConfig } from "tsup";

/**
 * @scribdown/markdown-renderer 的构建配置。
 * 仅在「发布到 npm」时使用。tsup 默认把 package.json 的 dependencies 视为 external，
 * 因此 shiki / mermaid / @scribdown/* 等依赖不会被打进产物，保持瘦身。
 * styles.css 以源码形式随包发布（见 package.json 的 files / publishConfig），不经此构建。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
