import {
  CONTENT_WIDTH_STORAGE_KEY,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE,
  TOOLBAR_COLLAPSED_STORAGE_KEY
} from "@scribdown/shared";
import DOMPurify from "dompurify";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import githubLightTheme from "@shikijs/themes/github-light";
import { type HighlighterCore, createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { unified } from "unified";
import {
  CODE_HIGHLIGHTER_EAGER_LOADERS,
  CODE_HIGHLIGHTER_LAZY_LANGS
} from "./code-highlighter-langs";

/**
 * 源码行号在 hast 节点上的属性名（camelCase）。
 * rehype-raw 会把 DOM 属性 data-source-line 回解析为该 camelCase 形式，
 * sanitize 白名单与 hProperties 注入均需以此形式匹配，序列化后仍输出 data-source-line。
 */
const SOURCE_LINE_HAST_PROPERTY = SOURCE_LINE_DATA_ATTRIBUTE.replace(
  /-([a-z])/gu,
  (_match: string, letter: string) => letter.toUpperCase()
);

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
  position?: MarkdownNodePosition;
}

/**
 * Markdown AST 节点上的 HTML 转换元数据。
 */
interface MarkdownNodeData {
  hName?: string;
  hProperties?: Record<string, unknown>;
}

/**
 * Markdown AST 节点的源码位置信息。
 */
