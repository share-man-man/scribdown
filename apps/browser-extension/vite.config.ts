import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json";
import pkg from "./package.json";

/** 当前配置文件所在目录，作为相对路径解析基准。 */
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * 关键步骤：以 package.json 的 version 作为唯一版本号来源，覆盖 manifest.json 的 version。
 * Chrome Web Store 以 manifest 版本判定发布版本，而 Changesets 只 bump package.json，
 * 这里在构建时同步，避免两处版本漂移。
 */
const manifestWithVersion = { ...manifest, version: pkg.version };

/**
 * 浏览器插件应用的 Vite 配置。
 * 由 @crxjs 以 manifest.json 为入口统一打包 popup / content script / background，
 * viewer.html 来自 `web_accessible_resources`，需要在 rollupOptions.input 中显式声明，
 * 否则 @crxjs 不会把它当作 HTML 入口处理（脚本引用会保留 `/src/...` 而无法运行）。
 * dev 模式下对各入口均提供 HMR。
 * @returns Vite 配置对象。
 */
export default defineConfig({
  plugins: [react(), crx({ manifest: manifestWithVersion })],
  build: {
    rollupOptions: {
      input: {
        viewer: resolve(projectRoot, "viewer.html")
      }
    }
  },
  // 关键步骤：把动态 chunk 引用改写为运行时 `chrome.runtime.getURL(...)`。
  // - 原因：content script 注入到 file:// 页面后，Vite 的 `__vitePreload` 会通过
  //   `<link rel="modulepreload" href="assets/xxx.js">` 预加载分块，浏览器以 file://
  //   的 baseURI 解析得到 `file:///assets/xxx.js`，触发 CORS。
  // - 这里强制把 JS 资源 URL 换成扩展 origin 下的绝对地址，让 <link href> 与后续
  //   `import()` 一并落到 `chrome-extension://<id>/assets/...`。
  // - 仅对 JS 宿主生效；渲染样式 URL 由 src/rendering/render-markdown.ts 解析为扩展 URL。
  experimental: {
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === "js") {
        return {
          runtime: `globalThis.chrome.runtime.getURL(${JSON.stringify(filename)})`
        };
      }
      return { relative: true };
    }
  },
  server: {
    // 关键步骤：允许 chrome-extension:// 来源访问 dev server，content script HMR 依赖此项。
    cors: {
      origin: [/chrome-extension:\/\//]
    }
  }
});
