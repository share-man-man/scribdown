import DOMPurify from "dompurify";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Highlighter, createHighlighter } from "shiki";
import { unified } from "unified";

/**
 * Markdown 渲染参数。
 */
export interface RenderMarkdownOptions {
  sanitizeHtml?: boolean;
  sanitize?: (unsafeHtml: string) => string;
}

/**
 * Markdown AST 节点的最小结构。
 */
interface MarkdownNode {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  alt?: string;
  title?: string | null;
  identifier?: string;
  ordered?: boolean;
  spread?: boolean;
  children?: MarkdownNode[];
  data?: MarkdownNodeData;
}

/**
 * Markdown AST 节点上的 HTML 转换元数据。
 */
interface MarkdownNodeData {
  hName?: string;
  hProperties?: Record<string, unknown>;
}

/**
 * 目录中的单个标题条目。
 */
interface TocHeading {
  depth: number;
  id: string;
  index: string;
  text: string;
}

/**
 * 目录树中的单个标题条目。
 */
interface TocTreeItem extends TocHeading {
  children: TocTreeItem[];
}

/**
 * 图片全图查看器的运行时状态。
 */
interface MarkdownImageViewerState {
  captionElement: HTMLElement;
  closeButtonElement: HTMLButtonElement;
  dialogElement: HTMLDialogElement;
  /** 拖拽起始时鼠标的客户端 X 坐标。 */
  dragStartClientX: number;
  /** 拖拽起始时鼠标的客户端 Y 坐标。 */
  dragStartClientY: number;
  /** 拖拽起始时视口的横向滚动量。 */
  dragStartScrollLeft: number;
  /** 拖拽起始时视口的纵向滚动量。 */
  dragStartScrollTop: number;
  hintElement: HTMLElement;
  imageElement: HTMLImageElement;
  /** 当前是否处于鼠标拖拽平移状态。 */
  isDragging: boolean;
  naturalHeight: number;
  naturalWidth: number;
  resetButtonElement: HTMLButtonElement;
  sourceImageElement?: HTMLImageElement;
  viewportElement: HTMLElement;
  zoomInButtonElement: HTMLButtonElement;
  zoomOutButtonElement: HTMLButtonElement;
  zoomValue: number;
  zoomValueElement: HTMLElement;
}

/**
 * 缩放前记录的视口焦点信息，用于保持光标/视口中心在缩放后位置不变。
 */
interface MarkdownImageViewerFocalPoint {
  /** 焦点在客户端坐标系的 X。 */
  anchorClientX: number;
  /** 焦点在客户端坐标系的 Y。 */
  anchorClientY: number;
  /** 焦点在图片内的归一化 X (0..1)。 */
  normalizedX: number;
  /** 焦点在图片内的归一化 Y (0..1)。 */
  normalizedY: number;
}

/**
 * 触发缩放时的可选锚点（鼠标客户端坐标）。
 */
interface MarkdownImageViewerZoomAnchor {
  x: number;
  y: number;
}

/**
 * 图片全图查看器按钮配置。
 */
interface MarkdownImageViewerButtonOptions {
  ariaLabel: string;
  className?: string;
  text: string;
}

// [TOC] 占位符匹配规则：仅处理独占一段的目录标记。
const TOC_MARKER_PATTERN = /^\s*\[toc]\s*$/i;

// 目录容器类名。
const TOC_CLASS_NAME = "scribdown-toc";

// 目录分支容器类名。
const TOC_BRANCH_CLASS_NAME = "scribdown-toc-branch";

// 目录分支摘要类名。
const TOC_BRANCH_SUMMARY_CLASS_NAME = "scribdown-toc-branch-summary";

// 目录分支跳转链接类名。
const TOC_BRANCH_LINK_CLASS_NAME = "scribdown-toc-branch-link";

// 目录摘要按钮类名。
const TOC_SUMMARY_CLASS_NAME = "scribdown-toc-summary";

// 目录导航区域类名。
const TOC_NAV_CLASS_NAME = "scribdown-toc-nav";

// 目录列表类名。
const TOC_LIST_CLASS_NAME = "scribdown-toc-list";

// 目录嵌套列表类名。
const TOC_LIST_NESTED_CLASS_NAME = "scribdown-toc-list--nested";

// 目录条目类名前缀。
const TOC_ITEM_CLASS_PREFIX = "scribdown-toc-item";

// 目录分支条目类名。
const TOC_ITEM_BRANCH_CLASS_NAME = "scribdown-toc-item--branch";

// 目录可访问名称。
const TOC_ARIA_LABEL = "目录";

// 目录摘要显示文本。
const TOC_SUMMARY_TEXT = "目录";

// 目录分支跳转链接显示文本。
const TOC_BRANCH_LINK_TEXT = "#";

// 目录分支跳转链接可访问名称前缀。
const TOC_BRANCH_LINK_ARIA_LABEL_PREFIX = "跳转到";

// 空标题生成锚点时使用的前缀。
const EMPTY_HEADING_SLUG_PREFIX = "section";

// 标题文本包裹层类名：用于按行绘制手绘高亮，确保多行标题每行都有底色。
const HEADING_MARK_CLASS_NAME = "scribdown-heading-mark";

// 图片 figure 容器类名。
const IMAGE_FIGURE_CLASS_NAME = "scribdown-image-figure";

// 图片边框容器类名。
const IMAGE_FRAME_CLASS_NAME = "scribdown-image-frame";

// 图片元素类名。
const IMAGE_ELEMENT_CLASS_NAME = "scribdown-image";

// 图片标题类名。
const IMAGE_CAPTION_CLASS_NAME = "scribdown-image-caption";

// 图片加载失败状态类名。
const IMAGE_FRAME_FAILED_CLASS_NAME = "scribdown-image-frame--failed";

// 图片加载完成状态类名。
const IMAGE_FRAME_LOADED_CLASS_NAME = "scribdown-image-frame--loaded";

// 图片失败态占位内容类名。
const IMAGE_FALLBACK_CLASS_NAME = "scribdown-image-fallback";

// 图片失败态图标类名。
const IMAGE_FALLBACK_ICON_CLASS_NAME = "scribdown-image-fallback-icon";

// 图片失败态标题类名。
const IMAGE_FALLBACK_TEXT_CLASS_NAME = "scribdown-image-fallback-text";

// 图片失败态来源类名。
const IMAGE_FALLBACK_SOURCE_CLASS_NAME = "scribdown-image-fallback-source";

// 图片运行时已绑定标记的 dataset 键。
const IMAGE_HYDRATED_DATA_KEY = "scribdownImageHydrated";

// 图片查看器 dialog 类名。
const IMAGE_VIEWER_DIALOG_CLASS_NAME = "scribdown-image-viewer";

// 图片查看器缩放状态类名。
const IMAGE_VIEWER_ZOOMED_CLASS_NAME = "scribdown-image-viewer--zoomed";

// 图片查看器拖拽状态类名。
const IMAGE_VIEWER_DRAGGING_CLASS_NAME = "scribdown-image-viewer--dragging";

// 图片查看器标题区域类名（包裹 caption + hint）。
const IMAGE_VIEWER_CAPTION_GROUP_CLASS_NAME = "scribdown-image-viewer__caption-group";

// 图片查看器快捷键提示类名。
const IMAGE_VIEWER_HINT_CLASS_NAME = "scribdown-image-viewer__hint";

// 图片查看器快捷键提示文本。
const IMAGE_VIEWER_HINT_TEXT =
  "快捷键：+/= 放大 · - 缩小 · 0 重置 · Esc 关闭 · 鼠标拖拽可平移 · Ctrl/⌘ + 滚轮缩放";

// 图片查看器顶部区域类名。
const IMAGE_VIEWER_CHROME_CLASS_NAME = "scribdown-image-viewer__chrome";

// 图片查看器按钮区域类名。
const IMAGE_VIEWER_CONTROLS_CLASS_NAME = "scribdown-image-viewer__controls";

// 图片查看器按钮类名。
const IMAGE_VIEWER_BUTTON_CLASS_NAME = "scribdown-image-viewer__button";

// 图片查看器关闭按钮修饰类名。
const IMAGE_VIEWER_CLOSE_BUTTON_CLASS_NAME = "scribdown-image-viewer__button--close";

// 图片查看器视口类名。
const IMAGE_VIEWER_VIEWPORT_CLASS_NAME = "scribdown-image-viewer__viewport";

// 图片查看器图片类名。
const IMAGE_VIEWER_IMAGE_CLASS_NAME = "scribdown-image-viewer__image";

// 图片查看器说明文字类名。
const IMAGE_VIEWER_CAPTION_CLASS_NAME = "scribdown-image-viewer__caption";

// 图片查看器缩放数值类名。
const IMAGE_VIEWER_ZOOM_VALUE_CLASS_NAME = "scribdown-image-viewer__zoom-value";

// 图片查看器默认缩放倍数。
const IMAGE_VIEWER_DEFAULT_ZOOM = 1;

// 图片查看器最小缩放倍数。
const IMAGE_VIEWER_MIN_ZOOM = 0.25;

// 图片查看器最大缩放倍数。
const IMAGE_VIEWER_MAX_ZOOM = 4;

// 图片查看器每次缩放步进。
const IMAGE_VIEWER_ZOOM_STEP = 0.25;

// 图片查看器适配视口时预留的安全比例。
const IMAGE_VIEWER_FIT_RATIO = 0.92;

// 图片查看器兜底可访问名称。
const IMAGE_VIEWER_FALLBACK_LABEL = "查看全图";

// 图片查看器关闭按钮文本。
const IMAGE_VIEWER_CLOSE_TEXT = "x";

// 图片查看器放大按钮文本。
const IMAGE_VIEWER_ZOOM_IN_TEXT = "+";

// 图片查看器缩小按钮文本。
const IMAGE_VIEWER_ZOOM_OUT_TEXT = "-";

// 图片查看器重置按钮文本。
const IMAGE_VIEWER_RESET_TEXT = "1:1";

// 每个 document 复用一个图片查看器。
const imageViewerStateByDocument = new WeakMap<Document, MarkdownImageViewerState>();

// 从 dialog 反查图片查看器状态。
const imageViewerStateByDialogElement = new WeakMap<HTMLDialogElement, MarkdownImageViewerState>();

// ==text== 高亮匹配：成对的 == 之间不能换行或再次出现 ==。
const HIGHLIGHT_MARKER_PATTERN = /==([^=\n]+?)==/g;

// 定义列表段落匹配规则：支持 CommonMark 未内建的 term + 下一行冒号定义写法。
const DEFINITION_LIST_PARAGRAPH_PATTERN = /^\s*([^\n:][^\n]*)\n\s*:\s+([^\n]+)\s*$/u;

// 代码块外层 figure 类名。
const CODE_BLOCK_CLASS_NAME = "scribdown-code-block";

// 代码块顶部 chrome 区域类名。
const CODE_BLOCK_CHROME_CLASS_NAME = "scribdown-code-block__chrome";

// 代码块正文区域类名。
const CODE_BLOCK_BODY_CLASS_NAME = "scribdown-code-block__body";

// 代码块语言标签类名。
const CODE_BLOCK_LANG_CLASS_NAME = "scribdown-code-block__lang";

// 代码块复制按钮类名。
const CODE_BLOCK_COPY_CLASS_NAME = "scribdown-code-block__copy";

