import DOMPurify from "dompurify";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighter } from "shiki";
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
const IMAGE_VIEWER_HINT_TEXT = "快捷键：+/= 放大 · - 缩小 · 0 重置 · Esc 关闭 · 鼠标拖拽可平移 · Ctrl/⌘ + 滚轮缩放";

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

  if (!options.sanitizeHtml) {
    return renderedHtml;
  }

  if (options.sanitize) {
    return options.sanitize(renderedHtml);
  }

  return sanitizeHtmlWithDomPurify(renderedHtml);
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
  const targetImageClientLeft = focalPoint.anchorClientX - focalPoint.normalizedX * postImageRect.width;
  const targetImageClientTop = focalPoint.anchorClientY - focalPoint.normalizedY * postImageRect.height;

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
