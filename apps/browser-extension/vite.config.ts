import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

/** 当前配置文件所在目录，作为相对路径解析基准。 */
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * 浏览器插件应用的 Vite 配置。
 * 由 @crxjs 以 manifest.json 为入口统一打包 popup / content script / background，
 * viewer.html 来自 `web_accessible_resources`，需要在 rollupOptions.input 中显式声明，
 * 否则 @crxjs 不会把它当作 HTML 入口处理（脚本引用会保留 `/src/...` 而无法运行）。
 * dev 模式下对各入口均提供 HMR。
 * @returns Vite 配置对象。
 */
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        viewer: resolve(projectRoot, "viewer.html")
      }
    }
  },
  server: {
    // 关键步骤：允许 chrome-extension:// 来源访问 dev server，content script HMR 依赖此项。
    cors: {
      origin: [/chrome-extension:\/\//]
    }
  }
});