// 代码块复制按钮图标类名。
const CODE_BLOCK_COPY_ICON_CLASS_NAME = "scribdown-code-block__copy-icon";

// 代码块复制按钮"复制"态图标类名（默认显示）。
const CODE_BLOCK_COPY_ICON_COPY_CLASS_NAME = "scribdown-code-block__copy-icon--copy";

// 代码块复制按钮"已复制"态图标类名（复制成功后显示）。
const CODE_BLOCK_COPY_ICON_CHECK_CLASS_NAME = "scribdown-code-block__copy-icon--check";

// 代码块代码行类名。
const CODE_BLOCK_LINE_CLASS_NAME = "scribdown-code-block__line";

// 代码块空行占位文本，避免空 span 被浏览器完全折叠。
const CODE_BLOCK_EMPTY_LINE_PLACEHOLDER = "\u200b";

// 代码块运行时已绑定标记的 dataset 键。
const CODE_BLOCK_HYDRATED_DATA_KEY = "scribdownCodeBlockHydrated";

// 代码语言标识 → 展示标签的映射。
const CODE_LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  graphql: "GraphQL",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kotlin: "Kotlin",
  less: "Less",
  markdown: "Markdown",
  md: "Markdown",
  php: "PHP",
  python: "Python",
  py: "Python",
  ruby: "Ruby",
  rust: "Rust",
  rs: "Rust",
  sass: "Sass",
  scss: "SCSS",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  swift: "Swift",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  vue: "Vue",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  zsh: "Zsh"
};

// 代码块语言标识缺省值。
const CODE_LANGUAGE_DEFAULT_LABEL = "Text";

// 代码块复制按钮已复制状态恢复延迟，单位毫秒。
const CODE_BLOCK_COPY_RESTORE_DELAY_MS = 1600;

// 代码块复制按钮默认可访问名称。
const CODE_BLOCK_COPY_ARIA_LABEL = "复制代码";

// 代码块复制按钮已复制可访问名称。
const CODE_BLOCK_COPY_ARIA_LABEL_COPIED = "已复制";

// Shiki 高亮主题，与手绘奶黄底色搭配的暖色调亮色主题。
const CODE_HIGHLIGHTER_THEME = "github-light";

// Shiki 高亮预加载语言列表，覆盖 fixture 中出现的常见语言。
const CODE_HIGHLIGHTER_LANGUAGES = [
  "bash",
  "css",
  "diff",
  "html",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "shell",
  "tsx",
  "typescript",
  "yaml"
] as const;

// 单例 Shiki 高亮器的初始化 Promise，确保整个进程只初始化一次。
let codeHighlighterPromise: Promise<Highlighter> | undefined;

// 已经预加载到 Shiki 实例里的语言集合。
const codeHighlighterLoadedLanguages = new Set<string>(CODE_HIGHLIGHTER_LANGUAGES);

// 匹配渲染后 `<pre><code class="language-X">...</code></pre>` 的正则，用于 Shiki 替换。
const CODE_BLOCK_HIGHLIGHT_PATTERN =
  /<pre><code class="language-([\w-]+)">([\s\S]*?)<\/code><\/pre>/g;

// 提取 Shiki HTML 输出中 `<code>...</code>` 之间内容的正则。
const SHIKI_CODE_INNER_PATTERN = /<code[^>]*>([\s\S]*?)<\/code>/u;

/**
 * 将 Markdown 文本转换为 HTML。
 * @param markdownText 输入的 Markdown 文本。
 * @param options 渲染控制参数。
 * @returns 渲染后的 HTML 文本。
 */
export async function renderMarkdown(
  markdownText: string,
  options: RenderMarkdownOptions = {}
): Promise<string> {
  // 渲染流水线：先解析 Markdown 与 GFM 行内标记，再转换为 HTML AST。
  // allowDangerousHtml + rehypeRaw 让 fixture 中的 <u> / <sub> / <sup> / <kbd> 等行内 HTML 保留下来。
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHighlightMark)
    .use(remarkDefinitionLists)
    .use(remarkTableOfContents)
    .use(remarkImageFigures)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);

  if (options.sanitizeHtml) {
    // 关键步骤：在输出前执行 rehype 结构清洗。
    processor.use(rehypeSanitize, createScribdownSanitizeSchema());
  }

  processor.use(rehypeStringify);

  // 渲染输出 HTML 文本。
  const renderedHtml = String(await processor.process(markdownText));

  // 关键步骤：sanitize 之后再做 Shiki 高亮，把 token 的 span/style 添加到信任过滤后的代码体内。
  const sanitizedHtml = await applyMarkdownSanitize(renderedHtml, options);
  const highlightedHtml = await highlightMarkdownCodeBlocks(sanitizedHtml);

  return highlightedHtml;
}

/**
 * 根据渲染选项执行最终 sanitize 步骤。
 * @param renderedHtml unified 渲染后的 HTML。
 * @param options 渲染控制参数。
 * @returns 经过 sanitize 处理（或原样返回）的 HTML。
 */
async function applyMarkdownSanitize(
  renderedHtml: string,
  options: RenderMarkdownOptions
): Promise<string> {
  if (!options.sanitizeHtml) {
    return renderedHtml;
  }

  if (options.sanitize) {
    return options.sanitize(renderedHtml);
  }

  return sanitizeHtmlWithDomPurify(renderedHtml);
}

/**
 * 取得（必要时初始化）Shiki 单例高亮器。
 * @returns 已就绪的 Shiki 高亮器实例。
 */
async function getCodeHighlighter(): Promise<Highlighter> {
  if (!codeHighlighterPromise) {
    codeHighlighterPromise = createHighlighter({
      themes: [CODE_HIGHLIGHTER_THEME],
      langs: [...CODE_HIGHLIGHTER_LANGUAGES]
    });
  }

  return codeHighlighterPromise;
}

/**
 * 把渲染 HTML 中的代码块替换为 Shiki 高亮后的结构。
 * @param html 已渲染（可能已 sanitize）的 HTML 文本。
 * @returns 含高亮 span 的 HTML 文本。
 */
async function highlightMarkdownCodeBlocks(html: string): Promise<string> {
  if (!CODE_BLOCK_HIGHLIGHT_PATTERN.test(html)) {
    return html;
  }
  // RegExp 是 global 状态，重置 lastIndex 以保证多次调用一致。
  CODE_BLOCK_HIGHLIGHT_PATTERN.lastIndex = 0;

  // 取得 Shiki 单例高亮器。
  const highlighter = await getCodeHighlighter();
  // 替换累积器：从输入 HTML 起逐段拼接处理结果。
  let resultHtml = "";
  // 上一段未处理 HTML 的结束索引。
  let lastIndex = 0;

  for (const match of html.matchAll(CODE_BLOCK_HIGHLIGHT_PATTERN)) {
    const [matched, rawLanguage, encodedCode] = match;
    const matchStart = match.index ?? 0;

    resultHtml += html.slice(lastIndex, matchStart);
    resultHtml += await highlightSingleCodeBlock(highlighter, rawLanguage, encodedCode, matched);
    lastIndex = matchStart + matched.length;
  }

  resultHtml += html.slice(lastIndex);
  return resultHtml;
}

/**
 * 高亮单个代码块，必要时按需加载语言。
 * @param highlighter Shiki 高亮器实例。
 * @param rawLanguage 代码块标注的语言标识。
 * @param encodedCode 已 HTML 转义的代码内容。
 * @param matchedHtml 原始匹配片段，作为兜底返回值。
 * @returns 高亮后的代码块 HTML。
 */
async function highlightSingleCodeBlock(
  highlighter: Highlighter,
  rawLanguage: string,
  encodedCode: string,
  matchedHtml: string
): Promise<string> {
  // 归一化语言标识：去除大小写差异，方便匹配 Shiki 内置名。
  const normalizedLanguage = rawLanguage.toLowerCase();
  // Shiki 中真实可用的语言标识，找不到时退回 "text"。
  const resolvedLanguage = await ensureHighlighterLanguage(highlighter, normalizedLanguage);

  // 还原 HTML 转义，得到 Shiki 期望的原始代码。
  const codeText = decodeHtmlEntities(encodedCode);

  try {
    // Shiki 输出形如 `<pre class="shiki ..."><code><span class="line">...</span></code></pre>`。
    const highlightedHtml = highlighter.codeToHtml(codeText, {
      lang: resolvedLanguage,
      theme: CODE_HIGHLIGHTER_THEME
    });
    // 仅保留 `<code>` 内部内容，外层 `<pre><code>` 沿用原结构，便于 hydrate 识别。
    const innerMatch = highlightedHtml.match(SHIKI_CODE_INNER_PATTERN);
    const innerHtml = innerMatch?.[1] ?? encodedCode;

    return `<pre><code class="language-${rawLanguage}">${innerHtml}</code></pre>`;
  } catch {
    // Shiki 调用异常时（语言未注册等）原样返回，避免影响整体渲染。
    return matchedHtml;
  }
}

/**
 * 在 Shiki 高亮器里确保给定语言可用，必要时动态加载。
 * @param highlighter Shiki 高亮器实例。
 * @param normalizedLanguage 已归一化的语言标识。
 * @returns 高亮时可使用的语言标识。
 */
async function ensureHighlighterLanguage(
  highlighter: Highlighter,
  normalizedLanguage: string
): Promise<string> {
  if (normalizedLanguage.length === 0) {
    return "text";
  }

  if (codeHighlighterLoadedLanguages.has(normalizedLanguage)) {
    return normalizedLanguage;
  }

  try {
    await highlighter.loadLanguage(
      normalizedLanguage as Parameters<Highlighter["loadLanguage"]>[0]
    );
    codeHighlighterLoadedLanguages.add(normalizedLanguage);
    return normalizedLanguage;
  } catch {
    return "text";
  }
}

/**
 * 还原 HTML 文本中常见的字符实体。
 * @param encodedText HTML 转义后的文本。
 * @returns 还原后的原始文本。
 */
