import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "./popup.css";

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
