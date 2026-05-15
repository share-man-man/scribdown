import {
  hydrateMarkdownPreview,
  renderMarkdownPreview
} from "@scribdown/markdown-renderer";
import {
  SCRIBDOWN_APP_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_PAGE_CLASS_NAME
} from "@scribdown/shared";
// 通过 ?inline 将 CSS 以字符串形式打包进 IIFE，避免运行时文件加载。
import uiStyles from "@scribdown/ui-handdrawn/styles.css?inline";

(async () => {
  // Chrome 打开 file://*.md 时，页面体是一个 <pre> 标签包含原始文本。
  const preElement = document.querySelector<HTMLPreElement>("pre");
  const rawMarkdown = preElement?.innerText ?? document.body.innerText;

  if (!rawMarkdown.trim()) return;

  // 关键步骤：将原始 Markdown 渲染为安全 HTML。
  const renderedHtml = await renderMarkdownPreview(rawMarkdown);

  // 从 URL 中提取文件名用于页面标题。
  const filename = decodeURIComponent(window.location.pathname.split("/").pop() ?? "Markdown");

  // 重置 <head>，注入渲染所需的样式。
  document.head.innerHTML = `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${filename}</title>
  `;

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
})();
