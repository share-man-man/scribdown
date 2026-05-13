import {
  hydrateCodeBlocks,
  hydrateMarkdownImages,
  renderMarkdown
} from "@scribdown/markdown-renderer";
// 通过 ?inline 将 CSS 以字符串形式打包进 IIFE，避免运行时文件加载。
import uiStyles from "@scribdown/ui-handdrawn/styles.css?inline";

(async () => {
  // Chrome 打开 file://*.md 时，页面体是一个 <pre> 标签包含原始文本。
  const preElement = document.querySelector<HTMLPreElement>("pre");
  const rawMarkdown = preElement?.innerText ?? document.body.innerText;

  if (!rawMarkdown.trim()) return;

  // 关键步骤：将原始 Markdown 渲染为安全 HTML。
  const renderedHtml = await renderMarkdown(rawMarkdown, { sanitizeHtml: true });

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
  document.body.className = "scribdown-page";
  document.body.innerHTML = `
    <main class="scribdown-app">
      <article class="scribdown-markdown">${renderedHtml}</article>
    </main>
  `;
  // 关键步骤：补齐图片加载状态，保证失败态可以展示 alt 文本占位。
  hydrateMarkdownImages(document.body);
  // 关键步骤：为代码块挂载语言标签、复制按钮与行号 chrome。
  hydrateCodeBlocks(document.body);
})();