interface MarkdownNodePosition {
  /** 节点在源码中的起始位置。 */
  start: {
    /** 起始行号（1-based）。 */
    line: number;
  };
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

// 视频 figure 容器类名。
const VIDEO_FIGURE_CLASS_NAME = "scribdown-video-figure";

// 视频边框容器类名。
const VIDEO_FRAME_CLASS_NAME = "scribdown-video-frame";

// 视频元素类名。
const VIDEO_ELEMENT_CLASS_NAME = "scribdown-video";

// 视频加载失败状态类名。
const VIDEO_FRAME_FAILED_CLASS_NAME = "scribdown-video-frame--failed";

// 视频加载完成状态类名。
const VIDEO_FRAME_LOADED_CLASS_NAME = "scribdown-video-frame--loaded";

// 视频失败态占位内容类名。
const VIDEO_FALLBACK_CLASS_NAME = "scribdown-video-fallback";

// 视频失败态图标类名。
const VIDEO_FALLBACK_ICON_CLASS_NAME = "scribdown-video-fallback-icon";

// 视频失败态标题类名。
const VIDEO_FALLBACK_TEXT_CLASS_NAME = "scribdown-video-fallback-text";

// 视频失败态来源类名。
const VIDEO_FALLBACK_SOURCE_CLASS_NAME = "scribdown-video-fallback-source";

// 视频运行时已绑定标记的 dataset 键。
const VIDEO_HYDRATED_DATA_KEY = "scribdownVideoHydrated";

// 视频失败态展示文本。
const VIDEO_FALLBACK_DEFAULT_TEXT = "视频加载失败";

// Mermaid 代码块的语言标识，对应 fixture 中的 ```mermaid。
const MERMAID_LANGUAGE_ID = "mermaid";

// Mermaid 图表外层 figure 容器类名。
const MERMAID_FIGURE_CLASS_NAME = "scribdown-mermaid";

// Mermaid 图表顶部 chrome 容器类名。
const MERMAID_CHROME_CLASS_NAME = "scribdown-mermaid__chrome";

// Mermaid 图表语言标签类名。
const MERMAID_LABEL_CLASS_NAME = "scribdown-mermaid__label";

// Mermaid 图表正文容器类名。
const MERMAID_BODY_CLASS_NAME = "scribdown-mermaid__body";

// Mermaid 图表 SVG 画布容器类名。
const MERMAID_CANVAS_CLASS_NAME = "scribdown-mermaid__canvas";

// Mermaid 图表失败态容器类名。
const MERMAID_FALLBACK_CLASS_NAME = "scribdown-mermaid__fallback";

// Mermaid 失败态图标类名。
const MERMAID_FALLBACK_ICON_CLASS_NAME = "scribdown-mermaid__fallback-icon";

// Mermaid 失败态文案类名。
const MERMAID_FALLBACK_TEXT_CLASS_NAME = "scribdown-mermaid__fallback-text";

// Mermaid 失败态源码块类名。
const MERMAID_FALLBACK_SOURCE_CLASS_NAME = "scribdown-mermaid__fallback-source";

// Mermaid 加载/失败/完成态修饰类名。
const MERMAID_FIGURE_LOADING_CLASS_NAME = "scribdown-mermaid--loading";
const MERMAID_FIGURE_FAILED_CLASS_NAME = "scribdown-mermaid--failed";
const MERMAID_FIGURE_LOADED_CLASS_NAME = "scribdown-mermaid--loaded";

// Mermaid 已 hydrate 标记的 dataset 键（仅表示结构已构建）。
const MERMAID_HYDRATED_DATA_KEY = "scribdownMermaidHydrated";

// Mermaid 渲染已启动标记，避免在 live DOM 重复触发 mermaid.render。
const MERMAID_RENDER_STARTED_DATA_KEY = "scribdownMermaidRenderStarted";

// Mermaid 源码寄存在 figure 上的 dataset 键，供延后的 live-DOM 渲染读取。
const MERMAID_SOURCE_DATA_KEY = "scribdownMermaidSourceText";

// Mermaid 顶部展示标签。
const MERMAID_LABEL_TEXT = "Mermaid";

// Mermaid 失败态默认文案。
const MERMAID_FALLBACK_DEFAULT_TEXT = "图表渲染失败";

// Mermaid SVG 节点宿主元素 id 前缀，确保多图表 id 唯一。
const MERMAID_RENDER_ID_PREFIX = "scribdown-mermaid-";

// Mermaid 渲染顺序计数器，配合前缀生成全局唯一 id。
let mermaidRenderIdCounter = 0;

// Mermaid 全屏按钮类名（位于 figure 右下角）。
const MERMAID_FULLSCREEN_BUTTON_CLASS_NAME = "scribdown-mermaid__fullscreen";

// Mermaid 全屏按钮可访问名称。
const MERMAID_FULLSCREEN_BUTTON_ARIA_LABEL = "全屏查看图表";

// Mermaid 全屏查看器 dialog 类名。
const MERMAID_VIEWER_DIALOG_CLASS_NAME = "scribdown-mermaid-viewer";

// Mermaid 全屏查看器缩放进行中状态类名。
const MERMAID_VIEWER_ZOOMED_CLASS_NAME = "scribdown-mermaid-viewer--zoomed";

// Mermaid 全屏查看器拖拽中状态类名。
const MERMAID_VIEWER_DRAGGING_CLASS_NAME = "scribdown-mermaid-viewer--dragging";

// Mermaid 全屏查看器顶部 chrome 类名。
const MERMAID_VIEWER_CHROME_CLASS_NAME = "scribdown-mermaid-viewer__chrome";

// Mermaid 全屏查看器 caption 类名。
const MERMAID_VIEWER_CAPTION_CLASS_NAME = "scribdown-mermaid-viewer__caption";

// Mermaid 全屏查看器控件容器类名。
const MERMAID_VIEWER_CONTROLS_CLASS_NAME = "scribdown-mermaid-viewer__controls";

// Mermaid 全屏查看器按钮类名。
const MERMAID_VIEWER_BUTTON_CLASS_NAME = "scribdown-mermaid-viewer__button";

// Mermaid 全屏查看器关闭按钮修饰类名。
const MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME = "scribdown-mermaid-viewer__button--close";

// Mermaid 全屏查看器视口类名。
const MERMAID_VIEWER_VIEWPORT_CLASS_NAME = "scribdown-mermaid-viewer__viewport";

// Mermaid 全屏查看器画布类名。
const MERMAID_VIEWER_CANVAS_CLASS_NAME = "scribdown-mermaid-viewer__canvas";

// Mermaid 全屏查看器缩放百分比文本类名。
const MERMAID_VIEWER_ZOOM_VALUE_CLASS_NAME = "scribdown-mermaid-viewer__zoom-value";

// 是否允许 mermaid 在 figure 右下角悬浮显示全屏按钮（仅 loaded 态显示）。
const MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY = "scribdownMermaidFullscreenReady";

// Mermaid 全屏查看器存放原始 SVG 字符串的 dataset 键。
const MERMAID_VIEWER_SOURCE_DATA_KEY = "scribdownMermaidSource";

// 用于按 document 缓存 mermaid 全屏查看器单例的映射。
const mermaidViewerStateByDocument = new WeakMap<Document, MarkdownMermaidViewerState>();

// 用于按 dialog 元素反查查看器状态，便于事件回调读取。
const mermaidViewerStateByDialogElement = new WeakMap<
  HTMLDialogElement,
  MarkdownMermaidViewerState
>();

/**
 * Mermaid 全屏查看器运行时状态。
 */
interface MarkdownMermaidViewerState {
  /** 全屏 dialog 容器。 */
  dialogElement: HTMLDialogElement;
  /** 顶部 caption 节点。 */
  captionElement: HTMLElement;
  /** 缩放比例显示节点。 */
  zoomValueElement: HTMLElement;
  /** 缩小按钮。 */
  zoomOutButtonElement: HTMLButtonElement;
  /** 放大按钮。 */
  zoomInButtonElement: HTMLButtonElement;
  /** 重置按钮。 */
  resetButtonElement: HTMLButtonElement;
  /** 关闭按钮。 */
  closeButtonElement: HTMLButtonElement;
  /** 滚动视口容器。 */
  viewportElement: HTMLElement;
  /** SVG 挂载画布。 */
  canvasElement: HTMLElement;
  /** SVG 的固有宽度（来自 viewBox / width 属性）。 */
  naturalWidth: number;
  /** SVG 的固有高度。 */
  naturalHeight: number;
  /** 当前缩放倍数。 */
  zoomValue: number;
  /** 当前是否处于鼠标拖拽平移状态。 */
  isDragging: boolean;
  /** 拖拽起始时鼠标的客户端 X 坐标。 */
  dragStartClientX: number;
  /** 拖拽起始时鼠标的客户端 Y 坐标。 */
  dragStartClientY: number;
  /** 拖拽起始时视口的横向滚动量。 */
  dragStartScrollLeft: number;
  /** 拖拽起始时视口的纵向滚动量。 */
  dragStartScrollTop: number;
}

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

// 滚轮 deltaY 转换为缩放增量的比例系数：触控板单次事件 deltaY 通常较小（个位数），
// 选 0.005 让一次轻微滑动只产生 ~0.5%-5% 的缩放变化，避免触控板上跳变过大。
const IMAGE_VIEWER_WHEEL_ZOOM_FACTOR = 0.010;

// 单次滚轮事件允许的最大缩放变化量，防止鼠标滚轮一格 deltaY=100 时跳得过远。
const IMAGE_VIEWER_WHEEL_ZOOM_MAX_DELTA = 0.1;

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

// 代码块行号固定列类名。
const CODE_BLOCK_GUTTER_CLASS_NAME = "scribdown-code-block__gutter";

// 代码块行号固定列中的单行节点类名。
const CODE_BLOCK_GUTTER_LINE_CLASS_NAME = "scribdown-code-block__gutter-line";

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

// Shiki 高亮主题名（与 githubLightTheme 默认导出对应），用于 codeToHtml 选项。
const CODE_HIGHLIGHTER_THEME = "github-light";

// 单例 Shiki 高亮器的初始化 Promise，确保整个进程只初始化一次。
let codeHighlighterPromise: Promise<HighlighterCore> | undefined;

// 标记懒加载语言的请求去重：同一语言并发命中时复用同一 import Promise。
const codeHighlighterLazyLoadPromises = new Map<string, Promise<void>>();

// 匹配渲染后 `<pre ...><code class="language-X" ...>...</code></pre>` 的正则，用于 Shiki 替换。
// 捕获 pre 与 code（class 之后）的附加属性（如 data-source-line），替换时原样保留，
// 避免 remarkSourceLine 注入的 data-source-line 破坏匹配导致代码块不被高亮。
const CODE_BLOCK_HIGHLIGHT_PATTERN =
  /<pre([^>]*)><code class="language-([\w-]+)"([^>]*)>([\s\S]*?)<\/code><\/pre>/g;

// 提取 Shiki HTML 输出中 `<code>...</code>` 之间内容的正则。
const SHIKI_CODE_INNER_PATTERN = /<code[^>]*>([\s\S]*?)<\/code>/u;

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
    .use(remarkHighlightMark)
    .use(remarkDefinitionLists)
    .use(remarkTableOfContents)
    .use(remarkImageFigures)
    .use(remarkSourceLine)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
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
 * 取得（必要时初始化）Shiki 单例高亮器。
 * 使用 shiki/core + 显式 grammar 列表，避免默认 bundle 把 200+ 语言全部打进 dist。
 * @returns 已就绪的 Shiki 高亮器实例。
 */
async function getCodeHighlighter(): Promise<HighlighterCore> {
  if (!codeHighlighterPromise) {
    codeHighlighterPromise = createHighlighterCore({
      themes: [githubLightTheme],
      // eager loaders 通过动态 import 拆为独立 chunk，初始化时并发拉取；
      // 主 bundle 不再内联 grammar JSON，体积更小，多个 grammar 也可并行加载。
      langs: CODE_HIGHLIGHTER_EAGER_LOADERS,
      // oniguruma 引擎 + wasm；shiki/wasm 内部走 base64 内联，扩展环境无需额外资源声明。
      engine: createOnigurumaEngine(import("shiki/wasm"))
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
    const [matched, preAttributes, rawLanguage, codeAttributes, encodedCode] = match;
    const matchStart = match.index ?? 0;

    resultHtml += html.slice(lastIndex, matchStart);
    resultHtml += await highlightSingleCodeBlock(highlighter, {
      rawLanguage,
      encodedCode,
      matchedHtml: matched,
      preAttributes,
      codeAttributes
    });
    lastIndex = matchStart + matched.length;
  }

  resultHtml += html.slice(lastIndex);
  return resultHtml;
}

/**
 * 单个代码块的 Shiki 高亮入参。
 */
interface CodeBlockHighlightInput {
  /** 代码块标注的语言标识。 */
  rawLanguage: string;
  /** 已 HTML 转义的代码内容。 */
  encodedCode: string;
  /** 原始匹配片段，作为兜底返回值。 */
  matchedHtml: string;
  /** pre 标签上的附加属性文本，替换时原样保留。 */
  preAttributes: string;
  /** code 标签上 class 之后的附加属性文本（如 data-source-line），替换时原样保留。 */
  codeAttributes: string;
}

/**
 * 高亮单个代码块，必要时按需加载语言。
 * @param highlighter Shiki 高亮器实例。
 * @param input 代码块高亮入参。
 * @returns 高亮后的代码块 HTML。
 */
async function highlightSingleCodeBlock(
  highlighter: HighlighterCore,
  input: CodeBlockHighlightInput
): Promise<string> {
  // 代码块标注的语言标识。
  const { rawLanguage, encodedCode, matchedHtml, preAttributes, codeAttributes } = input;
  // 归一化语言标识：去除大小写差异，方便匹配 Shiki 内置名。
  const normalizedLanguage = rawLanguage.toLowerCase();

  // 关键步骤：mermaid 代码块跳过 Shiki 高亮，保留原始源码文本，
  // 后续 hydrate 阶段会读取 textContent 调用 mermaid 渲染。
  if (normalizedLanguage === MERMAID_LANGUAGE_ID) {
    return matchedHtml;
  }
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

    return `<pre${preAttributes}><code class="language-${rawLanguage}"${codeAttributes}>${innerHtml}</code></pre>`;
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
  highlighter: HighlighterCore,
  normalizedLanguage: string
): Promise<string> {
  if (normalizedLanguage.length === 0) {
    return "text";
  }

  // highlighter.getLoadedLanguages() 自带别名解析（grammar 自身声明的 aliases 也会被登记）。
  if (highlighter.getLoadedLanguages().includes(normalizedLanguage)) {
    return normalizedLanguage;
  }

  /** 从懒加载注册表查找对应 grammar import 函数。 */
  const lazyLoader = CODE_HIGHLIGHTER_LAZY_LANGS[normalizedLanguage];
  if (!lazyLoader) {
    return "text";
  }

  // 并发命中同一语言时复用同一 Promise，避免重复 import / loadLanguage。
  let pending = codeHighlighterLazyLoadPromises.get(normalizedLanguage);
  if (!pending) {
    pending = (async () => {
      const grammarModule = await lazyLoader();
      await highlighter.loadLanguage(grammarModule.default);
    })();
    codeHighlighterLazyLoadPromises.set(normalizedLanguage, pending);
  }

  try {
    await pending;
    return normalizedLanguage;
  } catch {
    return "text";
  }
}

// HTML 命名实体与对应字符的映射，覆盖代码块中常见的转义结果。
const HTML_NAMED_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  amp: "&"
};

// 匹配命名 / 十进制 / 十六进制三种字符实体；hex / dec 大小写均兼容。
const HTML_ENTITY_PATTERN = /&(?:(lt|gt|quot|apos|amp)|#x([0-9a-fA-F]+)|#(\d+));/g;

/**
 * 还原 HTML 文本中的字符实体（命名 + 十进制 + 十六进制）。
 *
 * 关键步骤：单次左到右扫描，避免“先解 `&amp;` 再解 `&lt;`”导致的二次解码漏洞，
 * 同时识别 `&#x3C;` 等十六进制实体（hast-util-to-html 在 Node 环境下会输出该形式）。
 *
 * @param encodedText HTML 转义后的文本。
 * @returns 还原后的原始文本。
 */
function decodeHtmlEntities(encodedText: string): string {
  return encodedText.replace(
    HTML_ENTITY_PATTERN,
    (matched, namedEntity?: string, hexCodePoint?: string, decimalCodePoint?: string) => {
      if (namedEntity) {
        return HTML_NAMED_ENTITIES[namedEntity] ?? matched;
      }
      if (hexCodePoint) {
        return safeFromCodePoint(parseInt(hexCodePoint, 16), matched);
      }
      if (decimalCodePoint) {
        return safeFromCodePoint(parseInt(decimalCodePoint, 10), matched);
      }
      return matched;
    }
  );
}

/**
 * 安全地把 Unicode 码点转成字符，越界 / NaN 时回退原始片段，避免抛错。
 * @param codePoint Unicode 码点（10/16 进制解析后的数值）。
 * @param fallback 解析失败时返回的原始 HTML 片段。
 * @returns 对应字符或原始片段。
 */
function safeFromCodePoint(codePoint: number, fallback: string): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

/**
 * 使用 DOMPurify 清洗 HTML。
 * @param unsafeHtml 未清洗的 HTML。
 * @returns 清洗后的 HTML。
 */
function sanitizeHtmlWithDomPurify(unsafeHtml: string): string {
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
function hydrateMarkdownImages(rootElement: ParentNode): void {
  // 当前根节点内的所有图片元素。
  const imageElements = rootElement.querySelectorAll<HTMLImageElement>(
    `img.${IMAGE_ELEMENT_CLASS_NAME}`
  );

  imageElements.forEach(bindMarkdownImageState);
}

/**
 * 给渲染后的视频绑定加载/失败状态类名。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMarkdownVideos(rootElement: ParentNode): void {
  // 当前根节点内的所有视频元素。
  const videoElements = rootElement.querySelectorAll<HTMLVideoElement>(
    `video.${VIDEO_ELEMENT_CLASS_NAME}`
  );

  videoElements.forEach(bindMarkdownVideoState);
}

/**
 * 把渲染后的代码块包装为带语言标签、复制按钮与行号的 chrome 结构。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateCodeBlocks(rootElement: ParentNode): void {
  // 当前根节点内的所有未绑定 chrome 的 pre 元素。
  const preElements = rootElement.querySelectorAll<HTMLPreElement>("pre");

  preElements.forEach(decorateCodeBlock);
}

/**
 * Mermaid 渲染句柄缓存：仅在浏览器环境（含 VS Code webview）下加载，
 * 避免在 Node 单元测试环境触发 mermaid 依赖加载。
 */
let mermaidLoaderPromise: Promise<MermaidApi | undefined> | undefined;

/**
 * Mermaid 11+ 的最小 API 子集，仅声明渲染必需成员，避免引入巨大类型。
 */
interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  parse: (source: string) => Promise<unknown> | unknown;
  render: (
    id: string,
    source: string,
    container?: Element
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
}

/**
 * 把渲染后的 mermaid 代码块转换为图表 figure 容器，并按需触发异步渲染。
 *
 * 拆分为两步：
 * 1. {@link decorateMermaidBlock} 同步把 `<pre><code>` 替换为 figure 结构，把源码寄存在 dataset 上。
 * 2. {@link kickOffPendingMermaidRenders} 仅对真正落入 live DOM 的 figure 触发 mermaid.render，
 *    避免 VS Code 预览路径里 hydrate 跑在 detached 节点上、被随后的 morphdom 丢弃。
 *
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMermaidBlocks(rootElement: ParentNode): void {
  // 当前根节点内所有未 hydrate 的 mermaid 代码块。
  const mermaidCodeElements = rootElement.querySelectorAll<HTMLElement>(
    `pre > code.language-${MERMAID_LANGUAGE_ID}`
  );

  mermaidCodeElements.forEach((codeElement) => {
    // 对应的 pre 容器。
    const preElement = codeElement.parentElement as HTMLPreElement | null;
    if (!preElement) {
      return;
    }

    // 若 pre 已经被代码块 chrome 包裹，跳过避免重复处理。
    if (preElement.dataset[CODE_BLOCK_HYDRATED_DATA_KEY] === "true") {
      return;
    }

    decorateMermaidBlock(preElement, codeElement);
  });

  kickOffPendingMermaidRenders(rootElement);
}

/**
 * 针对 live DOM 中仍处于 loading 态的 mermaid figure 启动 mermaid.render。
 * 未连接到 document 的 figure 直接跳过，等下一次 hydrate（live DOM 阶段）再触发。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function kickOffPendingMermaidRenders(rootElement: ParentNode): void {
  // 仍在 loading 态的 figure 集合。
  const pendingFigures = rootElement.querySelectorAll<HTMLElement>(
    `.${MERMAID_FIGURE_CLASS_NAME}.${MERMAID_FIGURE_LOADING_CLASS_NAME}`
  );

  pendingFigures.forEach((figureElement) => {
    // 仅在已挂载到 document 时启动渲染，避免在 detached 节点上空跑。
    if (!figureElement.isConnected) {
      return;
    }
    if (figureElement.dataset[MERMAID_RENDER_STARTED_DATA_KEY] === "true") {
      return;
    }

    // 画布与 mermaid 源码均从 figure 结构 / dataset 上恢复。
    const canvasElement = figureElement.querySelector<HTMLElement>(
      `.${MERMAID_CANVAS_CLASS_NAME}`
    );
    const mermaidSource = figureElement.dataset[MERMAID_SOURCE_DATA_KEY] ?? "";

    if (!canvasElement || mermaidSource.length === 0) {
      return;
    }

    figureElement.dataset[MERMAID_RENDER_STARTED_DATA_KEY] = "true";
    void renderMermaidIntoCanvas(figureElement, canvasElement, mermaidSource);
  });
}

/**
 * 把 pre + code 替换为 mermaid figure 结构，并异步渲染 SVG。
 * @param preElement 原始代码块 pre 元素。
 * @param codeElement 原始代码块 code 元素。
 */
function decorateMermaidBlock(preElement: HTMLPreElement, codeElement: HTMLElement): void {
  // 已经 hydrate 过的代码块直接跳过。
  if (preElement.dataset[MERMAID_HYDRATED_DATA_KEY] === "true") {
    return;
  }
  preElement.dataset[MERMAID_HYDRATED_DATA_KEY] = "true";

  // 当前 pre 所属 document。
  const ownerDocument = preElement.ownerDocument;
  // 关键步骤：在替换 DOM 前抓取原始 mermaid 源码文本。
  const mermaidSource = (codeElement.textContent ?? "").replace(/\n+$/u, "");

  // 外层 figure 容器，承载顶部标签与图表正文。
  const figureElement = ownerDocument.createElement("figure");
  figureElement.className = `${MERMAID_FIGURE_CLASS_NAME} ${MERMAID_FIGURE_LOADING_CLASS_NAME}`;

  // 顶部 chrome，仅承载 Mermaid 类型标签。
  const chromeElement = ownerDocument.createElement("div");
  chromeElement.className = MERMAID_CHROME_CLASS_NAME;

  const labelElement = ownerDocument.createElement("span");
  labelElement.className = MERMAID_LABEL_CLASS_NAME;
  labelElement.textContent = MERMAID_LABEL_TEXT;
  chromeElement.append(labelElement);

  // 正文容器，承载 SVG 画布与失败态。
  const bodyElement = ownerDocument.createElement("div");
  bodyElement.className = MERMAID_BODY_CLASS_NAME;

  // 用于挂载 SVG 的画布节点。
  const canvasElement = ownerDocument.createElement("div");
  canvasElement.className = MERMAID_CANVAS_CLASS_NAME;
  canvasElement.setAttribute("role", "img");
  canvasElement.setAttribute("aria-label", MERMAID_LABEL_TEXT);

  // 右下角悬浮全屏按钮，渲染成功后再启用。
  const fullscreenButtonElement = ownerDocument.createElement("button");
  fullscreenButtonElement.type = "button";
  fullscreenButtonElement.className = MERMAID_FULLSCREEN_BUTTON_CLASS_NAME;
  fullscreenButtonElement.setAttribute("aria-label", MERMAID_FULLSCREEN_BUTTON_ARIA_LABEL);
  // 渲染过程中先禁用，避免点击空白图表。
  fullscreenButtonElement.disabled = true;
  fullscreenButtonElement.innerHTML = MERMAID_FULLSCREEN_ICON_SVG;
  fullscreenButtonElement.addEventListener("click", handleMermaidFullscreenButtonClick);

  bodyElement.append(canvasElement, fullscreenButtonElement);
  figureElement.append(chromeElement, bodyElement);

  // 关键步骤：把源码行锚点从 code 迁移到 figure，对齐编辑器双向滚动。
  const sourceLine = codeElement.getAttribute(SOURCE_LINE_DATA_ATTRIBUTE);
  if (sourceLine !== null) {
    figureElement.setAttribute(SOURCE_LINE_DATA_ATTRIBUTE, sourceLine);
  }

  // 关键步骤：把源码寄存在 figure 上，留给 live-DOM 阶段读取后真正触发 mermaid 渲染。
  // 不在此处直接 await render：VS Code 预览首先在 detached 节点上 hydrate，
  // 之后才把 figure 合并进 live DOM，提前渲染的结果会被 morphdom 丢弃。
  figureElement.dataset[MERMAID_SOURCE_DATA_KEY] = mermaidSource;

  preElement.replaceWith(figureElement);
}

/**
 * 加载并初始化 mermaid 实例，浏览器环境外返回 undefined。
 * @returns mermaid API 句柄。
 */
async function loadMermaid(): Promise<MermaidApi | undefined> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = (async () => {
      // 动态导入：仅在确实出现 mermaid 块时才下载 mermaid 主包。
      const mermaidModule = (await import("mermaid")) as { default: MermaidApi };
      const mermaidApi = mermaidModule.default;
      // startOnLoad=false 由 hydrate 主动控制渲染时机；securityLevel=strict 阻断脚本注入。
      // useMaxWidth=false：让 mermaid 输出带固有宽高属性的 SVG，避免它内联 width:100%/max-width
      // 强行覆盖 CSS，从而把缩放完全交给画布上的 max-width/max-height:100% 配合 viewBox 等比适配。
      mermaidApi.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
        flowchart: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
        class: { useMaxWidth: false },
        state: { useMaxWidth: false },
        gantt: { useMaxWidth: false },
        er: { useMaxWidth: false },
        journey: { useMaxWidth: false },
        pie: { useMaxWidth: false },
        requirement: { useMaxWidth: false },
        c4: { useMaxWidth: false },
        mindmap: { useMaxWidth: false },
        timeline: { useMaxWidth: false },
        gitGraph: { useMaxWidth: false },
        quadrantChart: { useMaxWidth: false },
        xyChart: { useMaxWidth: false },
        sankey: { useMaxWidth: false },
        block: { useMaxWidth: false }
      });
      return mermaidApi;
    })().catch((loadError: unknown) => {
      // 加载失败后重置 promise，给下次渲染重试机会。
      mermaidLoaderPromise = undefined;
      throw loadError;
    });
  }