function decodeHtmlEntities(encodedText: string): string {
  return encodedText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * 将代码片段渲染为高亮 HTML。
 * @param codeText 代码文本。
 * @param language 代码语言。
 * @returns 高亮后的 HTML 字符串。
 */
export async function renderCodeToHtml(codeText: string, language: string): Promise<string> {
  // 创建一次性高亮器用于最小可运行示例。
  const highlighter = await createHighlighter({
    themes: ["github-light"],
    langs: ["typescript", "javascript", "json", "bash", language]
  });

  return highlighter.codeToHtml(codeText, {
    lang: language,
    theme: "github-light"
  });
}

/**
 * 使用 DOMPurify 清洗 HTML。
 * @param unsafeHtml 未清洗的 HTML。
 * @returns 清洗后的 HTML。
 */
export function sanitizeHtmlWithDomPurify(unsafeHtml: string): string {
  // DOMPurify 在 Node 环境下没有绑定 window 时会以工厂形态存在。
  const domPurify = DOMPurify as { sanitize?: (unsafeHtml: string) => string };

  if (typeof domPurify.sanitize !== "function") {
    return unsafeHtml;
  }

  return domPurify.sanitize(unsafeHtml);
}

/**
 * 给渲染后的图片绑定加载状态类名。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
export function hydrateMarkdownImages(rootElement: ParentNode): void {
  // 当前根节点内的所有图片元素。
  const imageElements = rootElement.querySelectorAll<HTMLImageElement>(
    `img.${IMAGE_ELEMENT_CLASS_NAME}`
  );

  imageElements.forEach(bindMarkdownImageState);
}

/**
 * 把渲染后的代码块包装为带语言标签、复制按钮与行号的 chrome 结构。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
export function hydrateCodeBlocks(rootElement: ParentNode): void {
  // 当前根节点内的所有未绑定 chrome 的 pre 元素。
  const preElements = rootElement.querySelectorAll<HTMLPreElement>("pre");

  preElements.forEach(decorateCodeBlock);
}

/**
 * 给单个 pre 元素加上 chrome 结构与复制行为。
 * @param preElement 渲染产出的 pre 元素。
 */
function decorateCodeBlock(preElement: HTMLPreElement): void {
  // 已经包裹过 figure 时直接跳过，避免重复 hydrate。
  if (preElement.parentElement?.classList.contains(CODE_BLOCK_CLASS_NAME)) {
    return;
  }

  if (preElement.dataset[CODE_BLOCK_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  // pre 内部的 code 元素，无 code 子节点时认定为非代码块。
  const codeElement = preElement.querySelector<HTMLElement>(":scope > code");

  if (!codeElement) {
    return;
  }

  preElement.dataset[CODE_BLOCK_HYDRATED_DATA_KEY] = "true";

  // 当前 pre 所属的 document，用于创建子节点。
  const ownerDocument = preElement.ownerDocument;
  // 代码块语言标识。
  const languageId = resolveCodeBlockLanguageId(codeElement);
  // 语言展示标签。
  const languageLabel = resolveCodeBlockLanguageLabel(languageId);

  // 关键步骤：在替换 DOM 前抓取原始代码文本，便于复制按钮使用。
  const originalCodeText = codeElement.textContent ?? "";

  // 把代码内容按行拆分为带类名的 span，便于 CSS 计数器渲染行号。
  rewriteCodeBlockLines(codeElement, ownerDocument);

  // 顶部 chrome 区域，承载语言标签与复制按钮。
  const chromeElement = ownerDocument.createElement("div");
  chromeElement.className = CODE_BLOCK_CHROME_CLASS_NAME;

  // 语言标签元素。
  const langElement = ownerDocument.createElement("span");
  langElement.className = CODE_BLOCK_LANG_CLASS_NAME;
  langElement.textContent = languageLabel;
  chromeElement.append(langElement);

  // 复制按钮元素。
  const copyButtonElement = createCodeBlockCopyButton(ownerDocument);
  chromeElement.append(copyButtonElement);

  // 外层 figure 容器，让 chrome 与 pre 在同一手绘边框内。
  const figureElement = ownerDocument.createElement("figure");
  figureElement.className = CODE_BLOCK_CLASS_NAME;
  figureElement.dataset.scribdownCodeLang = languageId;

  // 正文容器，用于独立绘制代码区分隔线和纸面。
  const bodyElement = ownerDocument.createElement("div");
  bodyElement.className = CODE_BLOCK_BODY_CLASS_NAME;

  // 把 pre 替换为 figure，再把 chrome + body + 原 pre 放进 figure。
  preElement.replaceWith(figureElement);
  bodyElement.append(preElement);
  figureElement.append(chromeElement, bodyElement);

  // 在按钮上记录原始代码文本，复制时直接读取，无需再走 DOM。
  copyButtonElement.dataset.scribdownCodeSource = originalCodeText;
  copyButtonElement.addEventListener("click", handleCodeBlockCopyClick);
}

/**
 * 解析 pre > code 节点的语言标识。
 * @param codeElement pre 内部的 code 元素。
 * @returns 语言标识，未识别时返回空字符串。
 */
function resolveCodeBlockLanguageId(codeElement: HTMLElement): string {
  // class 列表中以 language- 开头的类名记录了语言标识。
  const languageClassName = Array.from(codeElement.classList).find((className) =>
    className.startsWith("language-")
  );

  if (!languageClassName) {
    return "";
  }

  return languageClassName.slice("language-".length).toLowerCase();
}

/**
 * 把语言标识转换为可读展示标签。
 * @param languageId 语言标识。
 * @returns 用于 chrome 的语言展示文本。
 */
function resolveCodeBlockLanguageLabel(languageId: string): string {
  if (!languageId) {
    return CODE_LANGUAGE_DEFAULT_LABEL;
  }

  // 优先使用预定义映射，未命中时退化为首字母大写。
  const mappedLabel = CODE_LANGUAGE_DISPLAY_NAMES[languageId];

  if (mappedLabel) {
    return mappedLabel;
  }

  return languageId.charAt(0).toUpperCase() + languageId.slice(1);
}

/**
 * 把代码内容按行拆分为带类名的 span，配合 CSS 计数器渲染行号。
 * Shiki 已经输出 `<span class="line">` 时直接复用并补充类名，否则做纯文本拆分。
 * @param codeElement pre 内部的 code 元素。
 * @param ownerDocument 当前 document。
 */
function rewriteCodeBlockLines(codeElement: HTMLElement, ownerDocument: Document): void {
  // Shiki 高亮输出的行 span 列表。
  const shikiLineElements = codeElement.querySelectorAll<HTMLElement>(":scope > span.line");

  if (shikiLineElements.length > 0) {
    // Shiki 行节点数组，用于重排 code 子节点并移除行间格式化换行。
    const shikiLineNodes = Array.from(shikiLineElements);

    shikiLineElements.forEach((lineElement) => {
      lineElement.classList.add(CODE_BLOCK_LINE_CLASS_NAME);
      // 空行使用零宽占位，行高统一继承 pre 的设置。
      if (lineElement.textContent === "") {
        lineElement.textContent = CODE_BLOCK_EMPTY_LINE_PLACEHOLDER;
      }
    });

    // 关键步骤：删除 Shiki 在行 span 之间输出的换行文本节点，避免 pre 把它们渲染成额外行距。
    codeElement.replaceChildren(...shikiLineNodes);
    return;
  }

  // 代码块的全部文本内容。
  const codeText = codeElement.textContent ?? "";
  // 去掉结尾多余换行，避免最后多出一个空行号。
  const trimmedCodeText = codeText.replace(/\n+$/u, "");
  // 按换行符切分得到每一行原文。
  const codeLines = trimmedCodeText.split("\n");

  // 清空 code 现有子节点，重新生成行容器。
  while (codeElement.firstChild) {
    codeElement.removeChild(codeElement.firstChild);
  }

  codeLines.forEach((lineText) => {
    // 当前行的 span 容器，依赖 CSS `display: block` 提供视觉换行。
    const lineElement = ownerDocument.createElement("span");
    lineElement.className = CODE_BLOCK_LINE_CLASS_NAME;
    // 空行使用零宽占位，行高统一继承 pre 的设置。
    if (lineText.length === 0) {
      lineElement.textContent = CODE_BLOCK_EMPTY_LINE_PLACEHOLDER;
    } else {
      lineElement.textContent = lineText;
    }
    codeElement.append(lineElement);
  });
}

/**
 * "复制"态图标的 SVG 内部路径（双层叠放的矩形 + 复笔），
 * 直接内嵌以便用 currentColor 跟随按钮 hover / focus 颜色。
 */
const CODE_BLOCK_COPY_ICON_COPY_PATHS =
  '<path d="M8.4 6.8 C10.4 6.5 12.6 6.7 14.6 6.6 C16 6.6 16.5 7.2 16.6 8.6 C16.7 10.8 16.6 13.2 16.6 15.4 C16.5 16.6 15.8 17.2 14.6 17.2 C12.4 17.3 10.2 17.2 8 17.2 C6.6 17.2 6.2 16.6 6.2 15.4 C6.2 13.2 6.2 11 6.2 8.8 C6.2 7.4 6.8 6.8 8.4 6.8 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M8.6 7.4 C10.6 7.2 12.6 7.4 14.4 7.3" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>' +
  '<path d="M3.6 12.8 C3.4 11.0 3.4 9.0 3.5 7.0 C3.5 5.0 3.4 3.6 5.2 3.4 C7.2 3.2 9.2 3.4 11.2 3.4 C12.6 3.4 13.2 4.0 13.3 5.0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M4.4 12.4 C4.2 10.6 4.2 8.8 4.2 7.0" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>';

/**
 * "已复制"态图标的 SVG 内部路径（对勾 + 复笔），currentColor 由按钮状态控制。
 */
const CODE_BLOCK_COPY_ICON_CHECK_PATHS =
  '<path d="M4.2 10.6 C5.6 11.8 6.8 13.2 8.2 14.6 C10.4 11.6 13.0 8.6 16.0 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M4.6 11.4 C5.6 12.4 6.8 13.6 7.8 14.6 C10.2 12.2 12.6 9.6 15.2 7.0" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>';

/**
 * 创建代码块复制按钮节点，仅包含图标，无文字标签。
 * @param ownerDocument 当前 document。
 * @returns 已配置类名与 aria 信息的按钮元素。
 */
function createCodeBlockCopyButton(ownerDocument: Document): HTMLButtonElement {
  // 复制按钮元素。
  const copyButtonElement = ownerDocument.createElement("button");
  copyButtonElement.type = "button";
  copyButtonElement.className = CODE_BLOCK_COPY_CLASS_NAME;
  copyButtonElement.setAttribute("aria-label", CODE_BLOCK_COPY_ARIA_LABEL);

  // 默认 "copy" 状态图标。
  const copyIconElement = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  copyIconElement.setAttribute(
    "class",
    `${CODE_BLOCK_COPY_ICON_CLASS_NAME} ${CODE_BLOCK_COPY_ICON_COPY_CLASS_NAME}`
  );
  copyIconElement.setAttribute("viewBox", "0 0 20 20");
  copyIconElement.setAttribute("aria-hidden", "true");
  copyIconElement.setAttribute("focusable", "false");
  copyIconElement.innerHTML = CODE_BLOCK_COPY_ICON_COPY_PATHS;
  copyButtonElement.append(copyIconElement);

  // "已复制" 状态图标，初始隐藏，由 CSS 根据 data 属性切换显示。
  const checkIconElement = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  checkIconElement.setAttribute(
    "class",
    `${CODE_BLOCK_COPY_ICON_CLASS_NAME} ${CODE_BLOCK_COPY_ICON_CHECK_CLASS_NAME}`
  );
  checkIconElement.setAttribute("viewBox", "0 0 20 20");
  checkIconElement.setAttribute("aria-hidden", "true");
  checkIconElement.setAttribute("focusable", "false");
  checkIconElement.innerHTML = CODE_BLOCK_COPY_ICON_CHECK_PATHS;
  copyButtonElement.append(checkIconElement);

  return copyButtonElement;
}

/**
 * 处理代码块复制按钮点击事件。
 * @param event 复制按钮点击事件。
 */
function handleCodeBlockCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮元素。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 待复制的代码文本。
  const codeText = copyButtonElement.dataset.scribdownCodeSource ?? "";

  void writeCodeBlockTextToClipboard(codeText).then((isSucceeded) => {
    if (isSucceeded) {
      flashCodeBlockCopyButton(copyButtonElement);
    }
  });
}

/**
 * 把代码文本写入剪贴板，兼容不支持 navigator.clipboard 的环境。
 * @param codeText 待复制的代码文本。
 * @returns 是否复制成功。
 */
async function writeCodeBlockTextToClipboard(codeText: string): Promise<boolean> {
  // 现代浏览器优先使用 navigator.clipboard。
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(codeText);
      return true;
    } catch {
      // 安全上下文外可能会抛出，回落到 execCommand 兜底。
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  // 兜底：用临时 textarea + execCommand 完成复制。
  const fallbackTextarea = document.createElement("textarea");
  fallbackTextarea.value = codeText;
  fallbackTextarea.setAttribute("readonly", "");
  fallbackTextarea.style.position = "fixed";
  fallbackTextarea.style.opacity = "0";
  fallbackTextarea.style.pointerEvents = "none";
  document.body.append(fallbackTextarea);
  fallbackTextarea.select();

  // 兼容旧浏览器的 execCommand 返回值。
  const isSucceeded = document.execCommand("copy");

  fallbackTextarea.remove();
  return isSucceeded;
}

/**
 * 让复制按钮短暂显示已复制状态。
 * @param copyButtonElement 被点击的复制按钮。
 */
function flashCodeBlockCopyButton(copyButtonElement: HTMLButtonElement): void {
  // 切换 data 属性 + aria-label，CSS 会根据 data 属性切换两张 SVG 图标。
  copyButtonElement.dataset.scribdownCodeCopied = "true";
  copyButtonElement.setAttribute("aria-label", CODE_BLOCK_COPY_ARIA_LABEL_COPIED);

  // 延迟恢复初始状态，给用户一个肉眼可见的反馈窗口。
  window.setTimeout(() => {
    delete copyButtonElement.dataset.scribdownCodeCopied;
    copyButtonElement.setAttribute("aria-label", CODE_BLOCK_COPY_ARIA_LABEL);
  }, CODE_BLOCK_COPY_RESTORE_DELAY_MS);
}

/**
 * 给单个图片元素绑定加载、失败状态与全图查看行为。
 * @param imageElement 待绑定状态的图片元素。
 */
function bindMarkdownImageState(imageElement: HTMLImageElement): void {
  updateMarkdownImageState(imageElement);

  if (imageElement.dataset[IMAGE_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  imageElement.dataset[IMAGE_HYDRATED_DATA_KEY] = "true";
  imageElement.addEventListener("load", handleMarkdownImageLoad);
  imageElement.addEventListener("error", handleMarkdownImageError);
  bindMarkdownImageViewer(imageElement);
}

/**
 * 处理图片加载成功事件。
 * @param event 图片加载事件。
 */
function handleMarkdownImageLoad(event: Event): void {
  // 触发加载事件的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  updateMarkdownImageState(imageElement);
}

/**
 * 处理图片加载失败事件。
 * @param event 图片加载失败事件。
 */
function handleMarkdownImageError(event: Event): void {
  // 触发失败事件的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  updateMarkdownImageState(imageElement);
}

/**
 * 根据图片当前加载结果更新 frame 状态类。
 * @param imageElement 待更新状态的图片元素。
 */
function updateMarkdownImageState(imageElement: HTMLImageElement): void {
  // 图片外层 frame 元素。
  const frameElement = imageElement.closest<HTMLElement>(`.${IMAGE_FRAME_CLASS_NAME}`);

  if (!frameElement) {
    return;
  }

  // 当前图片是否已确认加载失败。
  const isFailed = imageElement.complete && imageElement.naturalWidth === 0;
  // 当前图片是否已确认加载完成。
  const isLoaded = imageElement.complete && imageElement.naturalWidth > 0;

  frameElement.classList.toggle(IMAGE_FRAME_FAILED_CLASS_NAME, isFailed);
  frameElement.classList.toggle(IMAGE_FRAME_LOADED_CLASS_NAME, isLoaded);
}

/**
 * 给图片绑定全图查看入口。
 * @param imageElement 待绑定的图片元素。
 */
function bindMarkdownImageViewer(imageElement: HTMLImageElement): void {
  // 图片外层链接元素，存在时保留原始链接行为。
  const linkElement = imageElement.closest("a[href]");

  if (linkElement) {
    return;
  }

  imageElement.setAttribute("role", "button");
  imageElement.setAttribute("tabindex", "0");
  imageElement.setAttribute("aria-label", createMarkdownImageViewerAriaLabel(imageElement));
  imageElement.addEventListener("click", handleMarkdownImageViewerOpenClick);
  imageElement.addEventListener("keydown", handleMarkdownImageViewerOpenKeyDown);
}

/**
 * 处理图片点击打开全图查看器。
 * @param event 图片点击事件。
 */
function handleMarkdownImageViewerOpenClick(event: MouseEvent): void {
  // 被点击的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  if (!canOpenMarkdownImageViewer(imageElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openMarkdownImageViewer(imageElement);
}

/**
 * 处理图片键盘打开全图查看器。
 * @param event 图片键盘事件。
 */
function handleMarkdownImageViewerOpenKeyDown(event: KeyboardEvent): void {
  // 当前按键是否是打开操作。
  const isOpenKey = event.key === "Enter" || event.key === " ";
  // 当前聚焦的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  if (!isOpenKey || !canOpenMarkdownImageViewer(imageElement)) {
    return;
  }

  event.preventDefault();
  openMarkdownImageViewer(imageElement);
}

/**
 * 判断图片是否可以进入全图查看。
 * @param imageElement 待判断的图片元素。
 * @returns 图片是否已经加载成功且存在有效来源。
 */
function canOpenMarkdownImageViewer(imageElement: HTMLImageElement): boolean {
  // 图片可展示来源。
  const imageSource = getMarkdownImageSource(imageElement);

  return (
    imageSource.length > 0 &&
    imageElement.complete &&
    imageElement.naturalWidth > 0 &&
    imageElement.naturalHeight > 0
  );
}

/**
 * 打开图片全图查看器。
 * @param sourceImageElement 触发查看的原始图片元素。
 */
function openMarkdownImageViewer(sourceImageElement: HTMLImageElement): void {
  // 图片可展示来源。
  const imageSource = getMarkdownImageSource(sourceImageElement);

  if (imageSource.length === 0) {
    return;
  }

  // 原始图片所在 document。
  const ownerDocument = sourceImageElement.ownerDocument;
  // 当前 document 对应的查看器状态。
  const viewerState = getOrCreateMarkdownImageViewerState(ownerDocument);
  // 原始图片可访问名称。
  const imageLabel = createMarkdownImageViewerCaption(sourceImageElement, imageSource);

  viewerState.sourceImageElement = sourceImageElement;
  viewerState.naturalWidth = sourceImageElement.naturalWidth;
  viewerState.naturalHeight = sourceImageElement.naturalHeight;
  viewerState.imageElement.src = imageSource;
  viewerState.imageElement.alt = sourceImageElement.alt;
  viewerState.captionElement.textContent = imageLabel;
  viewerState.dialogElement.setAttribute(
    "aria-label",
    createMarkdownImageViewerAriaLabel(sourceImageElement)
  );
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  viewerState.zoomValue = IMAGE_VIEWER_DEFAULT_ZOOM;

  showMarkdownImageViewerDialog(viewerState);
  requestMarkdownImageViewerLayout(viewerState);
}

/**
 * 获取或创建当前 document 的图片查看器。
 * @param ownerDocument 图片所在 document。
 * @returns 当前 document 可复用的查看器状态。
 */
function getOrCreateMarkdownImageViewerState(ownerDocument: Document): MarkdownImageViewerState {
  // 已创建的查看器状态。
  const existingViewerState = imageViewerStateByDocument.get(ownerDocument);

  if (existingViewerState) {
    return existingViewerState;
  }

  // 新创建的查看器状态。
  const createdViewerState = createMarkdownImageViewerState(ownerDocument);

  imageViewerStateByDocument.set(ownerDocument, createdViewerState);

  return createdViewerState;
}

/**
 * 创建图片查看器 DOM 与事件绑定。
 * @param ownerDocument 图片所在 document。
 * @returns 图片查看器状态。
 */
function createMarkdownImageViewerState(ownerDocument: Document): MarkdownImageViewerState {
  // 图片查看器 dialog。
  const dialogElement = ownerDocument.createElement("dialog") as HTMLDialogElement;
  // 图片查看器顶部区域。
  const chromeElement = ownerDocument.createElement("div");
  // 图片查看器标题分组（caption + hint）。
  const captionGroupElement = ownerDocument.createElement("div");
  // 图片查看器说明文字。
  const captionElement = ownerDocument.createElement("p");
  // 图片查看器快捷键提示。
  const hintElement = ownerDocument.createElement("p");
  // 图片查看器按钮区域。
  const controlsElement = ownerDocument.createElement("div");
  // 缩小按钮。
  const zoomOutButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: "缩小图片",
    text: IMAGE_VIEWER_ZOOM_OUT_TEXT
  });
  // 当前缩放比例文本。
  const zoomValueElement = ownerDocument.createElement("span");
  // 放大按钮。
  const zoomInButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: "放大图片",
    text: IMAGE_VIEWER_ZOOM_IN_TEXT
  });
  // 重置缩放按钮。
  const resetButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: "重置缩放",
    text: IMAGE_VIEWER_RESET_TEXT
  });
  // 关闭按钮。
  const closeButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: "关闭全图查看",
    className: IMAGE_VIEWER_CLOSE_BUTTON_CLASS_NAME,
    text: IMAGE_VIEWER_CLOSE_TEXT
  });
  // 图片滚动视口。
  const viewportElement = ownerDocument.createElement("div");
  // 查看器内展示的图片。
  const imageElement = ownerDocument.createElement("img");
  // 图片查看器运行时状态。
  const viewerState: MarkdownImageViewerState = {
    captionElement,
    closeButtonElement,
    dialogElement,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartScrollLeft: 0,
    dragStartScrollTop: 0,
    hintElement,
    imageElement,
    isDragging: false,
    naturalHeight: 1,
    naturalWidth: 1,
    resetButtonElement,
    viewportElement,
    zoomInButtonElement,
    zoomOutButtonElement,
    zoomValue: IMAGE_VIEWER_DEFAULT_ZOOM,
    zoomValueElement
  };
  // 当前 document 对应的 window。
  const ownerWindow = ownerDocument.defaultView;

  dialogElement.className = IMAGE_VIEWER_DIALOG_CLASS_NAME;
  dialogElement.setAttribute("aria-modal", "true");
  dialogElement.setAttribute("tabindex", "-1");
  chromeElement.className = IMAGE_VIEWER_CHROME_CLASS_NAME;
  captionGroupElement.className = IMAGE_VIEWER_CAPTION_GROUP_CLASS_NAME;
  captionElement.className = IMAGE_VIEWER_CAPTION_CLASS_NAME;
  hintElement.className = IMAGE_VIEWER_HINT_CLASS_NAME;
  hintElement.textContent = IMAGE_VIEWER_HINT_TEXT;
  controlsElement.className = IMAGE_VIEWER_CONTROLS_CLASS_NAME;
  zoomValueElement.className = IMAGE_VIEWER_ZOOM_VALUE_CLASS_NAME;
  viewportElement.className = IMAGE_VIEWER_VIEWPORT_CLASS_NAME;
  imageElement.className = IMAGE_VIEWER_IMAGE_CLASS_NAME;
  imageElement.decoding = "async";

  imageViewerStateByDialogElement.set(dialogElement, viewerState);
  controlsElement.append(
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    closeButtonElement
  );
  captionGroupElement.append(captionElement, hintElement);
  chromeElement.append(captionGroupElement, controlsElement);
  viewportElement.append(imageElement);
  dialogElement.append(chromeElement, viewportElement);
  ownerDocument.body.append(dialogElement);

  dialogElement.addEventListener("click", handleMarkdownImageViewerBackdropClick);
  dialogElement.addEventListener("close", handleMarkdownImageViewerClose);
  dialogElement.addEventListener("keydown", handleMarkdownImageViewerKeyDown);
  viewportElement.addEventListener("wheel", handleMarkdownImageViewerWheel, { passive: false });
  viewportElement.addEventListener("pointerdown", handleMarkdownImageViewerPointerDown);
  viewportElement.addEventListener("pointermove", handleMarkdownImageViewerPointerMove);
  viewportElement.addEventListener("pointerup", handleMarkdownImageViewerPointerUp);
  viewportElement.addEventListener("pointercancel", handleMarkdownImageViewerPointerUp);
  imageElement.addEventListener("load", handleMarkdownImageViewerImageLoad);
  imageElement.addEventListener("dragstart", handleMarkdownImageViewerImageDragStart);
  zoomOutButtonElement.addEventListener("click", handleMarkdownImageViewerZoomOutClick);
  zoomInButtonElement.addEventListener("click", handleMarkdownImageViewerZoomInClick);
  resetButtonElement.addEventListener("click", handleMarkdownImageViewerResetClick);
  closeButtonElement.addEventListener("click", handleMarkdownImageViewerCloseClick);

  if (ownerWindow) {
    ownerWindow.addEventListener("resize", handleMarkdownImageViewerWindowResize);
  }

  updateMarkdownImageViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);

  return viewerState;
}

