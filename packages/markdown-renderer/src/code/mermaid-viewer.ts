/** Mermaid 全屏宿主：仅管理对话框生命周期，图表由统一渲染器创建。 */
import {
  MERMAID_VIEWER_DIALOG_CLASS_NAME,
  MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME,
  MERMAID_VIEWER_CANVAS_CLASS_NAME,
  MERMAID_CANVAS_CLASS_NAME,
  t
} from "@scribdown/shared";
import { VIEWER_CLOSE_TEXT } from "../core/viewer-shared";
import { createMarkdownMermaidRenderer, type MarkdownMermaidRenderer } from "./mermaid-renderer";

/** 全屏宿主只保留自己的图表实例，不与正文同步状态。 */
interface MermaidViewerHost {
  /** 全屏对话框。 */
  dialog: HTMLDialogElement;
  /** 本次打开时创建的独立实例。 */
  renderer?: MarkdownMermaidRenderer;
}

// 每个文档复用对话框壳层，每次打开重新创建默认状态的图表实例。
const hosts = new WeakMap<Document, MermaidViewerHost>();

/**
 * 打开独立的全屏图表实例。
 * @param ownerDocument 宿主文档。
 * @param svgSource 当前图表的 SVG 内容。
 * @param markdownSource 完整 Markdown 原文。
 */
function openMarkdownMermaidViewer(
  ownerDocument: Document,
  svgSource: string,
  markdownSource: string
): void {
  // 全屏宿主壳层。
  const host = getViewerHost(ownerDocument);
  host.renderer?.destroy();
  host.renderer = createMarkdownMermaidRenderer(
    ownerDocument,
    markdownSource,
    {
      actionLabel: t("mermaid.close"),
      actionIcon: VIEWER_CLOSE_TEXT,
      actionClassNames: [MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME],
      actionAvailableWhileLoading: true,
      onAction: () => closeViewerHost(host)
    },
    svgSource
  );
  // 保留全屏画布的场景样式与定位入口；交互类名由统一渲染器管理。
  host.renderer.element
    .querySelector(`.${MERMAID_CANVAS_CLASS_NAME}`)
    ?.classList.add(MERMAID_VIEWER_CANVAS_CLASS_NAME);
  host.dialog.append(host.renderer.element);
  if (!host.dialog.isConnected) ownerDocument.body.append(host.dialog);
  if (!host.dialog.open) {
    if (typeof host.dialog.showModal === "function") host.dialog.showModal();
    else host.dialog.setAttribute("open", "");
  }
  host.renderer.element.focus();
  // showModal 后布局已可测量，统一渲染器按实际容器尺寸适配。
  host.renderer.refresh();
}

/**
 * 获取或创建轻量对话框宿主。
 * @param ownerDocument 当前文档。
 * @returns 全屏宿主。
 */
function getViewerHost(ownerDocument: Document): MermaidViewerHost {
  // 已存在的宿主。
  const existing = hosts.get(ownerDocument);
  if (existing) return existing;
  // 全屏对话框本身只负责模态展示。
  const dialog = ownerDocument.createElement("dialog");
  dialog.classList.add(MERMAID_VIEWER_DIALOG_CLASS_NAME);
  dialog.setAttribute("aria-label", t("mermaid.fullscreen"));
  dialog.setAttribute("aria-modal", "true");
  dialog.tabIndex = -1;
  // 与该对话框对应的宿主状态。
  const host: MermaidViewerHost = { dialog };
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeViewerHost(host);
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeViewerHost(host);
  });
  dialog.addEventListener("close", () => {
    // 延迟到达的旧 close 事件不能销毁刚重新打开的实例。
    if (!dialog.open) disposeViewerRenderer(host);
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeViewerHost(host);
    }
  });
  hosts.set(ownerDocument, host);
  return host;
}

/**
 * 关闭全屏并释放图表实例。
 * @param host 当前全屏宿主。
 */
function closeViewerHost(host: MermaidViewerHost): void {
  if (typeof host.dialog.close === "function" && host.dialog.open) host.dialog.close();
  else host.dialog.removeAttribute("open");
  disposeViewerRenderer(host);
}

/**
 * 断开图表观察器并清理 DOM。
 * @param host 当前全屏宿主。
 */
function disposeViewerRenderer(host: MermaidViewerHost): void {
  host.renderer?.destroy();
  host.renderer = undefined;
}

export { openMarkdownMermaidViewer };