  return mermaidLoaderPromise;
}

/**
 * 异步把 mermaid 源码渲染为 SVG 注入指定画布，失败时切换到 fallback 态。
 * @param figureElement mermaid 外层 figure 容器。
 * @param canvasElement SVG 挂载点。
 * @param mermaidSource mermaid 源码文本。
 */
async function renderMermaidIntoCanvas(
  figureElement: HTMLElement,
  canvasElement: HTMLElement,
  mermaidSource: string
): Promise<void> {
  try {
    const mermaidApi = await loadMermaid();
    if (!mermaidApi) {
      // 非浏览器环境：保留 loading 类名但不抛错，避免单测污染。
      return;
    }

    mermaidRenderIdCounter += 1;
    const renderId = `${MERMAID_RENDER_ID_PREFIX}${mermaidRenderIdCounter}`;
    const { svg, bindFunctions } = await mermaidApi.render(renderId, mermaidSource);

    canvasElement.innerHTML = svg;
    bindFunctions?.(canvasElement);
    figureElement.classList.remove(MERMAID_FIGURE_LOADING_CLASS_NAME);
    figureElement.classList.add(MERMAID_FIGURE_LOADED_CLASS_NAME);

    // 关键步骤：记录原始 SVG 文本，全屏查看器以同样的源码注入，避免引用同一 DOM。
    figureElement.dataset[MERMAID_VIEWER_SOURCE_DATA_KEY] = svg;
    figureElement.dataset[MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY] = "true";

    // 渲染成功后启用全屏按钮。
    const fullscreenButtonElement = figureElement.querySelector<HTMLButtonElement>(
      `.${MERMAID_FULLSCREEN_BUTTON_CLASS_NAME}`
    );
    if (fullscreenButtonElement) {
      fullscreenButtonElement.disabled = false;
    }
  } catch (renderError: unknown) {
    showMermaidFallback(figureElement, canvasElement, mermaidSource, renderError);
  }
}

/**
 * 切换 mermaid 容器到失败态：隐藏画布、展示错误摘要与源码。
 * @param figureElement mermaid 外层 figure。
 * @param canvasElement SVG 画布节点。
 * @param mermaidSource 原始 mermaid 源码。
 * @param renderError mermaid 抛出的错误。
 */
function showMermaidFallback(
  figureElement: HTMLElement,
  canvasElement: HTMLElement,
  mermaidSource: string,
  renderError: unknown
): void {
  const ownerDocument = figureElement.ownerDocument;
  figureElement.classList.remove(MERMAID_FIGURE_LOADING_CLASS_NAME);
  figureElement.classList.add(MERMAID_FIGURE_FAILED_CLASS_NAME);

  // 失败态：移除右下角全屏按钮，避免对无图表的容器开启查看器。
  const fullscreenButtonElement = figureElement.querySelector<HTMLButtonElement>(
    `.${MERMAID_FULLSCREEN_BUTTON_CLASS_NAME}`
  );
  fullscreenButtonElement?.remove();

  // 失败态：清空 SVG 画布并替换为错误说明 + 源码块。
  canvasElement.replaceChildren();

  // mermaid 抛错时通常会污染 document 末尾的临时 div，需要清理。
  cleanupOrphanMermaidNodes(ownerDocument);

  const fallbackElement = ownerDocument.createElement("div");
  fallbackElement.className = MERMAID_FALLBACK_CLASS_NAME;

  const iconElement = ownerDocument.createElement("span");
  iconElement.className = MERMAID_FALLBACK_ICON_CLASS_NAME;
  iconElement.setAttribute("aria-hidden", "true");
  fallbackElement.append(iconElement);

  const textElement = ownerDocument.createElement("p");
  textElement.className = MERMAID_FALLBACK_TEXT_CLASS_NAME;
  textElement.textContent = MERMAID_FALLBACK_DEFAULT_TEXT;
  fallbackElement.append(textElement);

  // mermaid 错误对象常带可读 message，附在源码块前给排查使用。
  const errorMessage = extractErrorMessage(renderError);
  if (errorMessage) {
    const messageElement = ownerDocument.createElement("p");
    messageElement.className = MERMAID_FALLBACK_SOURCE_CLASS_NAME;
    messageElement.textContent = errorMessage;
    fallbackElement.append(messageElement);
  }

  // 源码 pre：失败时把原文展示给用户便于复制修改。
  if (mermaidSource.length > 0) {
    const sourceElement = ownerDocument.createElement("pre");
    sourceElement.className = MERMAID_FALLBACK_SOURCE_CLASS_NAME;
    sourceElement.textContent = mermaidSource;
    fallbackElement.append(sourceElement);
  }

  canvasElement.replaceWith(fallbackElement);
}

/**
 * 提取 mermaid 渲染错误的可读文本。
 * @param renderError mermaid 抛出的错误对象。
 * @returns 错误描述文本，未识别时返回空串。
 */
function extractErrorMessage(renderError: unknown): string {
  if (renderError instanceof Error) {
    return renderError.message;
  }
  if (typeof renderError === "string") {
    return renderError;
  }
  return "";
}

/**
 * 清理 mermaid 渲染失败时残留在文档尾部的临时节点。
 * Mermaid 在 render 抛错时不一定会移除自己挂在 body 上的占位 div。
 * @param ownerDocument 当前 document。
 */
function cleanupOrphanMermaidNodes(ownerDocument: Document): void {
  // mermaid 在 document.body 末尾创建临时容器，id 以 d 开头或包含 render id 前缀。
  const orphanNodes = ownerDocument.querySelectorAll<HTMLElement>(
    `body > [id^="${MERMAID_RENDER_ID_PREFIX}"], body > div[id^="d"][id*="mermaid"]`
  );
  orphanNodes.forEach((orphanNode) => {
    orphanNode.remove();
  });
}

/**
 * 右下角全屏按钮使用的 SVG 图标（两个对角线箭头组成的方框）。
 */
const MERMAID_FULLSCREEN_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" ' +
  'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

/**
 * 处理 mermaid 全屏按钮点击：找到所属 figure，把 SVG 源码注入全屏查看器。
 * @param event 全屏按钮点击事件。
 */
