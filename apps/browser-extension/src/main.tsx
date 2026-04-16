import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/**
 * 启动浏览器插件前端入口。
 * @param rootElementId 根节点 ID。
 */
function bootstrapBrowserExtension(rootElementId: string): void {
  // 获取根节点用于挂载 React 应用。
  const rootElement = document.getElementById(rootElementId);

  if (!rootElement) {
    throw new Error(`Unable to find root element: ${rootElementId}`);
  }

  // 关键步骤：创建 React 根并渲染应用。
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrapBrowserExtension("root");
