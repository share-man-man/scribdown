/**
 * 图片与 Mermaid 查看器共用的按钮、缩放组和模式图标。
 */

import {
  VIEWER_CONTROL_BUTTON_CLASS_NAME,
  VIEWER_ZOOM_GROUP_CLASS_NAME,
  VIEWER_ZOOM_VALUE_CLASS_NAME
} from "@scribdown/shared";

import { VIEWER_ZOOM_IN_TEXT, VIEWER_ZOOM_OUT_TEXT } from "./viewer-shared";

// 查看器选择模式图标。
const VIEWER_SELECT_MODE_ICON_SVG =
  '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false">' +
  '<path d="M4.2 2.8 15 10.2l-5.1 1.1-2.7 4.4L4.2 2.8Z" fill="none" stroke="currentColor" ' +
  'stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

// 查看器拖拽模式图标。
const VIEWER_DRAG_MODE_ICON_SVG =
  '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false">' +
  '<path d="M6.4 9.1V5.7a1.2 1.2 0 0 1 2.4 0v2.6-4a1.2 1.2 0 0 1 2.4 0v4-3.1a1.2 1.2 0 0 1 2.4 0v3.5-2a1.2 1.2 0 0 1 2.4 0v4.1c0 3.7-2.2 6.1-5.7 6.1-2 0-3.2-.8-4.3-2.2L3.8 12a1.3 1.3 0 0 1 1.9-1.8l.7.7V9.1Z" ' +
  'fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

// 查看器重置缩放图标。
const VIEWER_RESET_ZOOM_ICON_SVG =
  '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false">' +
  '<path d="M5.1 6.2H2.7V3.8M3.1 6a7 7 0 1 1-.1 7.7" fill="none" stroke="currentColor" ' +
  'stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M10 7.2v5.6M8.6 8.5 10 7.2" fill="none" stroke="currentColor" ' +
  'stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

/**
 * 共用缩放控件的可访问名称。
 */
interface MarkdownViewerZoomControlLabels {
  /** 缩放组名称。 */
  group: string;
  /** 缩小按钮名称。 */
  zoomOut: string;
  /** 放大按钮名称。 */
  zoomIn: string;
}

/**
 * 共用缩放按钮组节点。
 */
interface MarkdownViewerZoomControls {
  /** 连体按钮组容器。 */
  groupElement: HTMLElement;
  /** 缩小按钮。 */
  zoomOutButtonElement: HTMLButtonElement;
  /** 当前缩放比例。 */
  zoomValueElement: HTMLElement;
  /** 放大按钮。 */
  zoomInButtonElement: HTMLButtonElement;
}

/**
 * 创建媒体查看器共用工具按钮。
 * @param ownerDocument 当前内容所属 document。
 * @param ariaLabel 按钮可访问名称。
 * @param content 按钮可见内容，仅接收模块内定义的可信图标或文本常量。
 * @param additionalClassNames 宿主需要附加的样式类名。
 * @returns 已配置的按钮。
 */
function createMarkdownViewerControlButton(
  ownerDocument: Document,
  ariaLabel: string,
  content: string,
  additionalClassNames: readonly string[] = []
): HTMLButtonElement {
  // 工具按钮节点。
  const buttonElement = ownerDocument.createElement("button");
  buttonElement.type = "button";
  buttonElement.className = [VIEWER_CONTROL_BUTTON_CLASS_NAME, ...additionalClassNames].join(" ");
  buttonElement.innerHTML = content;
  buttonElement.setAttribute("aria-label", ariaLabel);
  buttonElement.setAttribute("title", ariaLabel);
  return buttonElement;
}

/**
 * 创建媒体查看器共用的缩小、比例、放大连体按钮组。
 * @param ownerDocument 当前内容所属 document。
 * @param labels 缩放控件可访问名称。
 * @param groupClassNames 宿主需要附加到按钮组的样式类名。
 * @param buttonClassNames 宿主需要附加到按钮的样式类名。
 * @param valueClassNames 宿主需要附加到缩放比例的样式类名。
 * @returns 缩放按钮组及其子节点。
 */
function createMarkdownViewerZoomControls(
  ownerDocument: Document,
  labels: MarkdownViewerZoomControlLabels,
  groupClassNames: readonly string[] = [],
  buttonClassNames: readonly string[] = [],
  valueClassNames: readonly string[] = []
): MarkdownViewerZoomControls {
  // 缩放按钮组。
  const groupElement = ownerDocument.createElement("div");
  // 缩小按钮。
  const zoomOutButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    labels.zoomOut,
    VIEWER_ZOOM_OUT_TEXT,
    buttonClassNames
  );
  // 当前缩放比例。
  const zoomValueElement = ownerDocument.createElement("span");
  // 放大按钮。
  const zoomInButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    labels.zoomIn,
    VIEWER_ZOOM_IN_TEXT,
    buttonClassNames
  );

  groupElement.className = [VIEWER_ZOOM_GROUP_CLASS_NAME, ...groupClassNames].join(" ");
  groupElement.setAttribute("role", "group");
  groupElement.setAttribute("aria-label", labels.group);
  zoomValueElement.className = [VIEWER_ZOOM_VALUE_CLASS_NAME, ...valueClassNames].join(" ");
  zoomValueElement.textContent = "100%";
  groupElement.append(zoomOutButtonElement, zoomValueElement, zoomInButtonElement);

  return {
    groupElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement
  };
}

export {
  createMarkdownViewerControlButton,
  createMarkdownViewerZoomControls,
  VIEWER_DRAG_MODE_ICON_SVG,
  VIEWER_RESET_ZOOM_ICON_SVG,
  VIEWER_SELECT_MODE_ICON_SVG
};
export type { MarkdownViewerZoomControlLabels, MarkdownViewerZoomControls };
