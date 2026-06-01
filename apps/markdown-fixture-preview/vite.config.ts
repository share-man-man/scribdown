import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Markdown fixture 开发预览 Vite 配置。
 * @returns Vite 配置对象。
 */
export default function createViteConfig() {
  return defineConfig({
    server: {
      fs: {
        // 允许 Vite 读取 sibling app 中的 Markdown fixture。
        allow: [resolve(__dirname, "../..")]
      }
    },
    build: {
      // 关键步骤：禁止 Vite 把小于 4KB 的手绘 SVG 资源内联为 base64，
      // 保证 demo 中 CSS 始终以 url() 引用真实文件，便于调试与缓存命中。
      assetsInlineLimit: 0
    }
  });
}
