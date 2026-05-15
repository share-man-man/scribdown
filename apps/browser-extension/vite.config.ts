import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

/**
 * 浏览器插件应用的 Vite 配置。
 * 由 @crxjs 以 manifest.json 为入口统一打包 popup 与 content script，
 * dev 模式下对二者均提供 HMR。
 * @returns Vite 配置对象。
 */
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    // 关键步骤：允许 chrome-extension:// 来源访问 dev server，content script HMR 依赖此项。
    cors: {
      origin: [/chrome-extension:\/\//]
    }
  }
});
