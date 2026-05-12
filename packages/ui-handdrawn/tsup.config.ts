import { cp, mkdir, rm } from "node:fs/promises";
import { defineConfig } from "tsup";

/**
 * ui-handdrawn 构建配置：
 * 包内只对外提供样式与静态资源，没有 JS/TS 入口；
 * 通过 onSuccess 钩子把 src 下的样式与 SVG 拷贝到 dist。
 */
export default defineConfig({
  // 使用样式文件作为最小入口，确保当前 tsup 版本会执行构建生命周期。
  entry: ["src/styles.css"],
  clean: false,
  async onSuccess() {
    // 先清空 dist，避免遗留旧资源。
    await rm("dist", { recursive: true, force: true });
    await mkdir("dist", { recursive: true });
    // 拷贝样式与 SVG 资源，保留 ./styles.css 与 ./assets/* 的导出路径。
    await cp("src/styles.css", "dist/styles.css");
    await cp("src/assets", "dist/assets", { recursive: true });
  },
});