function handleMermaidFullscreenButtonClick(event: MouseEvent): void {
  // 触发事件的按钮元素。
  const buttonElement = event.currentTarget as HTMLButtonElement;
  // 所属的 mermaid figure。
  const figureElement = buttonElement.closest<HTMLElement>(`.${MERMAID_FIGURE_CLASS_NAME}`);

  if (!figureElement) {
    return;
  }

  if (figureElement.dataset[MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY] !== "true") {
    return;
  }

  // 之前渲染缓存下来的 SVG 源码。
  const svgSource = figureElement.dataset[MERMAID_VIEWER_SOURCE_DATA_KEY] ?? "";

  if (svgSource.length === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openMarkdownMermaidViewer(figureElement.ownerDocument, svgSource);
}

/**
 * 打开 mermaid 全屏查看器。
 * @param ownerDocument 当前 figure 所在 document。
 * @param svgSource 缓存的 SVG HTML 源码。
 */
function openMarkdownMermaidViewer(ownerDocument: Document, svgSource: string): void {
  // 当前 document 对应的查看器状态（单例）。
  const viewerState = getOrCreateMarkdownMermaidViewerState(ownerDocument);

  // 关键步骤：注入 SVG 并解析固有尺寸，做为 fit + 缩放计算基准。
  viewerState.canvasElement.innerHTML = svgSource;
  const svgDimensions = readSvgNaturalDimensions(viewerState.canvasElement);
  viewerState.naturalWidth = svgDimensions.width;
  viewerState.naturalHeight = svgDimensions.height;
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  viewerState.zoomValue = IMAGE_VIEWER_DEFAULT_ZOOM;

  showMarkdownMermaidViewerDialog(viewerState);
  requestMarkdownMermaidViewerLayout(viewerState);
}

/**
 * 解析画布内 SVG 的固有尺寸，优先读取 viewBox。
 * @param canvasElement 包含 SVG 的画布节点。
 * @returns 固有宽高，缺省回退为 720 × 480。
 */
function readSvgNaturalDimensions(canvasElement: HTMLElement): {
  width: number;
  height: number;
} {
  // 画布中第一个 SVG 节点。
  const svgElement = canvasElement.querySelector<SVGSVGElement>("svg");

  if (!svgElement) {
    return { width: 720, height: 480 };
  }

  // 优先读取 viewBox.baseVal，未声明时回退到 width/height 属性。
  const viewBox = svgElement.viewBox?.baseVal;

  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  // SVG width/height 可能是百分比，无法直接当作固有尺寸时退化为兜底值。
  const widthAttribute = parseFloat(svgElement.getAttribute("width") ?? "");
  const heightAttribute = parseFloat(svgElement.getAttribute("height") ?? "");

  if (Number.isFinite(widthAttribute) && Number.isFinite(heightAttribute)) {
    return {
      width: widthAttribute > 0 ? widthAttribute : 720,
      height: heightAttribute > 0 ? heightAttribute : 480
    };
  }

  return { width: 720, height: 480 };
}

/**
 * 获取或创建当前 document 上的 mermaid 全屏查看器单例。
 * @param ownerDocument 当前 document。
 * @returns 查看器状态。
 */
function getOrCreateMarkdownMermaidViewerState(
  ownerDocument: Document
): MarkdownMermaidViewerState {
  const existingViewerState = mermaidViewerStateByDocument.get(ownerDocument);

  if (existingViewerState) {
    return existingViewerState;
  }

  const createdViewerState = createMarkdownMermaidViewerState(ownerDocument);

  mermaidViewerStateByDocument.set(ownerDocument, createdViewerState);

  return createdViewerState;
}

/**
 * 创建 mermaid 全屏查看器 DOM 与事件绑定。
 * @param ownerDocument 当前 document。
 * @returns 查看器状态。
 */
function createMarkdownMermaidViewerState(ownerDocument: Document): MarkdownMermaidViewerState {
  /** 查看器外层 dialog。 */
  const dialogElement = ownerDocument.createElement("dialog") as HTMLDialogElement;
  /** 顶部 chrome。 */
  const chromeElement = ownerDocument.createElement("div");
  /** caption 节点。 */
  const captionElement = ownerDocument.createElement("p");
  /** 控件容器。 */
  const controlsElement = ownerDocument.createElement("div");
  /** 缩小按钮。 */
  const zoomOutButtonElement = createMarkdownMermaidViewerButton(ownerDocument, {
    ariaLabel: "缩小图表",
    text: IMAGE_VIEWER_ZOOM_OUT_TEXT
  });
  /** 缩放比例显示。 */
  const zoomValueElement = ownerDocument.createElement("span");
  /** 放大按钮。 */
  const zoomInButtonElement = createMarkdownMermaidViewerButton(ownerDocument, {
    ariaLabel: "放大图表",
    text: IMAGE_VIEWER_ZOOM_IN_TEXT
  });
  /** 重置按钮。 */
  const resetButtonElement = createMarkdownMermaidViewerButton(ownerDocument, {
    ariaLabel: "重置缩放",
    text: IMAGE_VIEWER_RESET_TEXT
  });
  /** 关闭按钮。 */
  const closeButtonElement = createMarkdownMermaidViewerButton(ownerDocument, {
    ariaLabel: "关闭全屏查看",
    className: MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME,
    text: IMAGE_VIEWER_CLOSE_TEXT
  });
  /** 滚动视口。 */
  const viewportElement = ownerDocument.createElement("div");
  /** SVG 画布。 */
  const canvasElement = ownerDocument.createElement("div");

  /** 查看器运行时状态。 */
  const viewerState: MarkdownMermaidViewerState = {
    dialogElement,
    captionElement,
    zoomValueElement,
    zoomOutButtonElement,
    zoomInButtonElement,
    resetButtonElement,
    closeButtonElement,
    viewportElement,
    canvasElement,
    naturalWidth: 720,
    naturalHeight: 480,
    zoomValue: IMAGE_VIEWER_DEFAULT_ZOOM,
    isDragging: false,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartScrollLeft: 0,
    dragStartScrollTop: 0
  };
  /** 当前 document 对应的 window。 */
  const ownerWindow = ownerDocument.defaultView;

  dialogElement.className = MERMAID_VIEWER_DIALOG_CLASS_NAME;
  dialogElement.setAttribute("aria-modal", "true");
  dialogElement.setAttribute("aria-label", "全屏查看 Mermaid 图表");
  dialogElement.setAttribute("tabindex", "-1");
  chromeElement.className = MERMAID_VIEWER_CHROME_CLASS_NAME;
  captionElement.className = MERMAID_VIEWER_CAPTION_CLASS_NAME;
  captionElement.textContent = MERMAID_LABEL_TEXT;
  controlsElement.className = MERMAID_VIEWER_CONTROLS_CLASS_NAME;
  zoomValueElement.className = MERMAID_VIEWER_ZOOM_VALUE_CLASS_NAME;
  viewportElement.className = MERMAID_VIEWER_VIEWPORT_CLASS_NAME;
  canvasElement.className = MERMAID_VIEWER_CANVAS_CLASS_NAME;

  mermaidViewerStateByDialogElement.set(dialogElement, viewerState);
  controlsElement.append(
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    closeButtonElement
  );
  chromeElement.append(captionElement, controlsElement);
  viewportElement.append(canvasElement);
  dialogElement.append(chromeElement, viewportElement);
  ownerDocument.body.append(dialogElement);

  dialogElement.addEventListener("click", handleMarkdownMermaidViewerBackdropClick);
  dialogElement.addEventListener("close", handleMarkdownMermaidViewerClose);
  dialogElement.addEventListener("keydown", handleMarkdownMermaidViewerKeyDown);
  viewportElement.addEventListener("wheel", handleMarkdownMermaidViewerWheel, { passive: false });
  viewportElement.addEventListener("pointerdown", handleMarkdownMermaidViewerPointerDown);
  viewportElement.addEventListener("pointermove", handleMarkdownMermaidViewerPointerMove);
  viewportElement.addEventListener("pointerup", handleMarkdownMermaidViewerPointerUp);
  viewportElement.addEventListener("pointercancel", handleMarkdownMermaidViewerPointerUp);
  zoomOutButtonElement.addEventListener("click", handleMarkdownMermaidViewerZoomOutClick);
  zoomInButtonElement.addEventListener("click", handleMarkdownMermaidViewerZoomInClick);
  resetButtonElement.addEventListener("click", handleMarkdownMermaidViewerResetClick);
  closeButtonElement.addEventListener("click", handleMarkdownMermaidViewerCloseClick);

  if (ownerWindow) {
    ownerWindow.addEventListener("resize", handleMarkdownMermaidViewerWindowResize);
  }

  updateMarkdownMermaidViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);

  return viewerState;
}

/**
 * 创建查看器按钮。
 * @param ownerDocument 当前 document。
 * @param options 按钮文案与可访问名称。
 * @returns 已配置的按钮元素。
 */
function createMarkdownMermaidViewerButton(
  ownerDocument: Document,
  options: MarkdownImageViewerButtonOptions
): HTMLButtonElement {
  const buttonElement = ownerDocument.createElement("button");
  buttonElement.type = "button";
  buttonElement.className = options.className
    ? `${MERMAID_VIEWER_BUTTON_CLASS_NAME} ${options.className}`
    : MERMAID_VIEWER_BUTTON_CLASS_NAME;
  buttonElement.textContent = options.text;
  buttonElement.setAttribute("aria-label", options.ariaLabel);
  return buttonElement;
}

/**
 * 显示 mermaid 全屏查看器 dialog。
 * @param viewerState 查看器状态。
 */
function showMarkdownMermaidViewerDialog(viewerState: MarkdownMermaidViewerState): void {
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
 * @param viewerState 查看器状态。
 */
function requestMarkdownMermaidViewerLayout(viewerState: MarkdownMermaidViewerState): void {
  const ownerWindow = viewerState.dialogElement.ownerDocument.defaultView;

  if (!ownerWindow) {
    updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue);
    return;
  }

  ownerWindow.setTimeout(handleMarkdownMermaidViewerDeferredLayout, 0, viewerState);
}

/**
 * 处理延后的布局计算。
 * @param viewerState 查看器状态。
 */
function handleMarkdownMermaidViewerDeferredLayout(
  viewerState: MarkdownMermaidViewerState
): void {
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue);
}

/**
 * 点击遮罩关闭查看器。
 * @param event dialog 点击事件。
 */
function handleMarkdownMermaidViewerBackdropClick(event: MouseEvent): void {
  if (event.target !== event.currentTarget) {
    return;
  }
  const dialogElement = event.currentTarget as HTMLDialogElement;
  const viewerState = mermaidViewerStateByDialogElement.get(dialogElement);
  if (!viewerState) {
    return;
  }
  closeMarkdownMermaidViewer(viewerState);
}

/**
 * dialog close 后复位临时状态。
 * @param event dialog close 事件。
 */
function handleMarkdownMermaidViewerClose(event: Event): void {
  const dialogElement = event.currentTarget as HTMLDialogElement;
  const viewerState = mermaidViewerStateByDialogElement.get(dialogElement);
  if (!viewerState) {
    return;
  }
  resetMarkdownMermaidViewerAfterClose(viewerState);
}

/**
 * 关闭后复位查看器内部临时状态（清空画布、重置缩放）。
 * @param viewerState 查看器状态。
 */
function resetMarkdownMermaidViewerAfterClose(viewerState: MarkdownMermaidViewerState): void {
  viewerState.canvasElement.replaceChildren();
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  viewerState.zoomValue = IMAGE_VIEWER_DEFAULT_ZOOM;
  viewerState.isDragging = false;
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_DRAGGING_CLASS_NAME);
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_ZOOMED_CLASS_NAME);
}

/**
 * 处理键盘缩放和关闭。
 * @param event 键盘事件。
 */
function handleMarkdownMermaidViewerKeyDown(event: KeyboardEvent): void {
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue + IMAGE_VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue - IMAGE_VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "0") {
    event.preventDefault();
    updateMarkdownMermaidViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeMarkdownMermaidViewer(viewerState);
  }
}

/**
 * 处理 ctrl/cmd + 滚轮缩放图表。
 * @param event 视口滚轮事件。
 */
function handleMarkdownMermaidViewerWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) {
    return;
  }
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  // 与 deltaY 成比例并夹紧到上限，让触控板细滑动产生细粒度缩放、鼠标滚轮单格仍可见。
  const rawDelta = -event.deltaY * IMAGE_VIEWER_WHEEL_ZOOM_FACTOR;
  const zoomDelta = Math.max(
    -IMAGE_VIEWER_WHEEL_ZOOM_MAX_DELTA,
    Math.min(IMAGE_VIEWER_WHEEL_ZOOM_MAX_DELTA, rawDelta)
  );
  event.preventDefault();
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue + zoomDelta, {
    x: event.clientX,
    y: event.clientY
  });
}

/**
 * 处理鼠标按下开启拖拽平移。
 * @param event 视口指针事件。
 */
function handleMarkdownMermaidViewerPointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }
  const viewportElement = event.currentTarget as HTMLElement;
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
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
  viewerState.dialogElement.classList.add(MERMAID_VIEWER_DRAGGING_CLASS_NAME);
  if (typeof viewportElement.setPointerCapture === "function") {
    viewportElement.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

/**
 * 处理鼠标移动跟随滚动。
 * @param event 视口指针事件。
 */
function handleMarkdownMermaidViewerPointerMove(event: PointerEvent): void {
  const viewportElement = event.currentTarget as HTMLElement;
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState || !viewerState.isDragging) {
    return;
  }
  const deltaX = event.clientX - viewerState.dragStartClientX;
  const deltaY = event.clientY - viewerState.dragStartClientY;
  viewportElement.scrollLeft = viewerState.dragStartScrollLeft - deltaX;
  viewportElement.scrollTop = viewerState.dragStartScrollTop - deltaY;
}

/**
 * 处理鼠标抬起/取消，结束拖拽。
 * @param event 视口指针事件。
 */
function handleMarkdownMermaidViewerPointerUp(event: PointerEvent): void {
  const viewportElement = event.currentTarget as HTMLElement;
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState || !viewerState.isDragging) {
    return;
  }
  viewerState.isDragging = false;
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_DRAGGING_CLASS_NAME);
  if (
    typeof viewportElement.releasePointerCapture === "function" &&
    viewportElement.hasPointerCapture(event.pointerId)
  ) {
    viewportElement.releasePointerCapture(event.pointerId);
  }
}

/**
 * 处理 window resize 后的画布尺寸适配。
 * @param event window resize 事件。
 */
function handleMarkdownMermaidViewerWindowResize(event: Event): void {
  const ownerWindow = event.currentTarget as Window;
  const viewerState = mermaidViewerStateByDocument.get(ownerWindow.document);
  if (!viewerState || !isMarkdownMermaidViewerOpen(viewerState)) {
    return;
  }
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue);
}

/**
 * 处理缩小按钮点击。
 * @param event 按钮点击事件。
 */
function handleMarkdownMermaidViewerZoomOutClick(event: MouseEvent): void {
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue - IMAGE_VIEWER_ZOOM_STEP);
}

/**
 * 处理放大按钮点击。
 * @param event 按钮点击事件。
 */
function handleMarkdownMermaidViewerZoomInClick(event: MouseEvent): void {
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue + IMAGE_VIEWER_ZOOM_STEP);
}

/**
 * 处理重置按钮点击。
 * @param event 按钮点击事件。
 */
function handleMarkdownMermaidViewerResetClick(event: MouseEvent): void {
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  updateMarkdownMermaidViewerZoom(viewerState, IMAGE_VIEWER_DEFAULT_ZOOM);
}

/**
 * 处理关闭按钮点击。
 * @param event 按钮点击事件。
 */
function handleMarkdownMermaidViewerCloseClick(event: MouseEvent): void {
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  closeMarkdownMermaidViewer(viewerState);
}

/**
 * 从事件回溯查看器状态。
 * @param event DOM 事件。
 * @returns 当前事件所属的查看器状态。
 */
function getMarkdownMermaidViewerStateFromEvent(
  event: Event
): MarkdownMermaidViewerState | undefined {
  // 优先沿祖先链找到所属 dialog。
  const targetElement = event.target as HTMLElement | null;
  const dialogElement =
    targetElement?.closest<HTMLDialogElement>(`.${MERMAID_VIEWER_DIALOG_CLASS_NAME}`) ?? null;

  if (!dialogElement) {
    return undefined;
  }
  return mermaidViewerStateByDialogElement.get(dialogElement);
}

/**
 * 关闭 mermaid 全屏查看器。
 * @param viewerState 查看器状态。
 */
function closeMarkdownMermaidViewer(viewerState: MarkdownMermaidViewerState): void {
  if (typeof viewerState.dialogElement.close === "function" && viewerState.dialogElement.open) {
    viewerState.dialogElement.close();
    return;
  }
  viewerState.dialogElement.removeAttribute("open");
  resetMarkdownMermaidViewerAfterClose(viewerState);
}

/**
 * 当前查看器是否处于打开态。
 * @param viewerState 查看器状态。
 * @returns dialog 是否打开。
 */
function isMarkdownMermaidViewerOpen(viewerState: MarkdownMermaidViewerState): boolean {
  return viewerState.dialogElement.open === true;
}

/**
 * 更新查看器缩放比例与画布尺寸。
 * @param viewerState 查看器状态。
 * @param nextZoom 目标缩放倍数。
 * @param zoomAnchor 可选的缩放焦点（客户端坐标）。
 */
function updateMarkdownMermaidViewerZoom(
  viewerState: MarkdownMermaidViewerState,
  nextZoom: number,
  zoomAnchor?: MarkdownImageViewerZoomAnchor
): void {
  /** 归一化的缩放倍数。 */
  const normalizedZoom = clampMarkdownImageViewerZoom(nextZoom);
  /** 缩放前的焦点。 */
  const focalPoint = isMarkdownMermaidViewerOpen(viewerState)
    ? captureMarkdownMermaidViewerFocalPoint(viewerState, zoomAnchor)
    : undefined;

  viewerState.zoomValue = normalizedZoom;
  viewerState.dialogElement.classList.toggle(
    MERMAID_VIEWER_ZOOMED_CLASS_NAME,
    normalizedZoom > IMAGE_VIEWER_DEFAULT_ZOOM
  );
  viewerState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  viewerState.zoomOutButtonElement.disabled = normalizedZoom <= IMAGE_VIEWER_MIN_ZOOM;
  viewerState.zoomInButtonElement.disabled = normalizedZoom >= IMAGE_VIEWER_MAX_ZOOM;
  viewerState.resetButtonElement.disabled = normalizedZoom === IMAGE_VIEWER_DEFAULT_ZOOM;
  updateMarkdownMermaidViewerCanvasSize(viewerState);

  if (focalPoint) {
    applyMarkdownMermaidViewerFocalPoint(viewerState, focalPoint);
  }
}

/**
 * 记录缩放前的焦点：把客户端坐标转成画布内的归一化位置。
 * @param viewerState 查看器状态。
 * @param zoomAnchor 客户端坐标锚点。
 * @returns 焦点信息，画布未布局时返回 undefined。
 */
function captureMarkdownMermaidViewerFocalPoint(
  viewerState: MarkdownMermaidViewerState,
  zoomAnchor?: MarkdownImageViewerZoomAnchor
): MarkdownImageViewerFocalPoint | undefined {
  /** 缩放前画布矩形。 */
  const preCanvasRect = viewerState.canvasElement.getBoundingClientRect();
  if (preCanvasRect.width <= 0 || preCanvasRect.height <= 0) {
    return undefined;
  }
  const viewportRect = viewerState.viewportElement.getBoundingClientRect();
  const anchorClientX = zoomAnchor?.x ?? viewportRect.left + viewportRect.width / 2;
  const anchorClientY = zoomAnchor?.y ?? viewportRect.top + viewportRect.height / 2;
  const normalizedX = (anchorClientX - preCanvasRect.left) / preCanvasRect.width;
  const normalizedY = (anchorClientY - preCanvasRect.top) / preCanvasRect.height;
  return { anchorClientX, anchorClientY, normalizedX, normalizedY };
}

/**
 * 缩放后调整滚动量，使焦点保持在原客户端位置。
 * @param viewerState 查看器状态。
 * @param focalPoint 缩放前记录的焦点。
 */
function applyMarkdownMermaidViewerFocalPoint(
  viewerState: MarkdownMermaidViewerState,
  focalPoint: MarkdownImageViewerFocalPoint
): void {
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  const postCanvasRect = viewerState.canvasElement.getBoundingClientRect();
  if (postCanvasRect.width <= 0 || postCanvasRect.height <= 0) {
    return;
  }
  const targetCanvasClientLeft =
    focalPoint.anchorClientX - focalPoint.normalizedX * postCanvasRect.width;
  const targetCanvasClientTop =
    focalPoint.anchorClientY - focalPoint.normalizedY * postCanvasRect.height;
  viewerState.viewportElement.scrollLeft = postCanvasRect.left - targetCanvasClientLeft;
  viewerState.viewportElement.scrollTop = postCanvasRect.top - targetCanvasClientTop;
}

/**
 * 根据视口与缩放比例更新画布尺寸。
 * @param viewerState 查看器状态。
 */
