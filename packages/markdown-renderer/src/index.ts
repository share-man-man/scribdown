/**
 * @scribdown/markdown-renderer 的公共入口：
 * renderMarkdown（Markdown → 安全 HTML）、hydrateMarkdown（DOM 交互 hydration）
 * 与 mountMarkdownToolbar（浮动工具栏挂载）。
 */

import type { LocalePreference } from "@scribdown/shared";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { hydrateCodeBlocks } from "./code/code-block-chrome";
import { highlightMarkdownCodeBlocks } from "./code/code-highlight";
import { hydrateMermaidBlocks } from "./code/mermaid";
import { remarkSourceLine } from "./core/source-line";
import { hydrateMarkdownImages, remarkImageFigures } from "./media/images";
import { hydrateMarkdownVideos, rehypeVideoFigures } from "./media/videos";
import { createScribdownSanitizeSchema, sanitizeHtmlWithDomPurify } from "./sanitize";
import { remarkDefinitionLists } from "./syntax/definition-lists";
import { rehypeFrameClass } from "./syntax/frame";
import { remarkFrontmatterMetadata } from "./syntax/frontmatter";
import { remarkHighlightMark } from "./syntax/highlight-mark";
import { hydrateMarkdownTables } from "./syntax/tables";
import { hydrateToc, remarkTableOfContents } from "./syntax/toc";
import { applyContentWidth, loadContentWidth, mountPageToolbar } from "./toolbar";

/**
 * 将 Markdown 文本渲染为安全 HTML。
 * 渲染链路固定开启代码高亮与 HTML sanitize（rehype 结构清洗 + DOMPurify），
 * 库不再对外暴露这些细节开关，保证所有宿主拿到一致的预览输出。
 * @param markdownText 输入的 Markdown 文本。
 * @returns 可挂载到 DOM 容器的 HTML 字符串。
 */
export async function renderMarkdown(markdownText: string): Promise<string> {
  // 渲染流水线：先解析 Markdown 与 GFM 行内标记，再转换为 HTML AST。
  // allowDangerousHtml + rehypeRaw 让 fixture 中的 <u> / <sub> / <sup> / <kbd> 等行内 HTML 保留下来。
  // 关键步骤：rehypeSanitize 在 stringify 前对结构做白名单清洗。
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .use(remarkFrontmatterMetadata)
    .use(remarkHighlightMark)
    .use(remarkDefinitionLists)
    .use(remarkTableOfContents)
    .use(remarkImageFigures)
    .use(remarkSourceLine)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeFrameClass)
    .use(rehypeVideoFigures)
    .use(rehypeSanitize, createScribdownSanitizeSchema())
    .use(rehypeStringify);

  /** unified 渲染输出的 HTML 文本（已经过 rehype 结构清洗）。 */
  const renderedHtml = String(await processor.process(markdownText));

  // 关键步骤：rehype 清洗后再用 DOMPurify 做一次字符串级 sanitize，双重保险。
  const sanitizedHtml = sanitizeHtmlWithDomPurify(renderedHtml);

  // 关键步骤：sanitize 之后再做 Shiki 高亮，把 token span 添加到信任过滤后的代码体内。
  return highlightMarkdownCodeBlocks(sanitizedHtml);
}

/**
 * Markdown 交互 hydration 的可注入选项，用于让各宿主落地平台差异，
 * 渲染器自身保持跨端一致（仅调用注入的实现）。
 */
export interface MarkdownInteractionOptions {
  /**
   * 目录条目跳转到目标标题的滚动实现，由宿主注入以适配各端平滑滚动差异。
   * 缺省使用原生 `scrollIntoView({ behavior: "smooth" })`（标准浏览器即丝滑）；
   * 若宿主原生平滑被降级（如 VS Code webview 对真实锚点点击会瞬时），
   * 可注入自定义实现（如手动 requestAnimationFrame 动画）。
   * @param targetElement 目标标题元素。
   */
  scrollToHeading?: (targetElement: HTMLElement) => void;
  /**
   * 用户从工具栏切换界面语言偏好后的通知回调。
   * 宿主可据此同步自己的状态或重新渲染预览；未提供时工具栏会即时重建自身文案。
   * @param preference 用户选中的语言偏好。
   */
  onLocaleChange?: (preference: LocalePreference) => void;
  /**
   * 宿主当前保存的语言偏好。缺省时视为跟随系统。
   * 用于在工具栏中正确标识当前选项。
   */
  localePreference?: LocalePreference;
  /**
   * 宿主原始系统语言标签。选择「跟随系统」时用它即时刷新工具栏文案。
   */
  hostLocale?: string | null;
}

/**
 * 默认目录跳转滚动实现：原生平滑 scrollIntoView。
 * @param targetElement 目标标题元素。
 */
function defaultScrollToHeading(targetElement: HTMLElement): void {
  targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 对已渲染到 DOM 的 Markdown 内容执行交互 hydration。
 * 处理图片放大查看、视频占位、Mermaid、代码块复制等运行时行为。
 * 不挂载浮动工具栏；如需工具栏请额外调用 {@link mountMarkdownToolbar}。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 * @param options 可注入交互选项（如目录跳转滚动实现）。
 */
export function hydrateMarkdown(
  rootElement: ParentNode,
  options: MarkdownInteractionOptions = {}
): void {
  hydrateMarkdownImages(rootElement);
  hydrateMarkdownVideos(rootElement);
  // 关键步骤：mermaid 必须先于代码块 hydrate，避免被通用 code chrome 包装。
  hydrateMermaidBlocks(rootElement);
  hydrateCodeBlocks(rootElement);
  hydrateMarkdownTables(rootElement);
  // 关键步骤：为行内 [TOC] 绑定折叠与标题跳转；滚动实现由宿主注入，缺省原生平滑。
  hydrateToc(rootElement, options.scrollToHeading ?? defaultScrollToHeading);
}

/**
 * 在指定 DOM 容器上挂载 Scribdown 浮动工具栏（回到顶部 / 目录 / 页面宽度 / 语言切换）。
 * 工具栏 DOM 会直接 append 到 `container` 内，便于宿主控制生命周期：
 * 移除 / 替换 container 即可一并卸载工具栏，不会污染 `<body>`。
 * 视觉上工具栏使用 `position: fixed`，位置始终相对视口，与挂载点的 CSS 上下文无关。
 *
 * 仅在浏览器环境生效；非浏览器环境（如 Node.js 单测）或 SSR 阶段直接跳过。
 * 重复调用会先清理 container 内的旧实例，可在每次 {@link hydrateMarkdown} 后安全重新挂载。
 * @param container 目标挂载容器；同时作为目录采集与点击外部关闭的作用域。
 * @param options 可注入交互选项（如目录跳转滚动实现）。
 */
export function mountMarkdownToolbar(
  container: Element,
  options: MarkdownInteractionOptions = {}
): void {
  /** 容器所属的 document。 */
  const ownerDocument = container.ownerDocument;
  if (!ownerDocument) {
    return;
  }
  if (typeof ownerDocument.defaultView?.scrollTo !== "function") {
    return;
  }
  /** 宿主未显式注入时，从所属窗口读取语言，保证“跟随应用语言”可恢复初始语言。 */
  const hostLocale = options.hostLocale ?? ownerDocument.defaultView.navigator.language;
  // 关键步骤：恢复上次保存的内容宽度，再挂载工具栏。
  applyContentWidth(ownerDocument, loadContentWidth());
  mountPageToolbar(
    ownerDocument,
    container,
    options.scrollToHeading ?? defaultScrollToHeading,
    options.onLocaleChange,
    options.localePreference,
    hostLocale
  );
}
