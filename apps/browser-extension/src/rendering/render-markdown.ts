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
import morphdom from "morphdom";
import {
  getExtensionHostLocale,
  getExtensionLocalePreference,
  saveExtensionLocalePreference
} from "../config/locale";
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
export function shouldRewriteRelativeUrl(rawUrl: string): boolean {
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
export function rewriteRelativeUrls(rootElement: Element, sourceUrl: string): void {
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
 * 确保当前 document 已具备渲染外壳（head 元信息 + body 骨架），并返回正文挂载点。
 * 仅在首次接管时重置 head / body；后续重渲染复用同一套外壳与同一个正文节点，
 * 由 morphdom 做增量合并，避免整页销毁重建。
 * @param title 用于 document.title 的标题文本。
 * @returns 承载 Markdown 正文的 article 节点。
 */
function ensureDocumentShell(title: string): HTMLElement {
  document.title = title;

  /** 已存在的正文节点；存在即说明本文档已被接管过，外壳无需重建。 */
  const existingArticle = document.querySelector<HTMLElement>(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`);
  if (existingArticle) {
    return existingArticle;
  }

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

  /** 注入的渲染样式 link 节点。 */
  const stylesheetLink = document.createElement("link");
  stylesheetLink.id = RENDERER_STYLESHEET_ID;
  stylesheetLink.rel = "stylesheet";
  stylesheetLink.href = resolveExtensionResourceUrl(rendererStylesheetPath);
  document.head.appendChild(stylesheetLink);

  // 关键步骤：只建空骨架，正文内容统一走下面的 morphdom 合并路径，
  // 首次渲染与后续更新共用同一条代码路径。
  document.body.className = SCRIBDOWN_PAGE_CLASS_NAME;
  document.body.innerHTML = "";
  /** 满宽外壳节点，同时作为工具栏与目录侧栏的挂载点。 */
  const appElement = document.createElement("main");
  appElement.className = SCRIBDOWN_APP_CLASS_NAME;
  /** Markdown 正文节点，后续所有更新都增量合并进这个节点。 */
  const articleElement = document.createElement("article");
  articleElement.className = SCRIBDOWN_MARKDOWN_CLASS_NAME;
  appElement.appendChild(articleElement);
  document.body.appendChild(appElement);

  return articleElement;
}

/**
 * 把给定 Markdown 文本渲染到当前 document。
 * 首次调用建立 head 与 body 骨架，之后每次调用都以 morphdom 增量合并正文，
 * 未变化的节点原地保留——滚动容器、已挂载的全屏查看器、图片加载状态都不会被销毁。
 * 与 VS Code 预览侧保持同一套增量更新策略。
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

  /** 当前 document 中承载正文的 article 节点（首次调用时创建）。 */
  const articleElement = ensureDocumentShell(title);

  // 关键步骤：在游离节点上构建并 hydrate 新内容，使代码块包装等结构与现有 DOM 对齐，
  // morphdom 才能逐节点比对而非按标签差异整块销毁重建。
  /** 本轮新内容的游离快照节点；标签与 class 与 live 正文节点保持一致。 */
  const incomingArticle = document.createElement("article");
  incomingArticle.className = SCRIBDOWN_MARKDOWN_CLASS_NAME;
  incomingArticle.innerHTML = renderedHtml;
  // 关键步骤：sanitize 与高亮完成后，再把用户文档里的相对 href/src 解析到原始 Markdown URL。
  rewriteRelativeUrls(incomingArticle, sourceUrl);
  hydrateMarkdown(incomingArticle);

  // 关键步骤：增量更新正文 DOM，仅替换真正变化的节点。未变节点原地保留，
  // 因此滚动位置、body 上的全屏 dialog 与图片加载状态都不会因刷新而丢失。
  morphdom(articleElement, incomingArticle, { childrenOnly: true });

  // 关键步骤：morphdom 同步属性会抹掉 hydration 运行时写入的图片加载状态类，
  // 重新 hydrate 由渲染器内部依据真实加载结果纠正；各 hydrate 均带幂等守卫，
  // 已处理过的节点会被跳过。
  hydrateMarkdown(articleElement);

  // 关键步骤：浏览器宿主下挂载浮动工具栏，并把语言选择保存到扩展全局存储。
  // mountMarkdownToolbar 幂等：会先清理旧实例，再依据最新标题重建目录。
  mountMarkdownToolbar(document.body, {
    onLocaleChange: (preference) => {
      void saveExtensionLocalePreference(preference);
    },
    localePreference: getExtensionLocalePreference(),
    hostLocale: getExtensionHostLocale()
  });
}