/**
 * 创建图片查看器按钮。
 * @param ownerDocument 按钮所在 document。
 * @param options 按钮文本、可访问名称和修饰类。
 * @returns 图片查看器按钮元素。
 */
function createMarkdownImageViewerButton(
  ownerDocument: Document,
  options: MarkdownImageViewerButtonOptions
): HTMLButtonElement {
  // 图片查看器按钮元素。
  const buttonElement = ownerDocument.createElement("button");

  buttonElement.type = "button";
  buttonElement.className = options.className
    ? `${IMAGE_VIEWER_BUTTON_CLASS_NAME} ${options.className}`
    : IMAGE_VIEWER_BUTTON_CLASS_NAME;
  buttonElement.textContent = options.text;
  buttonElement.setAttribute("aria-label", options.ariaLabel);

  return buttonElement;
}

/**
 * 显示图片查看器 dialog。
 * @param viewerState 图片查看器状态。
 */
function showMarkdownImageViewerDialog(viewerState: MarkdownImageViewerState): void {
  if (typeof viewerState.dialogElement.showModal === "function") {
    if (!viewerState.dialogElement.open) {
      viewerState.dialogElement.showModal();
    }
  } else {
    viewerState.dialogElement.setAttribute("open", "");
  }

  viewerState.dialogElement.focus();
}

