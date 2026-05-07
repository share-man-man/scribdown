import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * 各 packages 的源码别名，开发预览必须直接观察渲染核心改动。
 */
const sharedAlias = [
  {
    find: /^@scribdown\/ui-handdrawn\/styles\.css/,
    replacement: resolve(__dirname, "../../packages/ui-handdrawn/src/styles.css")
  },
  { find: "@scribdown/markdown-renderer", replacement: resolve(__dirname, "../../packages/markdown-renderer/src/index.ts") },
  { find: "@scribdown/shared", replacement: resolve(__dirname, "../../packages/shared/src/index.ts") },
  { find: "@scribdown/ui-handdrawn", replacement: resolve(__dirname, "../../packages/ui-handdrawn/src/index.tsx") }
];

/**
 * Markdown fixture 开发预览 Vite 配置。
 * @returns Vite 配置对象。
 */
export default function createViteConfig() {
  return defineConfig({
    resolve: { alias: sharedAlias },
    server: {
      fs: {
        // 允许 Vite 读取 sibling app 中的 Markdown fixture。
        allow: [resolve(__dirname, "../..")]
      }
    }
  });
}
