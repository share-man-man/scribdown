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
import rendererStylesheetPath from "./markdown-renderer.css?url";

/**
 * 渲染正文样式 link 的 DOM id，方便未来扩展时定位或替换。
 */
const RENDERER_STYLESHEET_ID = "scribdown-renderer-stylesheet";

/**
 * 将 Vite 产出的资源路径转换为扩展内可访问的绝对 URL。
 * @param resourcePath Vite `?url` 返回的资源路径。
 * @returns 可放入 link/script/src 的 URL。
 */
function resolveExtensionResourceUrl(resourcePath: string): string {
  try {
    // 关键步骤：资源路径已经是绝对 URL 时直接使用，避免重复包 chrome.runtime.getURL。
    new URL(resourcePath);
    return resourcePath;
  } catch {
    // 相对路径会进入 chrome.runtime.getURL 分支。
  }

  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
    return resourcePath;
  }

  /** 去掉开头斜杠后的扩展内资源路径，避免生成双斜杠 URL。 */
  const extensionRelativePath = resourcePath.replace(/^\/+/, "");
  return chrome.runtime.getURL(extensionRelativePath);
}

/**
 * 判断属性值是否需要按源 Markdown URL 重写。
 * @param rawUrl 原始属性值。
 * @returns true 表示该值是需要重写的相对 URL。
 */
function shouldRewriteRelativeUrl(rawUrl: string): boolean {
  /** 去掉首尾空白后的 URL 文本。 */
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl || trimmedUrl.startsWith("#") || trimmedUrl.startsWith("//")) {
    return false;
  }

  /** URL 中首个冒号的位置，用于识别 scheme。 */
  const schemeSeparatorIndex = trimmedUrl.indexOf(":");
  /** URL 中首个路径分隔符的位置，用于区分 `foo:bar` 与 `./foo:bar`。 */
  const firstSlashIndex = trimmedUrl.search(/[/?#]/u);
  return (
    schemeSeparatorIndex === -1 ||
    (firstSlashIndex !== -1 && firstSlashIndex < schemeSeparatorIndex)
  );
}

/**
 * 基于源 Markdown URL 把渲染结果中的相对 href/src 改写为绝对 URL。
 * @param rootElement 需要处理的渲染根节点。
 * @param sourceUrl 原始 Markdown 文件 URL。
 */
function rewriteRelativeUrls(rootElement: Element, sourceUrl: string): void {
  /** 用于解析相对 URL 的源文件 URL。 */
  const baseUrl = new URL(sourceUrl);
  /** 需要处理 href/src 属性的元素集合。 */
  const urlElements = rootElement.querySelectorAll<HTMLElement>("[href], [src]");

  urlElements.forEach((element) => {
    /** 当前元素上所有需要检查的 URL 属性名。 */
    const attributeNames = ["href", "src"] as const;
    attributeNames.forEach((attributeName) => {
      /** 当前属性的原始值。 */
      const rawAttributeValue = element.getAttribute(attributeName);
      if (!rawAttributeValue || !shouldRewriteRelativeUrl(rawAttributeValue)) {
        return;
      }

      /** 解析到源 Markdown 旁边后的绝对 URL。 */
      const absoluteUrl = new URL(rawAttributeValue, baseUrl).toString();
      element.setAttribute(attributeName, absoluteUrl);
    });
  });
}

/**
 * 把给定 Markdown 文本渲染到当前 document，统一替换 head 标签与 body 结构。
 * 由 file:// content script 与扩展 viewer 页共享，保证两个入口渲染一致。
 * @param rawMarkdown 原始 Markdown 字符串。
 * @param title 用于 document.title 的标题文本。
 * @param sourceUrl 原始 Markdown 文件 URL，用于解析正文中的相对链接与资源。
 */
export async function renderMarkdownToDocument(
  rawMarkdown: string,
  title: string,
  sourceUrl: string
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

  /** 注入的渲染样式 link 节点。 */
  const stylesheetLink = document.createElement("link");
  stylesheetLink.id = RENDERER_STYLESHEET_ID;
  stylesheetLink.rel = "stylesheet";
  stylesheetLink.href = resolveExtensionResourceUrl(rendererStylesheetPath);
  document.head.appendChild(stylesheetLink);

  // 用渲染结果替换 <body> 内容。
  document.body.className = SCRIBDOWN_PAGE_CLASS_NAME;
  document.body.innerHTML = `
    <main class="${SCRIBDOWN_APP_CLASS_NAME}">
      <article class="${SCRIBDOWN_MARKDOWN_CLASS_NAME}">${renderedHtml}</article>
    </main>
  `;
  /** 刚注入的 Markdown 正文节点。 */
  const markdownArticle = document.querySelector(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`);
  if (markdownArticle) {
    // 关键步骤：sanitize 与高亮完成后，再把用户文档里的相对 href/src 解析到原始 Markdown URL。
    rewriteRelativeUrls(markdownArticle, sourceUrl);
  }
  // 关键步骤：统一执行图片与代码块的 hydration，保持各宿主行为一致。
  hydrateMarkdown(document.body);
  // 关键步骤：浏览器宿主下挂载浮动工具栏（回到顶部 / 目录 / 页面宽度）。
  mountMarkdownToolbar(document.body);
}