/**
 * 延后一次布局计算，确保 dialog 已经进入可测量状态。
 * @param viewerState 图片查看器状态。
 */
function requestMarkdownImageViewerLayout(viewerState: MarkdownImageViewerState): void {
  // 图片查看器所在 window。
  const ownerWindow = viewerState.dialogElement.ownerDocument.defaultView;

  if (!ownerWindow) {
    updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue);
    return;
  }

  ownerWindow.setTimeout(handleMarkdownImageViewerDeferredLayout, 0, viewerState);
}

/**
 * 处理延后的图片查看器布局计算。
 * @param viewerState 图片查看器状态。
 */
function handleMarkdownImageViewerDeferredLayout(viewerState: MarkdownImageViewerState): void {
  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue);
}

/**
 * 处理点击遮罩关闭图片查看器。
 * @param event 查看器点击事件。
 */
function handleMarkdownImageViewerBackdropClick(event: MouseEvent): void {
  if (event.target !== event.currentTarget) {
    return;
  }

  // 被点击的 dialog。
  const dialogElement = event.currentTarget as HTMLDialogElement;
  // 图片查看器状态。
  const viewerState = imageViewerStateByDialogElement.get(dialogElement);

  if (!viewerState) {
    return;
  }

  closeMarkdownImageViewer(viewerState);
}

/**
 * 处理图片查看器关闭后的状态复位。
 * @param event 查看器关闭事件。
 */
function handleMarkdownImageViewerClose(event: Event): void {
  // 被关闭的 dialog。
  const dialogElement = event.currentTarget as HTMLDialogElement;
  // 图片查看器状态。
  const viewerState = imageViewerStateByDialogElement.get(dialogElement);

  if (!viewerState) {
    return;
  }

  resetMarkdownImageViewerAfterClose(viewerState);
}

/**
 * 处理查看器内键盘缩放和关闭。
 * @param event 查看器键盘事件。
 */
function handleMarkdownImageViewerKeyDown(event: KeyboardEvent): void {
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue + IMAGE_VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue - IMAGE_VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "0") {
    event.preventDefault();
    updateMarkdownImageViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeMarkdownImageViewer(viewerState);
  }
}

/**
 * 处理 ctrl/cmd + 滚轮缩放图片。
 * @param event 图片查看器滚轮事件。
 */
function handleMarkdownImageViewerWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  // 滚轮方向换算出的缩放步进。
  const zoomDelta = event.deltaY < 0 ? IMAGE_VIEWER_ZOOM_STEP : -IMAGE_VIEWER_ZOOM_STEP;

  event.preventDefault();
  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue + zoomDelta, {
    x: event.clientX,
    y: event.clientY
  });
}

/**
 * 处理图片视口鼠标按下，开启拖拽平移。
 * @param event 视口指针事件。
 */
function handleMarkdownImageViewerPointerDown(event: PointerEvent): void {
  // 仅响应鼠标主键 / 触摸 / 笔。
  if (event.button !== 0) {
    return;
  }

  // 当前事件所在视口。
  const viewportElement = event.currentTarget as HTMLElement;
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  // 视口是否存在可滚动空间。
  const canScrollHorizontally = viewportElement.scrollWidth > viewportElement.clientWidth;
  const canScrollVertically = viewportElement.scrollHeight > viewportElement.clientHeight;

  if (!canScrollHorizontally && !canScrollVertically) {
    return;
  }

  viewerState.isDragging = true;
  viewerState.dragStartClientX = event.clientX;
  viewerState.dragStartClientY = event.clientY;
  viewerState.dragStartScrollLeft = viewportElement.scrollLeft;
  viewerState.dragStartScrollTop = viewportElement.scrollTop;
  viewerState.dialogElement.classList.add(IMAGE_VIEWER_DRAGGING_CLASS_NAME);

  if (typeof viewportElement.setPointerCapture === "function") {
    viewportElement.setPointerCapture(event.pointerId);
  }

  event.preventDefault();
}

/**
 * 处理图片视口指针移动，跟随鼠标更新滚动位置。
 * @param event 视口指针事件。
 */
function handleMarkdownImageViewerPointerMove(event: PointerEvent): void {
  // 当前事件所在视口。
  const viewportElement = event.currentTarget as HTMLElement;
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState || !viewerState.isDragging) {
    return;
  }

  // 当前位移量：与起点的差值。
  const deltaX = event.clientX - viewerState.dragStartClientX;
  const deltaY = event.clientY - viewerState.dragStartClientY;

  viewportElement.scrollLeft = viewerState.dragStartScrollLeft - deltaX;
  viewportElement.scrollTop = viewerState.dragStartScrollTop - deltaY;
}

/**
 * 处理图片视口指针抬起/取消，结束拖拽。
 * @param event 视口指针事件。
 */
function handleMarkdownImageViewerPointerUp(event: PointerEvent): void {
  // 当前事件所在视口。
  const viewportElement = event.currentTarget as HTMLElement;
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState || !viewerState.isDragging) {
    return;
  }

  viewerState.isDragging = false;
  viewerState.dialogElement.classList.remove(IMAGE_VIEWER_DRAGGING_CLASS_NAME);

  if (
    typeof viewportElement.releasePointerCapture === "function" &&
    viewportElement.hasPointerCapture(event.pointerId)
  ) {
    viewportElement.releasePointerCapture(event.pointerId);
  }
}

/**
 * 阻止图片原生拖拽，避免与平移手势冲突。
 * @param event 图片拖拽事件。
 */
function handleMarkdownImageViewerImageDragStart(event: DragEvent): void {
  event.preventDefault();
}

/**
 * 处理查看器图片加载后尺寸同步。
 * @param event 图片加载事件。
 */
function handleMarkdownImageViewerImageLoad(event: Event): void {
  // 查看器图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;
  // 图片所在 dialog。
  const dialogElement = imageElement.closest<HTMLDialogElement>(
    `.${IMAGE_VIEWER_DIALOG_CLASS_NAME}`
  );

  if (!dialogElement) {
    return;
  }

  // 图片查看器状态。
  const viewerState = imageViewerStateByDialogElement.get(dialogElement);

  if (!viewerState) {
    return;
  }

  viewerState.naturalWidth = imageElement.naturalWidth || viewerState.naturalWidth;
  viewerState.naturalHeight = imageElement.naturalHeight || viewerState.naturalHeight;
  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue);
}

/**
 * 处理窗口尺寸变化后的图片适配。
 * @param event window resize 事件。
 */
function handleMarkdownImageViewerWindowResize(event: Event): void {
  // 触发 resize 的 window。
  const ownerWindow = event.currentTarget as Window;
  // 当前 window 对应的查看器状态。
  const viewerState = imageViewerStateByDocument.get(ownerWindow.document);

  if (!viewerState || !isMarkdownImageViewerOpen(viewerState)) {
    return;
  }

  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue);
}

/**
 * 处理缩小按钮点击。
 * @param event 缩小按钮点击事件。
 */
function handleMarkdownImageViewerZoomOutClick(event: MouseEvent): void {
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue - IMAGE_VIEWER_ZOOM_STEP);
}

/**
 * 处理放大按钮点击。
 * @param event 放大按钮点击事件。
 */
function handleMarkdownImageViewerZoomInClick(event: MouseEvent): void {
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue + IMAGE_VIEWER_ZOOM_STEP);
}

/**
 * 处理重置缩放按钮点击。
 * @param event 重置按钮点击事件。
 */
function handleMarkdownImageViewerResetClick(event: MouseEvent): void {
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  updateMarkdownImageViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);
}

/**
 * 处理关闭按钮点击。
 * @param event 关闭按钮点击事件。
 */
function handleMarkdownImageViewerCloseClick(event: MouseEvent): void {
  // 图片查看器状态。
  const viewerState = getMarkdownImageViewerStateFromEvent(event);

  if (!viewerState) {
    return;
  }

  closeMarkdownImageViewer(viewerState);
}

/**
 * 根据事件目标找到图片查看器状态。
 * @param event 来自图片查看器内部的事件。
 * @returns 图片查看器状态，不存在时返回 undefined。
 */
