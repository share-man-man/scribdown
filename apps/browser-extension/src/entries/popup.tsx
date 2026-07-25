import React from "react";
import { createRoot } from "react-dom/client";
import { applyExtensionLocale } from "../config/locale";
import { Popup } from "../popup/Popup";
import "../popup/popup.css";

/**
 * 启动扩展 popup 入口。
 * @param rootElementId 根节点 ID。
 * @returns 启动完成后的 Promise。
 */
async function bootstrapPopup(rootElementId: string): Promise<void> {
  // 关键步骤：渲染前先读取扩展全局语言偏好，避免 popup 首帧使用默认语言闪烁。
  await applyExtensionLocale();
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

void bootstrapPopup("popup-root");