function updateMarkdownMermaidViewerCanvasSize(viewerState: MarkdownMermaidViewerState): void {
  const viewportWidth = Math.max(
    viewerState.viewportElement.clientWidth * IMAGE_VIEWER_FIT_RATIO,
    1
  );
  const viewportHeight = Math.max(
    viewerState.viewportElement.clientHeight * IMAGE_VIEWER_FIT_RATIO,
    1
  );
  const naturalWidth = Math.max(viewerState.naturalWidth, 1);
  const naturalHeight = Math.max(viewerState.naturalHeight, 1);
  // fit 缩放：在不放大原图的前提下让整张图适配视口。
  const fitScale = Math.min(1, viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  const displayWidth = Math.max(1, Math.round(naturalWidth * fitScale * viewerState.zoomValue));
  const displayHeight = Math.max(1, Math.round(naturalHeight * fitScale * viewerState.zoomValue));

  viewerState.canvasElement.style.width = `${displayWidth}px`;
  viewerState.canvasElement.style.height = `${displayHeight}px`;

  // 关键步骤：让内部 SVG 撑满 canvas，保持等比缩放。
  const innerSvgElement = viewerState.canvasElement.querySelector<SVGSVGElement>("svg");
  if (innerSvgElement) {
    innerSvgElement.removeAttribute("width");
    innerSvgElement.removeAttribute("height");
    innerSvgElement.style.width = "100%";
    innerSvgElement.style.height = "100%";
    innerSvgElement.style.maxWidth = "none";
    innerSvgElement.style.display = "block";
  }
}

/**
 * 对已渲染到 DOM 的 Markdown 内容执行交互 hydration。
 * 处理图片放大查看、视频占位、Mermaid、代码块复制等运行时行为。
 * 不挂载浮动工具栏；如需工具栏请额外调用 {@link mountMarkdownToolbar}。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
export function hydrateMarkdown(rootElement: ParentNode): void {
  hydrateMarkdownImages(rootElement);
  hydrateMarkdownVideos(rootElement);
  // 关键步骤：mermaid 必须先于代码块 hydrate，避免被通用 code chrome 包装。
  hydrateMermaidBlocks(rootElement);
  hydrateCodeBlocks(rootElement);
}

/**
 * 在指定 DOM 容器上挂载 Scribdown 浮动工具栏（回到顶部 / 目录 / 页面宽度切换）。
 * 工具栏 DOM 会直接 append 到 `container` 内，便于宿主控制生命周期：
 * 移除 / 替换 container 即可一并卸载工具栏，不会污染 `<body>`。
 * 视觉上工具栏使用 `position: fixed`，位置始终相对视口，与挂载点的 CSS 上下文无关。
 *
 * 仅在浏览器环境生效；非浏览器环境（如 Node.js 单测）或 SSR 阶段直接跳过。
 * 重复调用会先清理 container 内的旧实例，可在每次 {@link hydrateMarkdown} 后安全重新挂载。
 * @param container 目标挂载容器；同时作为目录采集与点击外部关闭的作用域。
 */
export function mountMarkdownToolbar(container: Element): void {
  /** 容器所属的 document。 */
  const ownerDocument = container.ownerDocument;
  if (!ownerDocument) {
    return;
  }
  if (typeof ownerDocument.defaultView?.scrollTo !== "function") {
    return;
  }
  // 关键步骤：恢复上次保存的内容宽度，再挂载工具栏。
  applyContentWidth(ownerDocument, loadContentWidth());
  mountPageToolbar(ownerDocument, container);
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

  // 把代码内容按行拆分为带类名的 span，并得到总行数用于固定行号列。
  const codeLineCount = rewriteCodeBlockLines(codeElement, ownerDocument);

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

  // 固定宽度行号列，作为 pre 的兄弟节点独立布局，不跟随代码横向滚动。
  const gutterElement = createCodeBlockLineNumberGutter(ownerDocument, codeLineCount);

  // 把 pre 替换为 figure，再把 chrome + body + 原 pre 放进 figure。
  preElement.replaceWith(figureElement);
  bodyElement.append(gutterElement, preElement);
  figureElement.append(chromeElement, bodyElement);

  // 关键步骤：把源码行锚点从内层 code 迁移到最外层 figure，
  // 使编辑器光标定位的高亮能覆盖整个代码块（含顶部 chrome）。
  // remark-rehype 把 code 节点的 data-source-line 落在 code 元素上，而非 pre。
  const codeBlockSourceLine = codeElement.getAttribute(SOURCE_LINE_DATA_ATTRIBUTE);

  if (codeBlockSourceLine !== null) {
    figureElement.setAttribute(SOURCE_LINE_DATA_ATTRIBUTE, codeBlockSourceLine);
    codeElement.removeAttribute(SOURCE_LINE_DATA_ATTRIBUTE);
  }

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
 * 把代码内容按行拆分为带类名的 span。
 * Shiki 已经输出 `<span class="line">` 时直接复用并补充类名，否则做纯文本拆分。
 * @param codeElement pre 内部的 code 元素。
 * @param ownerDocument 当前 document。
 * @returns 当前代码块拆分后的总行数。
 */
function rewriteCodeBlockLines(codeElement: HTMLElement, ownerDocument: Document): number {
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
    return shikiLineNodes.length;
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

  return codeLines.length;
}

/**
 * 创建代码块左侧固定行号列，保证行号区不参与横向滚动。
 * @param ownerDocument 当前 document。
 * @param lineCount 代码总行数。
 * @returns 已填充行号文本的固定列容器。
 */
function createCodeBlockLineNumberGutter(
  ownerDocument: Document,
  lineCount: number
): HTMLDivElement {
  // 行号固定列容器。
  const gutterElement = ownerDocument.createElement("div");
  gutterElement.className = CODE_BLOCK_GUTTER_CLASS_NAME;

  // 当前循环行索引（0-based），用于生成 1-based 行号文本。
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    // 当前行号文本（1-based）。
    const lineNumberText = String(lineIndex + 1);
    // 单行行号节点。
    const lineNumberElement = ownerDocument.createElement("span");
    lineNumberElement.className = CODE_BLOCK_GUTTER_LINE_CLASS_NAME;
    lineNumberElement.textContent = lineNumberText;
    gutterElement.append(lineNumberElement);
  }

  return gutterElement;
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
 * 给单个视频元素绑定加载完成与失败回退状态机。
 * @param videoElement 待绑定状态的视频元素。
 */
function bindMarkdownVideoState(videoElement: HTMLVideoElement): void {
  updateMarkdownVideoState(videoElement);

  if (videoElement.dataset[VIDEO_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  videoElement.dataset[VIDEO_HYDRATED_DATA_KEY] = "true";
  videoElement.addEventListener("loadeddata", handleMarkdownVideoLoaded);
  videoElement.addEventListener("error", handleMarkdownVideoError);

  // 关键步骤：同时监听内部 <source> 的 error，覆盖多源视频在最后一个源失败后才能确认失败的场景。
  videoElement
    .querySelectorAll<HTMLSourceElement>("source")
    .forEach((sourceElement) => {
      sourceElement.addEventListener("error", handleMarkdownVideoSourceError);
    });
}

/**
 * 处理视频可播放数据就绪事件，刷新 frame 状态类。
 * @param event 视频加载事件。
 */
function handleMarkdownVideoLoaded(event: Event): void {
  // 触发就绪事件的视频元素。
  const videoElement = event.currentTarget as HTMLVideoElement;

  updateMarkdownVideoState(videoElement);
}

/**
 * 处理视频本体加载失败事件。
 * @param event 视频失败事件。
 */
function handleMarkdownVideoError(event: Event): void {
  // 触发失败事件的视频元素。
  const videoElement = event.currentTarget as HTMLVideoElement;

  markMarkdownVideoFailed(videoElement);
}

/**
 * 处理视频内部 <source> 的失败事件。
 * 仅当 networkState 进入 NETWORK_NO_SOURCE，意味着所有候选源均不可用时，才标记失败。
 * @param event source 失败事件。
 */
function handleMarkdownVideoSourceError(event: Event): void {
  // 触发失败事件的 source 元素。
  const sourceElement = event.currentTarget as HTMLElement;
  // 关联的视频宿主元素。
  const videoElement = sourceElement.closest<HTMLVideoElement>(
    `video.${VIDEO_ELEMENT_CLASS_NAME}`
  );

  if (!videoElement) {
    return;
  }
  if (videoElement.networkState !== videoElement.NETWORK_NO_SOURCE) {
    return;
  }

  markMarkdownVideoFailed(videoElement);
}

/**
 * 根据视频当前播放状态刷新 frame 状态类。
 * @param videoElement 待更新状态的视频元素。
 */
function updateMarkdownVideoState(videoElement: HTMLVideoElement): void {
  // 视频外层 frame 元素。
  const frameElement = videoElement.closest<HTMLElement>(
    `.${VIDEO_FRAME_CLASS_NAME}`
  );

  if (!frameElement) {
    return;
  }

  // 当前视频是否已确认加载失败：本体 error 非空，或没有可用源。
  const isFailed =
    videoElement.error !== null ||
    videoElement.networkState === videoElement.NETWORK_NO_SOURCE;
  // 当前视频是否已确认拿到首帧。
  const isLoaded = videoElement.readyState >= videoElement.HAVE_CURRENT_DATA;

  frameElement.classList.toggle(VIDEO_FRAME_FAILED_CLASS_NAME, isFailed);
  frameElement.classList.toggle(
    VIDEO_FRAME_LOADED_CLASS_NAME,
    isLoaded && !isFailed
  );
}

/**
 * 把视频 frame 强制切到失败态，并清除可能已存在的 loaded 标记。
 * @param videoElement 触发失败的视频元素。
 */
function markMarkdownVideoFailed(videoElement: HTMLVideoElement): void {
  // 视频外层 frame 元素。
  const frameElement = videoElement.closest<HTMLElement>(
    `.${VIDEO_FRAME_CLASS_NAME}`
  );

  if (!frameElement) {
    return;
  }

  frameElement.classList.add(VIDEO_FRAME_FAILED_CLASS_NAME);
  frameElement.classList.remove(VIDEO_FRAME_LOADED_CLASS_NAME);
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

  // 与 deltaY 成比例并夹紧到上限，让触控板细滑动产生细粒度缩放、鼠标滚轮单格仍可见。
  const rawDelta = -event.deltaY * IMAGE_VIEWER_WHEEL_ZOOM_FACTOR;
  const zoomDelta = Math.max(
    -IMAGE_VIEWER_WHEEL_ZOOM_MAX_DELTA,
    Math.min(IMAGE_VIEWER_WHEEL_ZOOM_MAX_DELTA, rawDelta)
  );

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
  // span 元素的属性白名单：放行标题行内包裹层与图片 / 视频 frame / fallback 的 class。
  const spanAttributes = [
    ...(defaultAttributes.span ?? []),
    [
      "className",
      HEADING_MARK_CLASS_NAME,
      IMAGE_FRAME_CLASS_NAME,
      IMAGE_FALLBACK_CLASS_NAME,
      IMAGE_FALLBACK_ICON_CLASS_NAME,
      IMAGE_FALLBACK_TEXT_CLASS_NAME,
      IMAGE_FALLBACK_SOURCE_CLASS_NAME,
      VIDEO_FRAME_CLASS_NAME,
      VIDEO_FALLBACK_CLASS_NAME,
      VIDEO_FALLBACK_ICON_CLASS_NAME,
      VIDEO_FALLBACK_TEXT_CLASS_NAME,
      VIDEO_FALLBACK_SOURCE_CLASS_NAME
    ] as [string, ...string[]]
  ];
  // figure 元素的属性白名单：放行图片 figure 与视频 figure 的 class。
  const figureAttributes = [
    ["className", IMAGE_FIGURE_CLASS_NAME, VIDEO_FIGURE_CLASS_NAME] as [
      string,
      string,
      string
    ]
  ];
  // figcaption 元素的属性白名单。
  const figcaptionAttributes = [["className", IMAGE_CAPTION_CLASS_NAME] as [string, string]];
  // img 元素的属性白名单。
  const imageAttributes = [
    ...(defaultAttributes.img ?? []),
    ["className", IMAGE_ELEMENT_CLASS_NAME] as [string, string]
  ];
  // video 元素的属性白名单：放行常用播放控制属性与统一类名。
  // 禁止任何事件处理属性（默认 schema 不在白名单的属性会被剥除）。
  const videoAttributes = [
    "src",
    "controls",
    "controlsList",
    "width",
    "height",
    "poster",
    "preload",
    "playsInline",
    "muted",
    "loop",
    "autoPlay",
    "crossOrigin",
    ["className", VIDEO_ELEMENT_CLASS_NAME] as [string, string]
  ];
  // source 元素的属性白名单（<video> 多源回退用）。
  const sourceAttributes = ["src", "type", "media"];
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
  // 通配元素属性白名单：额外放行滚动对齐用的 data-source-line。
  const wildcardAttributes = [...(defaultAttributes["*"] ?? []), SOURCE_LINE_HAST_PROPERTY];

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
        "figcaption",
        "video",
        "source"
      ])
    ),
    attributes: {
      ...defaultAttributes,
      "*": wildcardAttributes,
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
      img: imageAttributes,
      video: videoAttributes,
      source: sourceAttributes
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
 * 块级容器节点类型集合：这些节点的子节点同样是块级节点，需递归下钻标注源码行锚点，
 * 以覆盖列表中的代码块、嵌套引用等场景。
 */
const BLOCK_CONTAINER_NODE_TYPES = new Set(["list", "listItem", "blockquote"]);

/**
 * remark 插件：为块级节点标注源码起始行号，递归覆盖嵌套块级结构。
 * 通过 hProperties 注入 data-source-line 属性，供编辑器与预览的双向滚动对齐使用。
 * @returns Markdown AST 转换器。
 */
function remarkSourceLine(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    // 顶层块级节点列表。
    const blockNodes = tree.children ?? [];

    blockNodes.forEach((blockNode) => {
      annotateSourceLine(blockNode);

      // 关键步骤：列表项、引用等不在顶层，递归下钻为内部块级节点标注源码行锚点。
      annotateNestedBlockSourceLines(blockNode);
    });
  };
}

/**
 * 为单个节点注入 data-source-line 源码行锚点。
 * @param node 目标 Markdown 节点。
 */
function annotateSourceLine(node: MarkdownNode): void {
  // 当前节点的源码起始行号（1-based）。
  const startLine = node.position?.start.line;

  // 仅标注带源码位置的节点；TOC、定义列表、图片 figure 等转换节点已显式保留原段落位置，
  // 真正无源码位置的纯生成节点自动跳过。
  if (typeof startLine !== "number") {
    return;
  }

  // 节点 HTML 转换元数据容器。
  const nodeData: MarkdownNodeData = node.data ?? {};
  // 节点 hast 属性容器。
  const hProperties: Record<string, unknown> = nodeData.hProperties ?? {};

  hProperties[SOURCE_LINE_HAST_PROPERTY] = startLine;
  nodeData.hProperties = hProperties;
  node.data = nodeData;
}

/**
 * 递归为块级容器节点内部的子节点标注源码行锚点。
 * 覆盖列表项、嵌套子列表、引用内的代码块与嵌套引用等场景。
 * @param node 当前块级节点。
 */
function annotateNestedBlockSourceLines(node: MarkdownNode): void {
  // 仅块级容器节点的子节点为块级节点，非容器节点无需下钻。
  if (!BLOCK_CONTAINER_NODE_TYPES.has(node.type)) {
    return;
  }

  // 容器节点的直接子节点。
  const childNodes = node.children ?? [];

  childNodes.forEach((childNode) => {
    annotateSourceLine(childNode);
    annotateNestedBlockSourceLines(childNode);
  });
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
    // 关键步骤：保留原段落源码位置，使 remarkSourceLine 能为 dl 标注 data-source-line。
    position: node.position,
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
    // 关键步骤：保留原段落源码位置，使 remarkSourceLine 能为 figure 标注 data-source-line。
    position: node.position,
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
      childNodes[childIndex] = createTocNode(tocHeadings, childNode);
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
 * @param markerNode [TOC] 标记段落节点，用于保留源码位置。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocNode(tocHeadings: TocHeading[], markerNode: MarkdownNode): MarkdownNode {
  // 层级化后的目录条目，用于生成可折叠分支。
  const tocTree = createTocTree(tocHeadings);

  return {
    type: "toc",
    // 关键步骤：保留 [TOC] 标记段落的源码位置，使 remarkSourceLine 能为目录标注 data-source-line。
    position: markerNode.position,
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
  const tocItemClassNames = createTocItemClassNames(tocItem.depth, hasChildren);

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
 * 生成目录条目所需的 class 列表，inline TOC 与 toolbar 抽屉共用。
 * @param depth 标题原始层级。
 * @param hasChildren 是否拥有可折叠子层级。
 * @returns class 列表。
 */
function createTocItemClassNames(depth: number, hasChildren: boolean): string[] {
  return [
    TOC_ITEM_CLASS_PREFIX,
    `${TOC_ITEM_CLASS_PREFIX}--depth-${depth}`,
    ...(hasChildren ? [TOC_ITEM_BRANCH_CLASS_NAME] : [])
  ];
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
 * 从已渲染的 DOM 中收集带 id 的标题，转换为目录条目。
 * 与 inline TOC 共用 {@link createHeadingIndex} 生成层级编号，使 toolbar 抽屉与文档内目录的层级逻辑一致。
 * @param rootElement 含 Markdown 渲染结果的根节点。
 * @returns 扁平目录标题条目。
 */
function collectTocHeadingsFromDom(rootElement: ParentNode): TocHeading[] {
  /** Markdown 渲染容器；rootElement 自身或其后代命中 .scribdown-markdown 时即视为容器，否则视为未渲染。 */
  const markdownContainer =
    rootElement instanceof Element && rootElement.matches(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`)
      ? rootElement
      : rootElement.querySelector<HTMLElement>(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`);
  if (!markdownContainer) {
    return [];
  }

  /** 渲染区域内所有带 id 的标题元素。 */
  const headingElements = Array.from(
    markdownContainer.querySelectorAll<HTMLHeadingElement>(
      "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"
    )
  );

  /** 收集结果。 */
  const tocHeadings: TocHeading[] = [];
  /** 各标题层级的计数器。 */
  const headingIndexCounts = Array.from({ length: 7 }, () => 0);
  /** 文档内首个标题的层级，作为目录序号根层级。 */
  let rootHeadingDepth: number | undefined;

  for (const headingElement of headingElements) {
    // 从标签名解析当前标题层级（h1..h6）。
    const headingDepth = parseInt(headingElement.tagName.slice(1), 10);
    if (!Number.isFinite(headingDepth)) {
      continue;
    }

    // 标题可见文本。
    const headingText = headingElement.textContent?.trim() ?? "";
    // 标题锚点 id，由 inline TOC 渲染时写入。
    const headingId = headingElement.id;
    // 与 inline TOC 共用的层级编号生成逻辑。
    const headingIndex = createHeadingIndex(
      headingDepth,
      headingIndexCounts,
      rootHeadingDepth ?? headingDepth
    );
    rootHeadingDepth = rootHeadingDepth ?? headingDepth;

    tocHeadings.push({
      depth: headingDepth,
      id: headingId,
      index: headingIndex,
      text: headingText || headingId
    });
  }

  return tocHeadings;
}

/**
 * 目录 DOM 构造选项，供 toolbar 抽屉等运行时入口复用。
 */
interface CreateTocNavElementOptions {
  /** 点击目录链接时触发的回调，常用于关闭抽屉。 */
  onLinkClick?: (event: MouseEvent) => void;
  /** 嵌套分支是否默认展开，默认 true 与 inline TOC 对齐。 */
  branchInitiallyOpen?: boolean;
}

/**
 * 使用与 inline TOC 完全一致的 DOM 结构构建目录 nav 节点。
 * @param ownerDocument 目标 document。
 * @param tocTreeItems 目录树根节点集合。
 * @param options 可选回调与展开策略。
 * @returns 含完整目录列表的 nav 元素。
 */
function createTocNavElement(
  ownerDocument: Document,
  tocTreeItems: TocTreeItem[],
  options: CreateTocNavElementOptions = {}
): HTMLElement {
  /** 嵌套分支默认展开开关。 */
  const branchInitiallyOpen = options.branchInitiallyOpen ?? true;

  const navElement = ownerDocument.createElement("nav");
  navElement.setAttribute("aria-label", TOC_ARIA_LABEL);
  navElement.className = TOC_NAV_CLASS_NAME;
  navElement.appendChild(
    createTocListElement(ownerDocument, tocTreeItems, false, { ...options, branchInitiallyOpen })
  );
  return navElement;
}

/**
 * 构造目录列表元素，与 inline TOC 的 ol 结构保持一致。
 * @param ownerDocument 目标 document。
 * @param tocItems 当前层级的目录条目。
 * @param isNested 是否为嵌套列表。
 * @param options 共享构造选项。
 * @returns ol 列表元素。
 */
function createTocListElement(
  ownerDocument: Document,
  tocItems: TocTreeItem[],
  isNested: boolean,
  options: Required<Pick<CreateTocNavElementOptions, "branchInitiallyOpen">> &
    CreateTocNavElementOptions
): HTMLOListElement {
  const listElement = ownerDocument.createElement("ol");
  listElement.className = isNested
    ? `${TOC_LIST_CLASS_NAME} ${TOC_LIST_NESTED_CLASS_NAME}`
    : TOC_LIST_CLASS_NAME;

  for (const tocItem of tocItems) {
    listElement.appendChild(createTocListItemElement(ownerDocument, tocItem, options));
  }

  return listElement;
}

/**
 * 构造目录列表项，含可折叠分支与叶子链接两种形态。
 * @param ownerDocument 目标 document。
 * @param tocItem 当前目录条目。
 * @param options 共享构造选项。
 * @returns li 元素。
 */
function createTocListItemElement(
  ownerDocument: Document,
  tocItem: TocTreeItem,
  options: Required<Pick<CreateTocNavElementOptions, "branchInitiallyOpen">> &
    CreateTocNavElementOptions
): HTMLLIElement {
  /** 当前条目是否拥有可折叠的子层级。 */
  const hasChildren = tocItem.children.length > 0;

  const itemElement = ownerDocument.createElement("li");
  itemElement.className = createTocItemClassNames(tocItem.depth, hasChildren).join(" ");
  itemElement.dataset.tocIndex = tocItem.index;

  if (hasChildren) {
    // 分支条目：details + summary，summary 内并列展示分支标题与跳转锚点。
    const branchElement = ownerDocument.createElement("details");
    branchElement.className = TOC_BRANCH_CLASS_NAME;
    branchElement.open = options.branchInitiallyOpen;

    const summaryElement = ownerDocument.createElement("summary");
    summaryElement.className = TOC_BRANCH_SUMMARY_CLASS_NAME;
    summaryElement.append(ownerDocument.createTextNode(tocItem.text));

    const branchLinkElement = ownerDocument.createElement("a");
    branchLinkElement.href = `#${tocItem.id}`;
    branchLinkElement.setAttribute(
      "aria-label",
      `${TOC_BRANCH_LINK_ARIA_LABEL_PREFIX}${tocItem.text}`
    );
    branchLinkElement.className = TOC_BRANCH_LINK_CLASS_NAME;
    branchLinkElement.textContent = TOC_BRANCH_LINK_TEXT;
    if (options.onLinkClick) {
      branchLinkElement.addEventListener("click", options.onLinkClick);
    }

    summaryElement.appendChild(branchLinkElement);
    branchElement.appendChild(summaryElement);
    branchElement.appendChild(
      createTocListElement(ownerDocument, tocItem.children, true, options)
    );
    itemElement.appendChild(branchElement);
  } else {
    // 叶子条目：与 inline TOC 一致，使用 <p> 包裹跳转链接，避免列表项基线偏移。
    const paragraphElement = ownerDocument.createElement("p");
    const linkElement = ownerDocument.createElement("a");
    linkElement.href = `#${tocItem.id}`;
    linkElement.textContent = tocItem.text;
    if (options.onLinkClick) {
      linkElement.addEventListener("click", options.onLinkClick);
    }
    paragraphElement.appendChild(linkElement);
    itemElement.appendChild(paragraphElement);
  }

  return itemElement;
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

/**
 * hast 节点的最小结构，覆盖元素 / 文本两类，
 * 仅暴露视频 figure 包装需要的字段，避免引入 @types/hast。
 */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
}

/**
 * rehype 插件：把渲染后的 <video> 元素包装为 figure 结构，
 * 与图片 figure 保持视觉与失败回退状态机一致。
 * 该插件运行在 rehype-raw 之后、rehype-sanitize 之前，结构清洗在后兜底。
 * @returns hast 转换器。
 */
function rehypeVideoFigures(): (tree: HastNode) => void {
  return (tree: HastNode) => {
    transformVideoFigures(tree);
  };
}

/**
 * 深度优先遍历 hast 树，把 video 节点替换为 video figure 结构。
 * @param node 当前 hast 节点。
 */
function transformVideoFigures(node: HastNode): void {
  if (!Array.isArray(node.children)) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];

    if (isHastVideoElement(childNode)) {
      childNodes[childIndex] = createVideoFigureHast(childNode);
      continue;
    }

    // <p><video/></p> 形式（行内 HTML 解析的常见结果）：把整段替换为 figure。
    /** 仅包含单个 video 的段落剥离结果。 */
    const standaloneVideo = extractStandaloneParagraphVideo(childNode);
    if (standaloneVideo) {
      childNodes[childIndex] = createVideoFigureHast(standaloneVideo);
      continue;
    }

    transformVideoFigures(childNode);
  }
}

/**
 * 判断 hast 节点是否为 <video> 元素。
 * @param node 待判断的 hast 节点。
 * @returns 是否为 video 元素。
 */
function isHastVideoElement(node: HastNode): boolean {
  return node.type === "element" && node.tagName === "video";
}

/**
 * 尝试从只包含单个 <video> 的 <p> 段落中剥离出该 video 节点。
 * @param node 待检查的 hast 节点。
 * @returns 剥离出的 video 节点；不匹配则返回 undefined。
 */
function extractStandaloneParagraphVideo(node: HastNode): HastNode | undefined {
  if (
    node.type !== "element" ||
    node.tagName !== "p" ||
    !Array.isArray(node.children)
  ) {
    return undefined;
  }

  /** 段落内忽略纯空白文本节点后的有效子节点列表。 */
  const significantChildren = node.children.filter((childNode) => {
    if (childNode.type === "text" && typeof childNode.value === "string") {
      return childNode.value.trim().length > 0;
    }
    return true;
  });

  if (
    significantChildren.length === 1 &&
    isHastVideoElement(significantChildren[0])
  ) {
    return significantChildren[0];
  }

  return undefined;
}

/**
 * 把 video 节点装饰类名后包装为 figure + frame + fallback 的 hast 结构。
 * @param videoNode 原始 video 节点。
 * @returns 新的 figure hast 节点。
 */
function createVideoFigureHast(videoNode: HastNode): HastNode {
  decorateHastVideoElement(videoNode);

  /** 用于失败态展示的源 URL。 */
  const sourceUrl = readHastVideoSourceUrl(videoNode);

  return {
    type: "element",
    tagName: "figure",
    properties: { className: [VIDEO_FIGURE_CLASS_NAME] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FRAME_CLASS_NAME] },
        children: [videoNode, createVideoFallbackHast(sourceUrl)]
      }
    ]
  };
}

/**
 * 给 video 节点的 className 数组追加统一类名（保留原有 class）。
 * @param videoNode 待装饰的 video 节点。
 */
function decorateHastVideoElement(videoNode: HastNode): void {
  /** video 节点上的属性容器。 */
  const properties = videoNode.properties ?? {};
  /** 现有 className，可能是数组、字符串或缺失。 */
  const existingClassName = properties.className;
  /** 规范化后的 className 数组。 */
  const classList: string[] = Array.isArray(existingClassName)
    ? existingClassName.map(String)
    : typeof existingClassName === "string"
      ? [existingClassName]
      : [];

  if (!classList.includes(VIDEO_ELEMENT_CLASS_NAME)) {
    classList.push(VIDEO_ELEMENT_CLASS_NAME);
  }

  properties.className = classList;
  videoNode.properties = properties;
}

/**
 * 读取 video 节点的源 URL，优先使用 src 属性，其次回退到首个 <source> 子节点。
 * @param videoNode video 节点。
 * @returns 源 URL，未找到时返回空串。
 */
function readHastVideoSourceUrl(videoNode: HastNode): string {
  /** video 节点上的属性容器。 */
  const properties = videoNode.properties ?? {};
  if (typeof properties.src === "string") {
    return properties.src;
  }

  if (Array.isArray(videoNode.children)) {
    for (const childNode of videoNode.children) {
      if (
        childNode.type === "element" &&
        childNode.tagName === "source" &&
        typeof childNode.properties?.src === "string"
      ) {
        return childNode.properties.src as string;
      }
    }
  }

  return "";
}

/**
 * 构造视频失败态占位 hast 节点。
 * @param sourceUrl 视频源 URL，用于失败态尾部展示。
 * @returns 失败态占位 hast 节点。
 */
function createVideoFallbackHast(sourceUrl: string): HastNode {
  return {
    type: "element",
    tagName: "span",
    properties: { className: [VIDEO_FALLBACK_CLASS_NAME] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_ICON_CLASS_NAME] },
        children: []
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_TEXT_CLASS_NAME] },
        children: [{ type: "text", value: VIDEO_FALLBACK_DEFAULT_TEXT }]
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_SOURCE_CLASS_NAME] },
        children: [{ type: "text", value: sourceUrl }]
      }
    ]
  };
}

