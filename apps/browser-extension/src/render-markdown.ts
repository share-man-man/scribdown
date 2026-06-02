import {
  hydrateMarkdown,
  mountMarkdownToolbar,
  renderMarkdown
} from "@scribdown/markdown-renderer";
import {
  SCRIBDOWN_APP_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_PAGE_CLASS_NAME
} from "@scribdown/shared";
// 通过 ?inline 将 CSS 以字符串形式打包，避免运行时按相对路径加载样式文件。
import uiStyles from "@scribdown/ui-handdrawn/styles.css?inline";

/**
 * 把内联 CSS 里的 `/assets/*` 绝对路径改写为扩展资源 URL。
 * content script 运行在宿主页面时，`url("/assets/...")` 会被当成宿主根路径，
 * 必须显式改成 `chrome-extension://<id>/assets/...` 才能稳定加载。
 * @param cssText 原始内联 CSS 文本。
 * @returns 适配扩展环境后的 CSS 文本。
 */
function resolveExtensionAssetUrls(cssText: string): string {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
    return cssText;
  }

  /** 扩展根路径 URL（以 `/` 结尾）。 */
  const extensionRootUrl = chrome.runtime.getURL("");

  return cssText.replace(
    /url\((['"]?)\/(assets\/[^)"']+)\1\)/g,
    (_fullMatch: string, quote: string, assetPath: string) => {
      /** 当前资源的扩展绝对 URL。 */
      const absoluteAssetUrl = new URL(assetPath, extensionRootUrl).toString();
      return `url(${quote}${absoluteAssetUrl}${quote})`;
    }
  );
}

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
  const renderedHtml = await renderMarkdown(rawMarkdown);

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
  styleEl.textContent = resolveExtensionAssetUrls(uiStyles);
  document.head.appendChild(styleEl);

  // 用渲染结果替换 <body> 内容。
  document.body.className = SCRIBDOWN_PAGE_CLASS_NAME;
  document.body.innerHTML = `
    <main class="${SCRIBDOWN_APP_CLASS_NAME}">
      <article class="${SCRIBDOWN_MARKDOWN_CLASS_NAME}">${renderedHtml}</article>
    </main>
  `;
  // 关键步骤：统一执行图片与代码块的 hydration，保持各宿主行为一致。
  hydrateMarkdown(document.body);
  // 关键步骤：浏览器宿主下挂载浮动工具栏（回到顶部 / 目录 / 页面宽度）。
  mountMarkdownToolbar(document.body);
}