function getMarkdownImageViewerStateFromEvent(event: Event): MarkdownImageViewerState | undefined {
  // 当前事件绑定元素。
  const currentTargetElement = event.currentTarget as HTMLElement | null;

  if (!currentTargetElement) {
    return undefined;
  }

  // 当前元素所属 dialog。
  const dialogElement = currentTargetElement.closest<HTMLDialogElement>(
    `.${IMAGE_VIEWER_DIALOG_CLASS_NAME}`
  );

  if (!dialogElement) {
    return undefined;
  }

  return imageViewerStateByDialogElement.get(dialogElement);
}

/**
 * 更新图片查看器缩放比例和展示尺寸。
 * @param viewerState 图片查看器状态。
 * @param nextZoom 目标缩放倍数。
 * @param zoomAnchor 可选的缩放锚点（客户端坐标），不传则以视口中心为锚点。
 */
function updateMarkdownImageViewerZoom(
  viewerState: MarkdownImageViewerState,
  nextZoom: number,
  zoomAnchor?: MarkdownImageViewerZoomAnchor
): void {
  // 归一化后的缩放倍数。
  const normalizedZoom = clampMarkdownImageViewerZoom(nextZoom);
  // 缩放前的焦点信息，用于恢复光标/视口中心在新尺寸下的相对位置。
  const focalPoint = isMarkdownImageViewerOpen(viewerState)
    ? captureMarkdownImageViewerFocalPoint(viewerState, zoomAnchor)
    : undefined;

  viewerState.zoomValue = normalizedZoom;
  viewerState.dialogElement.classList.toggle(
    IMAGE_VIEWER_ZOOMED_CLASS_NAME,
    normalizedZoom > IMAGE_VIEWER_DEFAULT_ZOOM
  );
  viewerState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  viewerState.zoomOutButtonElement.disabled = normalizedZoom <= IMAGE_VIEWER_MIN_ZOOM;
  viewerState.zoomInButtonElement.disabled = normalizedZoom >= IMAGE_VIEWER_MAX_ZOOM;
  viewerState.resetButtonElement.disabled = normalizedZoom === IMAGE_VIEWER_DEFAULT_ZOOM;
  updateMarkdownImageViewerImageSize(viewerState);

  if (focalPoint) {
    applyMarkdownImageViewerFocalPoint(viewerState, focalPoint);
  }
}

/**
 * 记录缩放前的焦点：把客户端坐标转成图片内的归一化位置。
 * @param viewerState 图片查看器状态。
 * @param zoomAnchor 客户端坐标锚点，不传则以视口中心。
 * @returns 焦点信息，图片尚未布局完成时返回 undefined。
 */
function captureMarkdownImageViewerFocalPoint(
  viewerState: MarkdownImageViewerState,
  zoomAnchor?: MarkdownImageViewerZoomAnchor
): MarkdownImageViewerFocalPoint | undefined {
  // 当前图片矩形。
  const preImageRect = viewerState.imageElement.getBoundingClientRect();

  if (preImageRect.width <= 0 || preImageRect.height <= 0) {
    return undefined;
  }

  // 当前视口矩形。
  const viewportRect = viewerState.viewportElement.getBoundingClientRect();
  // 锚点客户端坐标：未传时取视口中心。
  const anchorClientX = zoomAnchor?.x ?? viewportRect.left + viewportRect.width / 2;
  const anchorClientY = zoomAnchor?.y ?? viewportRect.top + viewportRect.height / 2;
  // 锚点在图片内部的归一化坐标。
  const normalizedX = (anchorClientX - preImageRect.left) / preImageRect.width;
  const normalizedY = (anchorClientY - preImageRect.top) / preImageRect.height;

  return {
    anchorClientX,
    anchorClientY,
    normalizedX,
    normalizedY
  };
}

/**
 * 缩放后调整滚动量，使焦点保持在原客户端位置。
 * @param viewerState 图片查看器状态。
 * @param focalPoint 缩放前记录的焦点信息。
 */
function applyMarkdownImageViewerFocalPoint(
  viewerState: MarkdownImageViewerState,
  focalPoint: MarkdownImageViewerFocalPoint
): void {
  // 先回到无滚动状态，便于读取布局的自然位置。
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;

  // 缩放后图片在客户端坐标系的位置和尺寸。
  const postImageRect = viewerState.imageElement.getBoundingClientRect();

  if (postImageRect.width <= 0 || postImageRect.height <= 0) {
    return;
  }

  // 期望的图片左上角客户端坐标：让归一化锚点落在原客户端位置。
  const targetImageClientLeft =
    focalPoint.anchorClientX - focalPoint.normalizedX * postImageRect.width;
  const targetImageClientTop =
    focalPoint.anchorClientY - focalPoint.normalizedY * postImageRect.height;

  // 利用滚动量补齐自然位置与期望位置的差值，浏览器会自动裁剪到合法范围。
  viewerState.viewportElement.scrollLeft = postImageRect.left - targetImageClientLeft;
  viewerState.viewportElement.scrollTop = postImageRect.top - targetImageClientTop;
}

/**
 * 根据视口和缩放比例更新查看器图片尺寸。
 * @param viewerState 图片查看器状态。
 */
function updateMarkdownImageViewerImageSize(viewerState: MarkdownImageViewerState): void {
  // 视口可用宽度。
  const viewportWidth = Math.max(
    viewerState.viewportElement.clientWidth * IMAGE_VIEWER_FIT_RATIO,
    1
  );
  // 视口可用高度。
  const viewportHeight = Math.max(
    viewerState.viewportElement.clientHeight * IMAGE_VIEWER_FIT_RATIO,
    1
  );
  // 图片原始宽度。
  const naturalWidth = Math.max(viewerState.naturalWidth, 1);
  // 图片原始高度。
  const naturalHeight = Math.max(viewerState.naturalHeight, 1);
  // 默认全图适配比例。
  const fitScale = Math.min(1, viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  // 缩放后的展示宽度。
  const displayWidth = Math.max(1, Math.round(naturalWidth * fitScale * viewerState.zoomValue));
  // 缩放后的展示高度。
  const displayHeight = Math.max(1, Math.round(naturalHeight * fitScale * viewerState.zoomValue));

  viewerState.imageElement.style.width = `${displayWidth}px`;
  viewerState.imageElement.style.height = `${displayHeight}px`;
}

/**
 * 限制图片查看器缩放倍数。
 * @param zoomValue 待限制的缩放倍数。
 * @returns 限制后的缩放倍数。
 */
function clampMarkdownImageViewerZoom(zoomValue: number): number {
  return Math.min(IMAGE_VIEWER_MAX_ZOOM, Math.max(IMAGE_VIEWER_MIN_ZOOM, zoomValue));
}

/**
 * 关闭图片查看器。
 * @param viewerState 图片查看器状态。
 */
function closeMarkdownImageViewer(viewerState: MarkdownImageViewerState): void {
  if (typeof viewerState.dialogElement.close === "function" && viewerState.dialogElement.open) {
    viewerState.dialogElement.close();
    return;
  }

  viewerState.dialogElement.removeAttribute("open");
  resetMarkdownImageViewerAfterClose(viewerState);
}

/**
 * 复位图片查看器关闭后的临时状态。
 * @param viewerState 图片查看器状态。
 */
function resetMarkdownImageViewerAfterClose(viewerState: MarkdownImageViewerState): void {
  viewerState.dialogElement.classList.remove(IMAGE_VIEWER_ZOOMED_CLASS_NAME);
  viewerState.dialogElement.classList.remove(IMAGE_VIEWER_DRAGGING_CLASS_NAME);
  viewerState.isDragging = false;
  viewerState.imageElement.removeAttribute("src");
  viewerState.imageElement.removeAttribute("alt");
  viewerState.imageElement.removeAttribute("style");
  viewerState.captionElement.textContent = "";
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  viewerState.zoomValue = IMAGE_VIEWER_DEFAULT_ZOOM;

  if (viewerState.sourceImageElement?.isConnected) {
    viewerState.sourceImageElement.focus();
  }
}

/**
 * 判断图片查看器是否处于打开状态。
 * @param viewerState 图片查看器状态。
 * @returns 查看器是否打开。
 */
function isMarkdownImageViewerOpen(viewerState: MarkdownImageViewerState): boolean {
  return viewerState.dialogElement.open || viewerState.dialogElement.hasAttribute("open");
}

/**
 * 读取图片可展示来源。
 * @param imageElement 图片元素。
 * @returns 图片来源 URL。
 */
function getMarkdownImageSource(imageElement: HTMLImageElement): string {
  return imageElement.currentSrc || imageElement.getAttribute("src") || imageElement.src || "";
}

/**
 * 创建图片查看器可访问名称。
 * @param imageElement 图片元素。
 * @returns 图片查看器可访问名称。
 */
function createMarkdownImageViewerAriaLabel(imageElement: HTMLImageElement): string {
  // 图片 alt 文本。
  const imageAltText = imageElement.alt.trim();

  if (imageAltText.length === 0) {
    return IMAGE_VIEWER_FALLBACK_LABEL;
  }

  return `${IMAGE_VIEWER_FALLBACK_LABEL}：${imageAltText}`;
}

/**
 * 创建图片查看器说明文本。
 * @param imageElement 图片元素。
 * @param imageSource 图片来源 URL。
 * @returns 图片查看器说明文本。
 */
function createMarkdownImageViewerCaption(
  imageElement: HTMLImageElement,
  imageSource: string
): string {
  // 图片 alt 文本。
  const imageAltText = imageElement.alt.trim();
  // 图片 title 文本。
  const imageTitleText = imageElement.title.trim();

  return imageAltText || imageTitleText || imageSource;
}

/**
 * 为 Scribdown 扩展默认 HTML 清洗规则。
 * @returns 支持目录节点 class / nav 的清洗规则。
 */
function createScribdownSanitizeSchema(): typeof defaultSchema {
  // 默认标签白名单。
  const defaultTagNames = defaultSchema.tagNames ?? [];
  // 默认属性白名单。
  const defaultAttributes = defaultSchema.attributes ?? {};
  // details 元素的属性白名单。
  const detailsAttributes = [
    "open",
    ["className", /^scribdown-toc(?:-branch)?$/u] as [string, RegExp]
  ];
  // summary 元素的属性白名单。
  const summaryAttributes = [
    ...(defaultAttributes.summary ?? []),
    ["className", /^scribdown-toc(?:-branch)?-summary$/u] as [string, RegExp]
  ];
  // nav 元素的属性白名单。
  const navAttributes = ["ariaLabel", ["className", /^scribdown-toc-nav$/u] as [string, RegExp]];
  // a 元素的属性白名单。
  const linkAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    "dataFootnoteBackref",
    "dataFootnoteRef",
    ["className", "data-footnote-backref", TOC_BRANCH_LINK_CLASS_NAME] as [string, string, string],
    "href"
  ];
  // ol 元素的属性白名单。
  const orderedListAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    ["className", "contains-task-list", /^scribdown-toc-list(?:--nested)?$/u] as [
      string,
      string,
      RegExp
    ]
  ];
  // span 元素的属性白名单：放行标题行内包裹层与图片 frame / fallback 的 class。
  const spanAttributes = [
    ...(defaultAttributes.span ?? []),
    [
      "className",
      HEADING_MARK_CLASS_NAME,
      IMAGE_FRAME_CLASS_NAME,
      IMAGE_FALLBACK_CLASS_NAME,
      IMAGE_FALLBACK_ICON_CLASS_NAME,
      IMAGE_FALLBACK_TEXT_CLASS_NAME,
      IMAGE_FALLBACK_SOURCE_CLASS_NAME
    ] as [string, ...string[]]
  ];
  // figure 元素的属性白名单。
  const figureAttributes = [["className", IMAGE_FIGURE_CLASS_NAME] as [string, string]];
  // figcaption 元素的属性白名单。
  const figcaptionAttributes = [["className", IMAGE_CAPTION_CLASS_NAME] as [string, string]];
  // img 元素的属性白名单。
  const imageAttributes = [
    ...(defaultAttributes.img ?? []),
    ["className", IMAGE_ELEMENT_CLASS_NAME] as [string, string]
  ];
  // abbr 元素的属性白名单：保留 title 以展示完整释义。
  const abbrAttributes = ["title"];
  // li 元素的属性白名单。
  const listItemAttributes = [
    "dataTocIndex",
    ["className", "task-list-item", /^scribdown-toc-item(?:--(?:branch|depth-[1-6]))?$/u] as [
      string,
      string,
      RegExp
    ]
  ];

  return {
    ...defaultSchema,
    clobberPrefix: "",
    tagNames: Array.from(
      new Set([
        ...defaultTagNames,
        "details",
        "nav",
        "summary",
        "u",
        "mark",
        "sub",
        "sup",
        "kbd",
        "abbr",
        "small",
        "dl",
        "dt",
        "dd",
        "figure",
        "figcaption"
      ])
    ),
    attributes: {
      ...defaultAttributes,
      details: detailsAttributes,
      summary: summaryAttributes,
      nav: navAttributes,
      a: linkAttributes,
      ol: orderedListAttributes,
      li: listItemAttributes,
      span: spanAttributes,
      abbr: abbrAttributes,
      figure: figureAttributes,
      figcaption: figcaptionAttributes,
      img: imageAttributes
    }
  };
}