// ─── Page Toolbar ────────────────────────────────────────────────────────────

// 页面宽度预设列表（label 用于按钮徽章，value 为 CSS max-width 值）。
const TOOLBAR_WIDTH_PRESETS: Array<{ label: string; value: string }> = [
  { label: "680", value: "680px" },
  { label: "840", value: "840px" },
  { label: "1080", value: "1080px" },
  { label: "100%", value: "100%" }
];

// 默认内容宽度。
const TOOLBAR_DEFAULT_WIDTH = "840px";

/**
 * 从 localStorage 读取工具栏折叠状态，默认展开。
 * @returns 是否折叠。
 */
function loadToolbarCollapsed(): boolean {
  try {
    return localStorage.getItem(TOOLBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 将工具栏折叠状态写入 localStorage。
 * @param collapsed 是否折叠。
 */
function saveToolbarCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.setItem(TOOLBAR_COLLAPSED_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(TOOLBAR_COLLAPSED_STORAGE_KEY);
    }
  } catch {
    // localStorage 不可用时静默跳过。
  }
}

/**
 * 从 localStorage 读取已保存的内容宽度，不可用时返回默认值。
 * @returns 宽度 CSS 值字符串。
 */
function loadContentWidth(): string {
  try {
    return localStorage.getItem(CONTENT_WIDTH_STORAGE_KEY) ?? TOOLBAR_DEFAULT_WIDTH;
  } catch {
    return TOOLBAR_DEFAULT_WIDTH;
  }
}

/**
 * 将内容宽度写入 localStorage。
 * @param value 宽度 CSS 值字符串。
 */
function saveContentWidth(value: string): void {
  try {
    localStorage.setItem(CONTENT_WIDTH_STORAGE_KEY, value);
  } catch {
    // localStorage 不可用时静默跳过。
  }
}

/**
 * 把内容宽度应用到文档根节点的 CSS 自定义属性。
 * @param ownerDocument 目标 document。
 * @param value 宽度 CSS 值字符串。
 */
function applyContentWidth(ownerDocument: Document, value: string): void {
  ownerDocument.documentElement.style.setProperty("--scribdown-content-width", value);
}

/**
 * 创建一个工具栏按钮。
 * @param ownerDocument 目标 document。
 * @param ariaLabel 可访问名称（同时用作 tooltip）。
 * @param svgContent 按钮内嵌 SVG 字符串。
 * @returns 按钮元素。
 */
function createPageToolbarBtn(
  ownerDocument: Document,
  ariaLabel: string,
  svgContent: string
): HTMLButtonElement {
  const btn = ownerDocument.createElement("button");
  btn.type = "button";
  btn.className = SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME;
  btn.setAttribute("aria-label", ariaLabel);
  btn.innerHTML = svgContent;
  return btn;
}

/**
 * 在指定容器内构造并挂载浮动工具栏，包含：回到顶部、目录、页面宽度切换。
 * 重复调用时先清理 container 内的旧实例，保证每次 hydrate 只有一个工具栏。
 * 浏览器环境检查由对外的 {@link mountToolbar} 完成。
 * @param ownerDocument 目标 document。
 * @param container 工具栏与目录抽屉的物理挂载点，同时作为目录采集作用域。
 */
function mountPageToolbar(ownerDocument: Document, container: Element): void {
  // 移除 container 作用域内的旧实例，避免重渲染后重复挂载。
  container.querySelector(`:scope > .${SCRIBDOWN_TOOLBAR_CLASS_NAME}`)?.remove();
  container.querySelector(`:scope > .${SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME}`)?.remove();

  const ownerWindow = ownerDocument.defaultView;

  /** 工具栏容器。 */
  const toolbar = ownerDocument.createElement("div");
  toolbar.className = SCRIBDOWN_TOOLBAR_CLASS_NAME;

  // 恢复上次折叠状态。
  const isCollapsed = loadToolbarCollapsed();
  if (isCollapsed) {
    toolbar.classList.add("is-collapsed");
  }

  // ── 折叠/展开切换按钮（始终可见）──
  const toggleBtn = createPageToolbarBtn(
    ownerDocument,
    isCollapsed ? "展开工具栏" : "折叠工具栏",
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M9 4v10M4 9l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
  );
  toggleBtn.classList.add(`${SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME}--toggle`);
  toggleBtn.addEventListener("click", () => {
    const collapsed = toolbar.classList.toggle("is-collapsed");
    toggleBtn.setAttribute("aria-label", collapsed ? "展开工具栏" : "折叠工具栏");
    saveToolbarCollapsed(collapsed);
    if (collapsed) {
      tocPanel.classList.remove("is-open");
    }
  });

  // ── 回到顶部按钮 ──
  const backTopBtn = createPageToolbarBtn(
    ownerDocument,
    "回到顶部",
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M9 14V5M9 5L5 9M9 5l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<line x1="4" y1="3.5" x2="14" y2="3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      "</svg>"
  );
  backTopBtn.addEventListener("click", () => {
    ownerWindow?.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── 目录面板 ──
  /** 目录浮动面板。 */
  const tocPanel = ownerDocument.createElement("div");
  tocPanel.className = SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME;

  const tocTitle = ownerDocument.createElement("div");
  tocTitle.className = "scribdown-toolbar-toc-panel-title";

  /** 标题文本节点。 */
  const tocTitleText = ownerDocument.createElement("span");
  tocTitleText.textContent = "目录";
  tocTitle.appendChild(tocTitleText);

  /** 抽屉关闭按钮（右上角 ×）。 */
  const tocCloseBtn = ownerDocument.createElement("button");
  tocCloseBtn.type = "button";
  tocCloseBtn.className = "scribdown-toolbar-toc-panel-close";
  tocCloseBtn.setAttribute("aria-label", "关闭目录");
  tocCloseBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>";
  tocCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tocPanel.classList.remove("is-open");
  });
  tocTitle.appendChild(tocCloseBtn);

  tocPanel.appendChild(tocTitle);

  // 关键步骤：与 inline [TOC] 共用层级数据 + DOM 结构，确保两处目录的层级渲染逻辑一致。
  const tocHeadings = collectTocHeadingsFromDom(container);
  if (tocHeadings.length === 0) {
    const emptyElement = ownerDocument.createElement("p");
    emptyElement.className = "scribdown-toolbar-toc-panel-empty";
    emptyElement.textContent = "暂无标题";
    tocPanel.appendChild(emptyElement);
  } else {
    const tocTree = createTocTree(tocHeadings);
    const tocNavElement = createTocNavElement(ownerDocument, tocTree, {
      onLinkClick: () => {
        tocPanel.classList.remove("is-open");
      }
    });
    tocPanel.appendChild(tocNavElement);
  }

  /** 目录切换按钮。 */
  const tocBtn = createPageToolbarBtn(
    ownerDocument,
    "目录",
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<line x1="3" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '<line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '<line x1="3" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      "</svg>"
  );
  tocBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tocPanel.classList.toggle("is-open");
  });

  // 点击面板外部时收起目录。
  ownerDocument.addEventListener("click", (e) => {
    if (!tocPanel.contains(e.target as Node) && e.target !== tocBtn) {
      tocPanel.classList.remove("is-open");
    }
  });

  // ── 宽度切换按钮 ──
  let currentWidth = loadContentWidth();
  let widthIndex = TOOLBAR_WIDTH_PRESETS.findIndex((p) => p.value === currentWidth);
  if (widthIndex === -1) widthIndex = 1;

  const widthBtn = createPageToolbarBtn(ownerDocument, "切换页面宽度", "");
  widthBtn.dataset.widthLabel = TOOLBAR_WIDTH_PRESETS[widthIndex].label;

  widthBtn.addEventListener("click", () => {
    widthIndex = (widthIndex + 1) % TOOLBAR_WIDTH_PRESETS.length;
    const preset = TOOLBAR_WIDTH_PRESETS[widthIndex];
    widthBtn.dataset.widthLabel = preset.label;
    widthBtn.setAttribute("aria-label", `宽度：${preset.label}`);
    applyContentWidth(ownerDocument, preset.value);
    saveContentWidth(preset.value);
  });

  toolbar.appendChild(toggleBtn);
  toolbar.appendChild(backTopBtn);
  toolbar.appendChild(tocBtn);
  toolbar.appendChild(widthBtn);

  // 关键步骤：工具栏与目录抽屉挂载到调用方指定的 container，便于跟随 container 一起卸载。
  container.appendChild(toolbar);
  container.appendChild(tocPanel);
}
