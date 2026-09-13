/** 正文 Mermaid 入口：配置统一渲染器的全屏动作。 */
import { MERMAID_FULLSCREEN_BUTTON_CLASS_NAME, t } from "@scribdown/shared";
import { hydrateMermaidBlocks as hydrateRenderer, MERMAID_LANGUAGE_ID } from "./mermaid-renderer";
import { openMarkdownMermaidViewer } from "./mermaid-viewer";

// 正文场景的全屏入口图标。
const MERMAID_FULLSCREEN_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * 为正文中的图表创建或恢复统一渲染器实例。
 * @param rootElement Markdown 内容容器。
 */
function hydrateMermaidBlocks(rootElement: ParentNode): void {
  hydrateRenderer(rootElement, {
    actionLabel: t("mermaid.fullscreenButton"),
    actionIcon: MERMAID_FULLSCREEN_ICON_SVG,
    actionClassNames: [MERMAID_FULLSCREEN_BUTTON_CLASS_NAME],
    onAction: (svgSource, markdownSource) => {
      // ParentNode 可以是 Document、DocumentFragment 或 Element。
      const ownerDocument =
        rootElement.nodeType === 9 ? (rootElement as Document) : rootElement.ownerDocument;
      if (ownerDocument && svgSource)
        openMarkdownMermaidViewer(ownerDocument, svgSource, markdownSource);
    }
  });
}

export { hydrateMermaidBlocks, MERMAID_LANGUAGE_ID };