/**
 * remark 插件：把行内 text 节点中的 ==text== 转换为 <mark> 节点。
 * GFM 本身不支持该语法，因此独立实现以覆盖 fixture 中的高亮用法。
 * @returns Markdown AST 转换器。
 */
function remarkHighlightMark(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    transformHighlightMarks(tree);
  };
}

/**
 * 深度优先遍历，把 text 节点中匹配 ==..== 的片段替换为 mark 节点。
 * @param node 当前节点。
 */
function transformHighlightMarks(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  // 处理后写回的新子节点列表。
  const nextChildren: MarkdownNode[] = [];
  // 子节点索引。
  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    // 当前子节点。
    const childNode = node.children[childIndex];

    if (
      childNode.type === "text" &&
      typeof childNode.value === "string" &&
      childNode.value.includes("==")
    ) {
      nextChildren.push(...splitHighlightMarks(childNode.value));
      continue;
    }

    transformHighlightMarks(childNode);
    nextChildren.push(childNode);
  }

  node.children = nextChildren;
}

/**
 * 拆分 text 字符串，把 ==content== 段落转换成 mark 节点。
 * @param textValue 原始 text 节点的内容。
 * @returns 拆分后的行内节点列表。
 */
function splitHighlightMarks(textValue: string): MarkdownNode[] {
  // 拆分结果。
  const segments: MarkdownNode[] = [];
  // 当前游标位置。
  let cursor = 0;

  HIGHLIGHT_MARKER_PATTERN.lastIndex = 0;
  // 上一个匹配结果。
  let match: RegExpExecArray | null = HIGHLIGHT_MARKER_PATTERN.exec(textValue);

  while (match !== null) {
    // 当前匹配开始位置之前的普通文本。
    const leadingText = textValue.slice(cursor, match.index);

    if (leadingText.length > 0) {
      segments.push({ type: "text", value: leadingText });
    }

    segments.push({
      type: "highlightMark",
      data: {
        hName: "mark"
      },
      children: [{ type: "text", value: match[1] }]
    });

    cursor = match.index + match[0].length;
    match = HIGHLIGHT_MARKER_PATTERN.exec(textValue);
  }

  // 尾部剩余文本。
  const trailingText = textValue.slice(cursor);
  if (trailingText.length > 0) {
    segments.push({ type: "text", value: trailingText });
  }

  return segments;
}

/**
 * remark 插件：把 term + 下一行冒号定义的段落转换为定义列表。
 * @returns Markdown AST 转换器。
 */
function remarkDefinitionLists(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    transformDefinitionLists(tree);
  };
}

/**
 * 深度优先遍历，把定义列表段落替换为 dl/dt/dd 结构。
 * @param node 当前节点。
 */
function transformDefinitionLists(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];
    // 当前段落转换后的定义列表节点。
    const definitionListNode = createDefinitionListNode(childNode);

    if (definitionListNode) {
      childNodes[childIndex] = definitionListNode;
      continue;
    }

    transformDefinitionLists(childNode);
  }
}

/**
 * 尝试把段落转换为定义列表节点。
 * @param node 待转换的 Markdown 节点。
 * @returns 转换后的定义列表节点，不匹配时返回 undefined。
 */
function createDefinitionListNode(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type !== "paragraph") {
    return undefined;
  }

  // 段落纯文本内容，用于识别定义列表语法。
  const paragraphText = extractNodeText(node);
  // 定义列表匹配结果。
  const definitionMatch = DEFINITION_LIST_PARAGRAPH_PATTERN.exec(paragraphText);

  if (!definitionMatch) {
    return undefined;
  }

  // 定义项名称。
  const definitionTerm = definitionMatch[1].trim();
  // 定义项说明。
  const definitionDescription = definitionMatch[2].trim();

  if (definitionTerm.length === 0 || definitionDescription.length === 0) {
    return undefined;
  }

  return {
    type: "definitionList",
    data: {
      hName: "dl"
    },
    children: [
      {
        type: "definitionTerm",
        data: {
          hName: "dt"
        },
        children: [{ type: "text", value: definitionTerm }]
      },
      {
        type: "definitionDescription",
        data: {
          hName: "dd"
        },
        children: [{ type: "text", value: definitionDescription }]
      }
    ]
  };
}

/**
 * remark 插件：把独占段落的图片转换为 figure 结构。
 * @returns Markdown AST 转换器。
 */
function remarkImageFigures(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    transformImageFigures(tree);
  };
}

/**
 * 深度优先遍历，把块级图片段落转换为可样式化的 figure。
 * @param node 当前节点。
 */
function transformImageFigures(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];
    // 当前图片段落转换出的 figure 节点。
    const imageFigureNode = createImageFigureNode(childNode);

    if (imageFigureNode) {
      childNodes[childIndex] = imageFigureNode;
      continue;
    }

    if (isImageNode(childNode)) {
      decorateImageNode(childNode);
      continue;
    }

    transformImageFigures(childNode);
  }
}

/**
 * 尝试把独占图片段落转换为 figure 节点。
 * @param node 待转换的 Markdown 节点。
 * @returns 转换后的 figure 节点，不匹配时返回 undefined。
 */
function createImageFigureNode(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type !== "paragraph" || !node.children || node.children.length !== 1) {
    return undefined;
  }

  // 段落内唯一的行内节点。
  const onlyChild = node.children[0];

  if (!isImageNode(onlyChild)) {
    return undefined;
  }

  decorateImageNode(onlyChild);

  return {
    type: "imageFigure",
    data: {
      hName: "figure",
      hProperties: {
        className: [IMAGE_FIGURE_CLASS_NAME]
      }
    },
    children: [createImageFrameNode(onlyChild), ...createImageCaptionNodes(onlyChild)]
  };
}

/**
 * 给图片节点写入统一 class。
 * @param imageNode 图片节点。
 */
function decorateImageNode(imageNode: MarkdownNode): void {
  imageNode.data = {
    ...imageNode.data,
    hProperties: {
      ...imageNode.data?.hProperties,
      className: [IMAGE_ELEMENT_CLASS_NAME]
    }
  };
}

/**
 * 创建图片边框容器节点。
 * @param imageNode 图片节点。
 * @returns 图片边框容器节点。
 */
function createImageFrameNode(imageNode: MarkdownNode): MarkdownNode {
  return {
    type: "imageFrame",
    data: {
      hName: "span",
      hProperties: {
        className: [IMAGE_FRAME_CLASS_NAME]
      }
    },
    children: [imageNode, createImageFallbackNode(imageNode)]
  };
}

/**
 * 创建图片标题节点列表。
 * @param imageNode 图片节点。
 * @returns 图片标题节点列表。
 */
function createImageCaptionNodes(imageNode: MarkdownNode): MarkdownNode[] {
  // 图片 title 属性文本，用于生成 figcaption。
  const imageTitle = typeof imageNode.title === "string" ? imageNode.title.trim() : "";

  if (imageTitle.length === 0) {
    return [];
  }

  return [
    {
      type: "imageCaption",
      data: {
        hName: "figcaption",
        hProperties: {
          className: [IMAGE_CAPTION_CLASS_NAME]
        }
      },
      children: [{ type: "text", value: imageTitle }]
    }
  ];
}

/**
 * 创建图片失败态占位节点。
 * @param imageNode 图片节点。
 * @returns 图片失败态占位节点。
 */
function createImageFallbackNode(imageNode: MarkdownNode): MarkdownNode {
  // 图片失败态展示的 alt 文本。
  const fallbackText = imageNode.alt?.trim() || "图片加载失败";
  // 图片失败态展示的来源路径。
  const fallbackSource = imageNode.url ?? imageNode.identifier ?? "";

  return {
    type: "imageFallback",
    data: {
      hName: "span",
      hProperties: {
        className: [IMAGE_FALLBACK_CLASS_NAME]
      }
    },
    children: [
      {
        type: "imageFallbackIcon",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_ICON_CLASS_NAME]
          }
        }
      },
      {
        type: "imageFallbackText",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_TEXT_CLASS_NAME]
          }
        },
        children: [{ type: "text", value: fallbackText }]
      },
      {
        type: "imageFallbackSource",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_SOURCE_CLASS_NAME]
          }
        },
        children: [{ type: "text", value: fallbackSource }]
      }
    ]
  };
}

/**
 * 判断节点是否为图片或引用式图片。
 * @param node 待判断的 Markdown 节点。
 * @returns 当前节点是否为图片节点。
 */
function isImageNode(node: MarkdownNode): boolean {
  return node.type === "image" || node.type === "imageReference";
}

/**
 * remark 插件：收集标题、生成标题锚点，并把独占一段的 [TOC] 替换为目录。
 * @returns Markdown AST 转换器。
 */
function remarkTableOfContents(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    // 标题条目，同时会在收集时写入 heading id。
    const tocHeadings = collectTocHeadings(tree);

    // 关键步骤：用目录节点替换所有独占一段的 [TOC]。
    replaceTocMarkers(tree, tocHeadings);
  };
}

/**
 * 收集文档标题并给标题节点写入稳定 id。
 * @param tree Markdown 根节点。
 * @returns 可用于渲染目录的标题列表。
 */
