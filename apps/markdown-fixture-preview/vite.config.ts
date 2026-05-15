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
    }
  });
}
