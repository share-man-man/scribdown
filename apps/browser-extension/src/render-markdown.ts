import {
  hydrateMarkdownPreview,
  renderMarkdownPreview
} from "@scribdown/markdown-renderer";
import {
  SCRIBDOWN_APP_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_PAGE_CLASS_NAME
} from "@scribdown/shared";
// 通过 ?inline 将 CSS 以字符串形式打包，避免运行时按相对路径加载样式文件。
import uiStyles from "@scribdown/ui-handdrawn/styles.css?inline";

/**
 * 把给定 Markdown 文本渲染到当前 document，统一替换 head 标签与 body 结构。
 * 由 file:// content script 与扩展 viewer 页共享，保证两个入口渲染一致。
 * @param rawMarkdown 原始 Markdown 字符串。
 * @param title 用于 document.title 的标题文本。
 */
export async function renderMarkdownToDocument(
  rawMarkdown: string,
  title: string
): Promise<void> {
  // 关键步骤：将原始 Markdown 渲染为安全 HTML。
  const renderedHtml = await renderMarkdownPreview(rawMarkdown);

  // 重置 <head>，去掉宿主页面残留的元信息和样式。
  document.head.innerHTML = "";
  /** 字符集元标签。 */
  const charsetMeta = document.createElement("meta");
  charsetMeta.setAttribute("charset", "UTF-8");
  document.head.appendChild(charsetMeta);
  /** 视口元标签。 */
  const viewportMeta = document.createElement("meta");
  viewportMeta.setAttribute("name", "viewport");
  viewportMeta.setAttribute("content", "width=device-width, initial-scale=1.0");
  document.head.appendChild(viewportMeta);
  document.title = title;

  /** 注入的内联样式节点。 */
  const styleEl = document.createElement("style");
  styleEl.textContent = uiStyles;
  document.head.appendChild(styleEl);

  // 用渲染结果替换 <body> 内容。
  document.body.className = SCRIBDOWN_PAGE_CLASS_NAME;
  document.body.innerHTML = `
    <main class="${SCRIBDOWN_APP_CLASS_NAME}">
      <article class="${SCRIBDOWN_MARKDOWN_CLASS_NAME}">${renderedHtml}</article>
    </main>
  `;
  // 关键步骤：统一执行图片与代码块的 hydration，保持各宿主行为一致。
  hydrateMarkdownPreview(document.body);
}