function collectTocHeadings(tree: MarkdownNode): TocHeading[] {
  // 标题 slug 使用次数，用于处理重复标题。
  const headingSlugCounts = new Map<string, number>();
  // 收集到的目录标题条目。
  const tocHeadings: TocHeading[] = [];
  // 各标题层级的计数器，用于生成 1 / 1.1 / 1.1.1 这类目录序号。
  const headingIndexCounts = Array.from({ length: 7 }, () => 0);
  // 文档内最浅标题层级，用作目录序号的根层级。
  let rootHeadingDepth: number | undefined;

  visitMarkdownNode(tree, (node: MarkdownNode) => {
    if (node.type !== "heading") {
      return;
    }

    // 标题层级默认回退到二级标题。
    const headingDepth = node.depth ?? 2;
    // 从标题行内节点提取纯文本。
    const headingText = extractNodeText(node).trim();
    // 为标题生成去重后的锚点。
    const headingId = createUniqueSlug(headingText, headingSlugCounts, tocHeadings.length + 1);
    // 根据标题层级生成目录编号。
    const headingIndex = createHeadingIndex(
      headingDepth,
      headingIndexCounts,
      rootHeadingDepth ?? headingDepth
    );

    rootHeadingDepth = rootHeadingDepth ?? headingDepth;

    node.data = {
      ...node.data,
      hProperties: {
        ...node.data?.hProperties,
        id: headingId
      }
    };

    // 关键步骤：把标题行内内容包进一个 inline 元素，
    // 让样式可以借助 box-decoration-break 在多行间复制高亮背景。
    node.children = [
      {
        type: "headingMark",
        data: {
          hName: "span",
          hProperties: {
            className: [HEADING_MARK_CLASS_NAME]
          }
        },
        children: node.children ?? []
      }
    ];

    tocHeadings.push({
      depth: headingDepth,
      id: headingId,
      index: headingIndex,
      text: headingText || headingId
    });
  });

  return tocHeadings;
}

/**
 * 深度优先遍历 Markdown AST。
 * @param node 当前节点。
 * @param visitor 节点访问函数。
 */
function visitMarkdownNode(node: MarkdownNode, visitor: (node: MarkdownNode) => void): void {
  visitor(node);

  if (!node.children) {
    return;
  }

  // 子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    visitMarkdownNode(childNodes[childIndex], visitor);
  }
}

/**
 * 将 [TOC] 段落替换为目录节点。
 * @param node 当前节点。
 * @param tocHeadings 目录标题条目。
 */
function replaceTocMarkers(node: MarkdownNode, tocHeadings: TocHeading[]): void {
  if (!node.children) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];

    if (isTocMarkerParagraph(childNode)) {
      childNodes[childIndex] = createTocNode(tocHeadings);
      continue;
    }

    replaceTocMarkers(childNode, tocHeadings);
  }
}

/**
 * 判断段落是否是独占的 [TOC] 标记。
 * @param node 待判断节点。
 * @returns 当前节点是否为目录占位段落。
 */
function isTocMarkerParagraph(node: MarkdownNode): boolean {
  if (node.type !== "paragraph" || !node.children || node.children.length !== 1) {
    return false;
  }

  // 段落内唯一的行内节点。
  const onlyChild = node.children[0];

  return onlyChild.type === "text" && TOC_MARKER_PATTERN.test(onlyChild.value ?? "");
}

/**
 * 创建目录容器节点。
 * @param tocHeadings 目录标题条目。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocNode(tocHeadings: TocHeading[]): MarkdownNode {
  // 层级化后的目录条目，用于生成可折叠分支。
  const tocTree = createTocTree(tocHeadings);

  return {
    type: "toc",
    data: {
      hName: "details",
      hProperties: {
        className: [TOC_CLASS_NAME]
      }
    },
    children: [
      {
        type: "tocSummary",
        data: {
          hName: "summary",
          hProperties: {
            className: [TOC_SUMMARY_CLASS_NAME]
          }
        },
        children: [
          {
            type: "text",
            value: TOC_SUMMARY_TEXT
          }
        ]
      },
      {
        type: "tocNav",
        data: {
          hName: "nav",
          hProperties: {
            ariaLabel: TOC_ARIA_LABEL,
            className: [TOC_NAV_CLASS_NAME]
          }
        },
        children: [createTocListNode(tocTree, false)]
      }
    ]
  };
}

/**
 * 将扁平标题列表转换为目录树。
 * @param tocHeadings 扁平目录标题条目。
 * @returns 可生成嵌套目录的树形条目。
 */
function createTocTree(tocHeadings: TocHeading[]): TocTreeItem[] {
  // 目录根节点集合。
  const rootItems: TocTreeItem[] = [];
  // 当前遍历路径上的分支栈。
  const itemStack: TocTreeItem[] = [];

  // 目录标题索引。
  for (let headingIndex = 0; headingIndex < tocHeadings.length; headingIndex += 1) {
    // 当前遍历到的标题条目。
    const tocHeading = tocHeadings[headingIndex];
    // 当前标题转换后的树节点。
    const tocTreeItem: TocTreeItem = {
      ...tocHeading,
      children: []
    };

    // 关键步骤：回退到比当前标题更浅的父级。
    while (itemStack.length > 0 && itemStack[itemStack.length - 1].depth >= tocTreeItem.depth) {
      itemStack.pop();
    }

    if (itemStack.length === 0) {
      rootItems.push(tocTreeItem);
    } else {
      itemStack[itemStack.length - 1].children.push(tocTreeItem);
    }

    itemStack.push(tocTreeItem);
  }

  return rootItems;
}

/**
 * 创建目录列表节点。
 * @param tocItems 当前层级的目录条目。
 * @param isNested 是否为嵌套列表。
 * @returns Markdown 列表节点。
 */
function createTocListNode(tocItems: TocTreeItem[], isNested: boolean): MarkdownNode {
  // 当前目录列表需要输出的类名。
  const tocListClassNames = isNested
    ? [TOC_LIST_CLASS_NAME, TOC_LIST_NESTED_CLASS_NAME]
    : [TOC_LIST_CLASS_NAME];

  return {
    type: "list",
    ordered: true,
    spread: false,
    data: {
      hProperties: {
        className: tocListClassNames
      }
    },
    children: tocItems.map(createTocListItem)
  };
}

/**
 * 创建目录列表项。
 * @param tocItem 目录树条目。
 * @returns Markdown 列表项节点。
 */
function createTocListItem(tocItem: TocTreeItem): MarkdownNode {
  // 当前条目是否拥有可折叠的子层级。
  const hasChildren = tocItem.children.length > 0;
  // 当前目录条目的 class 列表。
  const tocItemClassNames = [
    TOC_ITEM_CLASS_PREFIX,
    `${TOC_ITEM_CLASS_PREFIX}--depth-${tocItem.depth}`,
    ...(hasChildren ? [TOC_ITEM_BRANCH_CLASS_NAME] : [])
  ];

  return {
    type: "listItem",
    spread: false,
    data: {
      hProperties: {
        dataTocIndex: tocItem.index,
        className: tocItemClassNames
      }
    },
    children: hasChildren ? [createTocBranchNode(tocItem)] : [createTocLinkParagraphNode(tocItem)]
  };
}

/**
 * 创建可折叠的目录分支节点。
 * @param tocItem 拥有子层级的目录条目。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocBranchNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "tocBranch",
    data: {
      hName: "details",
      hProperties: {
        open: true,
        className: [TOC_BRANCH_CLASS_NAME]
      }
    },
    children: [
      {
        type: "tocBranchSummary",
        data: {
          hName: "summary",
          hProperties: {
            className: [TOC_BRANCH_SUMMARY_CLASS_NAME]
          }
        },
        children: [
          {
            type: "text",
            value: tocItem.text
          },
          createTocBranchLinkNode(tocItem)
        ]
      },
      createTocListNode(tocItem.children, true)
    ]
  };
}

/**
 * 创建目录叶子条目的链接段落。
 * @param tocItem 目录树条目。
 * @returns 包含锚点链接的段落节点。
 */
function createTocLinkParagraphNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "paragraph",
    children: [createTocLinkNode(tocItem)]
  };
}

/**
 * 创建目录标题链接。
 * @param tocItem 目录树条目。
 * @returns Markdown 链接节点。
 */
function createTocLinkNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "link",
    url: `#${tocItem.id}`,
    children: [
      {
        type: "text",
        value: tocItem.text
      }
    ]
  };
}

/**
 * 创建目录分支标题旁的跳转链接。
 * @param tocItem 目录树条目。
 * @returns Markdown 链接节点。
 */
function createTocBranchLinkNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "link",
    url: `#${tocItem.id}`,
    data: {
      hProperties: {
        ariaLabel: `${TOC_BRANCH_LINK_ARIA_LABEL_PREFIX}${tocItem.text}`,
        className: [TOC_BRANCH_LINK_CLASS_NAME]
      }
    },
    children: [
      {
        type: "text",
        value: TOC_BRANCH_LINK_TEXT
      }
    ]
  };
}

/**
 * 从节点及其子节点中提取可读文本。
 * @param node 当前节点。
 * @returns 当前节点的纯文本内容。
 */
function extractNodeText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value ?? "";
  }

  if (isImageNode(node)) {
    return node.alt ?? "";
  }

  if (!node.children) {
    return "";
  }

  return node.children.map(extractNodeText).join("");
}

/**
 * 生成去重后的标题 slug。
 * @param headingText 标题文本。
 * @param slugCounts 已使用 slug 计数。
 * @param fallbackIndex 空标题回退序号。
 * @returns 唯一标题锚点。
 */
function createUniqueSlug(
  headingText: string,
  slugCounts: Map<string, number>,
  fallbackIndex: number
): string {
  // 标准化后的基础 slug。
  const normalizedSlug = normalizeSlugText(headingText);
  // 空标题的回退 slug。
  const fallbackSlug = `${EMPTY_HEADING_SLUG_PREFIX}-${fallbackIndex}`;
  // 本次使用的基础 slug。
  const baseSlug = normalizedSlug || fallbackSlug;
  // 当前 slug 已出现次数。
  const usedCount = slugCounts.get(baseSlug) ?? 0;

  slugCounts.set(baseSlug, usedCount + 1);

  if (usedCount === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${usedCount}`;
}

/**
 * 根据标题层级生成目录编号。
 * @param headingDepth 当前标题层级。
 * @param headingIndexCounts 各标题层级已出现次数。
 * @param rootHeadingDepth 目录根标题层级。
 * @returns 层级化目录编号。
 */
function createHeadingIndex(
  headingDepth: number,
  headingIndexCounts: number[],
  rootHeadingDepth: number
): string {
  // 起始层级不能超过当前标题层级。
  const startDepth = Math.min(rootHeadingDepth, headingDepth);

  headingIndexCounts[headingDepth] += 1;

  // 关键步骤：当前层级之后的子层级计数失效。
  for (let depthIndex = headingDepth + 1; depthIndex < headingIndexCounts.length; depthIndex += 1) {
    headingIndexCounts[depthIndex] = 0;
  }

  // 补齐被跳过的父级，避免出现 1.0.1 这种编号。
  for (let depthIndex = startDepth; depthIndex < headingDepth; depthIndex += 1) {
    if (headingIndexCounts[depthIndex] === 0) {
      headingIndexCounts[depthIndex] = 1;
    }
  }

  return headingIndexCounts.slice(startDepth, headingDepth + 1).join(".");
}

/**
 * 将标题文本标准化为 URL 片段。
 * @param headingText 标题文本。
 * @returns 标准化后的 slug。
 */
function normalizeSlugText(headingText: string): string {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
