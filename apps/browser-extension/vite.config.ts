import { resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 各 packages 的路径别名，popup 与 content script 两次构建共用。
 * ui-handdrawn 只对外暴露样式与静态资源，使用正则以同时覆盖带 ?inline 查询参数。
 */
const sharedAlias = [
  {
    find: /^@scribdown\/ui-handdrawn\/styles\.css/,
    replacement: resolve(__dirname, "../../packages/ui-handdrawn/src/styles.css")
  },
  { find: "@scribdown/markdown-renderer", replacement: resolve(__dirname, "../../packages/markdown-renderer/src/index.ts") },
  { find: "@scribdown/shared",            replacement: resolve(__dirname, "../../packages/shared/src/index.ts") }
];

/**
 * 在 popup 构建结束后，自动触发 content script 的 IIFE 二次构建。
 * 使用插件而非独立 config 文件，保持单入口构建命令。
 * @returns Vite 插件对象。
 */
function buildContentScript(): Plugin {
  return {
    name: "build-content-script",
    // closeBundle 在主构建产物写入磁盘后触发，确保 emptyOutDir 已完成。
    closeBundle: async () => {
      await build({
        configFile: false,
        resolve: { alias: sharedAlias },
        build: {
          outDir: resolve(__dirname, "dist"),
          // 不清空主构建产物。
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, "src/content.ts"),
            name: "ScribdownContent",
            formats: ["iife"],
            fileName: () => "content.js"
          },
          rollupOptions: {
            output: {
              // IIFE 格式下将所有动态 import() 内联，保证单文件可运行。
              inlineDynamicImports: true
            }
          }
        }
      });
    }
  };
}

/**
 * 浏览器插件应用的 Vite 配置。
 * @returns Vite 配置对象。
 */
export default function createViteConfig() {
  return defineConfig({
    plugins: [react(), buildContentScript()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html")
        }
      }
    }
  });
}
