import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 浏览器插件应用的 Vite 配置。
 * @returns Vite 配置对象。
 */
export default function createViteConfig() {
  // 统一 React 插件实例，避免重复定义。
  const reactPlugin = react();

  return defineConfig({
    plugins: [reactPlugin],
    resolve: {
      alias: {
        "@scribdown/markdown-renderer": resolve(__dirname, "../../packages/markdown-renderer/src/index.ts"),
        "@scribdown/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
        "@scribdown/ui-handdrawn/styles.css": resolve(__dirname, "../../packages/ui-handdrawn/src/styles.css"),
        "@scribdown/ui-handdrawn": resolve(__dirname, "../../packages/ui-handdrawn/src/index.tsx")
      }
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          app: resolve(__dirname, "index.html")
        }
      }
    }
  });
}
