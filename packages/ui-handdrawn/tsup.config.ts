import { cp } from "node:fs/promises";
import { defineConfig } from "tsup";

/**
 * ui-handdrawn 构建配置：
 * 仅产出 ESM（消费方均为打包器环境），并通过 onSuccess 钩子
 * 将样式与静态资源原样复制到 dist，保持发布产物的相对路径稳定。
 */
export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom", "@scribdown/shared"],
  async onSuccess() {
    // 拷贝样式与 SVG 资源，保留 ./styles.css 与 ./assets/* 的导出路径。
    await cp("src/styles.css", "dist/styles.css");
    await cp("src/assets", "dist/assets", { recursive: true });
  },
});
