import React from "react";
import { createRoot } from "react-dom/client";
import { applyExtensionLocale } from "../config/locale";
import { Popup } from "../popup/Popup";
import "../popup/popup.css";

// 关键步骤：渲染前按宿主语言确定界面文案语言。
applyExtensionLocale();

/**
 * 启动扩展 popup 入口。
 * @param rootElementId 根节点 ID。
 */
function bootstrapPopup(rootElementId: string): void {
  /** popup 根节点元素。 */
  const rootElement = document.getElementById(rootElementId);

  if (!rootElement) {
    throw new Error(`Unable to find root element: ${rootElementId}`);
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}

bootstrapPopup("popup-root");
