import { resolve } from "node:path";
import { build, defineConfig, type Plugin, type TerserOptions } from "vite";
import react from "@vitejs/plugin-react";

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
        build: {
          outDir: resolve(__dirname, "dist"),
          // 不清空主构建产物。
          emptyOutDir: false,
          // 关键步骤：使用 terser 的 ascii_only 输出，保证扩展脚本编码可被 Chromium 加载。
          minify: "terser",
          terserOptions: {
            format: {
              ascii_only: true
            }
          } as TerserOptions,
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
