/**
 * Mermaid 图表 hydration：把 mermaid 代码块替换为图表 figure 结构，
 * 按需加载 mermaid 主包并在 live DOM 阶段触发异步渲染，失败时展示 fallback。
 */

import {
  MERMAID_BODY_CLASS_NAME,
  MERMAID_CANVAS_CLASS_NAME,
  MERMAID_CHROME_CLASS_NAME,
  MERMAID_CONTROL_BUTTON_CLASS_NAME,
  MERMAID_CONTROLS_CLASS_NAME,
  MERMAID_DRAGGING_CLASS_NAME,
  MERMAID_DRAG_MODE_CLASS_NAME,
  MERMAID_FALLBACK_CLASS_NAME,
  MERMAID_FALLBACK_ICON_CLASS_NAME,
  MERMAID_FALLBACK_SOURCE_CLASS_NAME,
  MERMAID_FALLBACK_TEXT_CLASS_NAME,
  MERMAID_FIGURE_CLASS_NAME,
  MERMAID_FIGURE_FAILED_CLASS_NAME,
  MERMAID_FIGURE_LOADED_CLASS_NAME,
  MERMAID_FIGURE_LOADING_CLASS_NAME,
  MERMAID_FULLSCREEN_BUTTON_CLASS_NAME,
  MERMAID_LABEL_CLASS_NAME,
  MERMAID_ZOOM_GROUP_CLASS_NAME,
  MERMAID_ZOOM_VALUE_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE,
  VIEWER_CONTROL_BUTTON_CLASS_NAME,
  t
} from "@scribdown/shared";

import { CODE_BLOCK_HYDRATED_DATA_KEY } from "./code-block-chrome";
import { copyMarkdownTextWithFeedback, createMarkdownCopyButton } from "../core/copy-control";
import {
  createMarkdownViewerControlButton,
  createMarkdownViewerZoomControls,
  VIEWER_DRAG_MODE_ICON_SVG,
  VIEWER_RESET_ZOOM_ICON_SVG,
  VIEWER_SELECT_MODE_ICON_SVG
} from "../core/viewer-controls";
import {
  VIEWER_DEFAULT_ZOOM,
  VIEWER_FIT_RATIO,
  getMarkdownViewerAnchoredScrollOffset,
  getMarkdownViewerWheelZoom,
  getMarkdownViewerZoomStep,
  readMarkdownViewerViewportSize,
  shouldZoomMarkdownViewerWheel,
  shouldSkipMarkdownViewerAnchoredZoom,
  type MarkdownViewerFocalPoint,
  type MarkdownViewerZoomAnchor
} from "../core/viewer-shared";
import {
  MERMAID_LABEL_TEXT,
  openMarkdownMermaidViewer,
  readSvgNaturalDimensions
} from "./mermaid-viewer";
import {
  clampMarkdownMermaidZoom,
  getMarkdownMermaidZoomBounds,
  readMarkdownMermaidTextHeights,
  MERMAID_FIT_VIEW_ZOOM,
  type MarkdownMermaidZoomBounds
} from "./mermaid-zoom-geometry";
import { createMarkdownMermaidThemeVariables } from "./mermaid-theme";

// Mermaid 代码块的语言标识，对应 fixture 中的 ```mermaid。
const MERMAID_LANGUAGE_ID = "mermaid";

// Mermaid 已 hydrate 标记的 dataset 键（仅表示结构已构建）。
const MERMAID_HYDRATED_DATA_KEY = "scribdownMermaidHydrated";

// Mermaid 渲染已启动标记，避免在 live DOM 重复触发 mermaid.render。
const MERMAID_RENDER_STARTED_DATA_KEY = "scribdownMermaidRenderStarted";

// Mermaid 源码寄存在 figure 上的 dataset 键，供延后的 live-DOM 渲染读取。
const MERMAID_SOURCE_DATA_KEY = "scribdownMermaidSourceText";

// Mermaid SVG 节点宿主元素 id 前缀，确保多图表 id 唯一。
const MERMAID_RENDER_ID_PREFIX = "scribdown-mermaid-";

// Mermaid 渲染顺序计数器，配合前缀生成全局唯一 id。
let mermaidRenderIdCounter = 0;

// 是否允许 mermaid 在 figure 右下角悬浮显示全屏按钮（仅 loaded 态显示）。
const MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY = "scribdownMermaidFullscreenReady";

// Mermaid 全屏查看器存放原始 SVG 字符串的 dataset 键。
const MERMAID_VIEWER_SOURCE_DATA_KEY = "scribdownMermaidSource";

// Mermaid 非全屏画布横纵 padding 总和，与 mermaid.css 的 24px * 2 对齐。
const MERMAID_BODY_PADDING_TOTAL_PX = 48;

// Mermaid 工具按钮动作 dataset 键。
const MERMAID_CONTROL_ACTION_DATA_KEY = "scribdownMermaidAction";

// Mermaid 工具按钮动作值，供结构创建与 live DOM 状态恢复统一引用。
const MERMAID_CONTROL_ACTION = {
  mode: "mode",
  zoomOut: "zoom-out",
  zoomIn: "zoom-in",
  reset: "reset",
  copy: "copy",
  fullscreen: "fullscreen"
} as const;

// Mermaid 非全屏运行时状态映射。
const mermaidInlineStateByFigureElement = new WeakMap<HTMLElement, MarkdownMermaidInlineState>();

/**
 * Mermaid 渲染句柄缓存：仅在浏览器环境（含 VS Code webview）下加载，
 * 避免在 Node 单元测试环境触发 mermaid 依赖加载。
 */
let mermaidLoaderPromise: Promise<MermaidApi | undefined> | undefined;

// Mermaid 配置与渲染共用全局状态；串行队列避免多个图表并发时互相覆盖主题。
let mermaidRenderQueuePromise: Promise<void> = Promise.resolve();

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
 * Mermaid 非全屏图表运行时状态。
 */
interface MarkdownMermaidInlineState {
  /** 外层 figure。 */
  figureElement: HTMLElement;
  /** 可滚动正文视口。 */
  bodyElement: HTMLElement;
  /** SVG 挂载画布。 */
  canvasElement: HTMLElement;
  /** 选择 / 拖拽模式按钮。 */
  modeButtonElement: HTMLButtonElement;
  /** 缩小按钮。 */
  zoomOutButtonElement: HTMLButtonElement;
  /** 缩放百分比。 */
  zoomValueElement: HTMLElement;
  /** 放大按钮。 */
  zoomInButtonElement: HTMLButtonElement;
  /** 重置按钮。 */
  resetButtonElement: HTMLButtonElement;
  /** 全屏按钮。 */
  fullscreenButtonElement: HTMLButtonElement;
  /** SVG 固有宽度。 */
  naturalWidth: number;
  /** SVG 固有高度。 */
  naturalHeight: number;
  /** 当前缩放倍数。 */
  zoomValue: number;
  /** 当前图表根据内容计算出的缩放边界。 */
  zoomBounds: MarkdownMermaidZoomBounds;
  /** 当前是否为拖拽模式。 */
  isDragMode: boolean;
  /** 当前是否正在拖拽。 */
  isDragging: boolean;
  /** 拖拽起点客户端 X 坐标。 */
  dragStartClientX: number;
  /** 拖拽起点客户端 Y 坐标。 */
  dragStartClientY: number;
  /** 拖拽起点横向滚动量。 */
  dragStartScrollLeft: number;
  /** 拖拽起点纵向滚动量。 */
  dragStartScrollTop: number;
  /** 响应式尺寸观察器。 */
  resizeObserver?: ResizeObserver;
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
    const canvasElement = figureElement.querySelector<HTMLElement>(`.${MERMAID_CANVAS_CLASS_NAME}`);
    const mermaidSource = figureElement.dataset[MERMAID_SOURCE_DATA_KEY] ?? "";

    if (!canvasElement || mermaidSource.length === 0) {
      return;
    }

    // 关键步骤：detached figure 被宿主合并进 live DOM 后，重新建立状态与事件绑定。
    ensureMarkdownMermaidInlineState(figureElement);
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

  // 右上角工具组。
  const controlsElement = ownerDocument.createElement("div");
  controlsElement.className = MERMAID_CONTROLS_CLASS_NAME;

  // 选择 / 拖拽模式切换按钮。
  const modeButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.switchToDrag"),
    VIEWER_SELECT_MODE_ICON_SVG,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME]
  );
  modeButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.mode;
  modeButtonElement.setAttribute("aria-pressed", "false");
  modeButtonElement.disabled = true;
  modeButtonElement.addEventListener("click", handleMarkdownMermaidModeClick);

  // 缩放按钮组及子节点。
  const {
    groupElement: zoomGroupElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement
  } = createMarkdownViewerZoomControls(
    ownerDocument,
    {
      group: t("mermaid.zoomControls"),
      zoomOut: t("mermaid.zoomOut"),
      zoomIn: t("mermaid.zoomIn")
    },
    [MERMAID_ZOOM_GROUP_CLASS_NAME],
    [MERMAID_CONTROL_BUTTON_CLASS_NAME],
    [MERMAID_ZOOM_VALUE_CLASS_NAME]
  );
  zoomOutButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.zoomOut;
  zoomOutButtonElement.disabled = true;
  zoomOutButtonElement.addEventListener("click", handleMarkdownMermaidZoomOutClick);

  zoomInButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.zoomIn;
  zoomInButtonElement.disabled = true;
  zoomInButtonElement.addEventListener("click", handleMarkdownMermaidZoomInClick);

  // 重置按钮。
  const resetButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.zoomReset"),
    VIEWER_RESET_ZOOM_ICON_SVG,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME]
  );
  resetButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.reset;
  resetButtonElement.disabled = true;
  resetButtonElement.addEventListener("click", handleMarkdownMermaidResetClick);

  // Mermaid 源码复制按钮。
  const copyButtonElement = createMarkdownCopyButton(ownerDocument);
  copyButtonElement.classList.add(
    VIEWER_CONTROL_BUTTON_CLASS_NAME,
    MERMAID_CONTROL_BUTTON_CLASS_NAME
  );
  copyButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.copy;
  copyButtonElement.addEventListener("click", handleMarkdownMermaidCopyClick);

  // 正文容器，承载 SVG 画布与失败态。
  const bodyElement = ownerDocument.createElement("div");
  bodyElement.className = MERMAID_BODY_CLASS_NAME;

  // 用于挂载 SVG 的画布节点。
  const canvasElement = ownerDocument.createElement("div");
  canvasElement.className = MERMAID_CANVAS_CLASS_NAME;
  canvasElement.setAttribute("role", "img");
  canvasElement.setAttribute("aria-label", MERMAID_LABEL_TEXT);

  // 全屏按钮，渲染成功后再启用。
  const fullscreenButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.fullscreenButton"),
    MERMAID_FULLSCREEN_ICON_SVG,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME, MERMAID_FULLSCREEN_BUTTON_CLASS_NAME]
  );
  fullscreenButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] =
    MERMAID_CONTROL_ACTION.fullscreen;
  // 渲染过程中先禁用，避免点击空白图表。
  fullscreenButtonElement.disabled = true;
  fullscreenButtonElement.addEventListener("click", handleMermaidFullscreenButtonClick);

  controlsElement.append(
    modeButtonElement,
    zoomGroupElement,
    resetButtonElement,
    copyButtonElement,
    fullscreenButtonElement
  );
  chromeElement.append(labelElement, controlsElement);
  bodyElement.append(canvasElement);
  figureElement.append(chromeElement, bodyElement);

  // 非全屏交互状态，渲染成功后补充 SVG 固有尺寸并启用按钮。
  const inlineState: MarkdownMermaidInlineState = {
    figureElement,
    bodyElement,
    canvasElement,
    modeButtonElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    fullscreenButtonElement,
    naturalWidth: 720,
    naturalHeight: 480,
    zoomValue: VIEWER_DEFAULT_ZOOM,
    zoomBounds: {
      min: MERMAID_FIT_VIEW_ZOOM,
      max: MERMAID_FIT_VIEW_ZOOM
    },
    isDragMode: false,
    isDragging: false,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartScrollLeft: 0,
    dragStartScrollTop: 0
  };
  mermaidInlineStateByFigureElement.set(figureElement, inlineState);
  bodyElement.addEventListener("wheel", handleMarkdownMermaidWheel, { passive: false });
  bodyElement.addEventListener("pointerdown", handleMarkdownMermaidPointerDown);
  bodyElement.addEventListener("pointermove", handleMarkdownMermaidPointerMove);
  bodyElement.addEventListener("pointerup", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("pointercancel", handleMarkdownMermaidPointerUp);

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
 * 加载 mermaid 实例，浏览器环境外返回 undefined。
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
      return mermaidModule.default;
    })().catch((loadError: unknown) => {
      // 加载失败后重置 promise，给下次渲染重试机会。
      mermaidLoaderPromise = undefined;
      throw loadError;
    });
  }

  return mermaidLoaderPromise;
}

/**
 * 使用图表当前 CSS token 配置 Mermaid，并在全局队列中完成一次渲染。
 * @param mermaidApi Mermaid API 句柄。
 * @param figureElement 当前图表外层元素。
 * @param renderId SVG 唯一 id。
 * @param mermaidSource Mermaid 源码文本。
 * @returns Mermaid SVG 与事件绑定函数。
 */
async function renderMermaidWithProjectTheme(
  mermaidApi: MermaidApi,
  figureElement: HTMLElement,
  renderId: string,
  mermaidSource: string
): Promise<{ svg: string; bindFunctions?: (element: Element) => void }> {
  // 当前渲染任务会等待前一个任务收尾，再原子地完成配置与渲染。
  const renderResultPromise = mermaidRenderQueuePromise
    .catch(() => undefined)
    .then(async () => {
      // startOnLoad=false 由 hydrate 控制时机；strict 阻断脚本注入。
      // base 主题允许以当前元素解析出的 Scribdown CSS token 覆盖配色。
      mermaidApi.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: createMarkdownMermaidThemeVariables(figureElement),
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
      // useMaxWidth=false 让 SVG 保留固有尺寸，把缩放统一交给画布运行时。
      return mermaidApi.render(renderId, mermaidSource);
    });

  // 队列本身只记录完成状态，失败由当前调用方处理且不会阻断后续图表。
  mermaidRenderQueuePromise = renderResultPromise.then(
    () => undefined,
    () => undefined
  );
  return renderResultPromise;
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
    const { svg, bindFunctions } = await renderMermaidWithProjectTheme(
      mermaidApi,
      figureElement,
      renderId,
      mermaidSource
    );

    canvasElement.innerHTML = svg;
    bindFunctions?.(canvasElement);
    figureElement.classList.remove(MERMAID_FIGURE_LOADING_CLASS_NAME);
    figureElement.classList.add(MERMAID_FIGURE_LOADED_CLASS_NAME);

    // 关键步骤：记录原始 SVG 文本，全屏查看器以同样的源码注入，避免引用同一 DOM。
    figureElement.dataset[MERMAID_VIEWER_SOURCE_DATA_KEY] = svg;
    figureElement.dataset[MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY] = "true";

    // 关键步骤：解析 SVG 尺寸并启用非全屏缩放、拖拽与全屏控件。
    const inlineState = ensureMarkdownMermaidInlineState(figureElement);
    if (inlineState) {
      const svgDimensions = readSvgNaturalDimensions(canvasElement);
      inlineState.naturalWidth = svgDimensions.width;
      inlineState.naturalHeight = svgDimensions.height;
      inlineState.modeButtonElement.disabled = false;
      inlineState.fullscreenButtonElement.disabled = false;
      refreshMarkdownMermaidInlineZoomBounds(inlineState);
      updateMarkdownMermaidInlineZoom(inlineState, VIEWER_DEFAULT_ZOOM);
      observeMarkdownMermaidInlineSize(inlineState);
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

  // 失败态：移除选择 / 拖拽模式按钮，未生成画布时模式切换没有意义。
  const modeButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.mode
  );
  modeButtonElement?.remove();

  // 失败态：移除缩放按钮组，避免对未生成的图表提供无效操作。
  const zoomGroupElement = figureElement.querySelector<HTMLElement>(
    `.${MERMAID_ZOOM_GROUP_CLASS_NAME}`
  );
  zoomGroupElement?.remove();

  // 失败态：移除重置按钮，缩放组不存在时重置操作同样没有意义。
  const resetButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.reset
  );
  resetButtonElement?.remove();

  // 失败态：移除全屏按钮，避免对无图表的容器开启查看器。
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
  textElement.textContent = t("mermaid.renderFailed");
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
 * 确保 Mermaid figure 在当前 live DOM 中具有运行时状态与事件绑定。
 * 宿主可能通过 morphdom 把 detached 结构合并进 live DOM，因此不能只依赖创建结构时的 WeakMap。
 * @param figureElement Mermaid 外层 figure。
 * @returns 已恢复的交互状态；结构不完整时返回 undefined。
 */
function ensureMarkdownMermaidInlineState(
  figureElement: HTMLElement
): MarkdownMermaidInlineState | undefined {
  // 已存在的状态。
  const existingState = mermaidInlineStateByFigureElement.get(figureElement);
  if (existingState) {
    return existingState;
  }

  // Mermaid 正文视口。
  const bodyElement = figureElement.querySelector<HTMLElement>(`.${MERMAID_BODY_CLASS_NAME}`);
  // SVG 画布。
  const canvasElement = figureElement.querySelector<HTMLElement>(`.${MERMAID_CANVAS_CLASS_NAME}`);
  // 模式按钮。
  const modeButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.mode
  );
  // 缩小按钮。
  const zoomOutButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.zoomOut
  );
  // 放大按钮。
  const zoomInButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.zoomIn
  );
  // 重置按钮。
  const resetButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.reset
  );
  // 复制按钮。
  const copyButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.copy
  );
  // 全屏按钮。
  const fullscreenButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.fullscreen
  );
  // 缩放百分比。
  const zoomValueElement = figureElement.querySelector<HTMLElement>(
    `.${MERMAID_ZOOM_VALUE_CLASS_NAME}`
  );

  if (
    !bodyElement ||
    !canvasElement ||
    !modeButtonElement ||
    !zoomOutButtonElement ||
    !zoomValueElement ||
    !zoomInButtonElement ||
    !resetButtonElement ||
    !copyButtonElement ||
    !fullscreenButtonElement
  ) {
    return undefined;
  }

  // 从当前 DOM 恢复的非全屏交互状态。
  const restoredState: MarkdownMermaidInlineState = {
    figureElement,
    bodyElement,
    canvasElement,
    modeButtonElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    fullscreenButtonElement,
    naturalWidth: 720,
    naturalHeight: 480,
    zoomValue: VIEWER_DEFAULT_ZOOM,
    zoomBounds: {
      min: MERMAID_FIT_VIEW_ZOOM,
      max: MERMAID_FIT_VIEW_ZOOM
    },
    isDragMode: figureElement.classList.contains(MERMAID_DRAG_MODE_CLASS_NAME),
    isDragging: false,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartScrollLeft: 0,
    dragStartScrollTop: 0
  };

  mermaidInlineStateByFigureElement.set(figureElement, restoredState);
  bodyElement.addEventListener("wheel", handleMarkdownMermaidWheel, { passive: false });
  bodyElement.addEventListener("pointerdown", handleMarkdownMermaidPointerDown);
  bodyElement.addEventListener("pointermove", handleMarkdownMermaidPointerMove);
  bodyElement.addEventListener("pointerup", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("pointercancel", handleMarkdownMermaidPointerUp);
  modeButtonElement.addEventListener("click", handleMarkdownMermaidModeClick);
  zoomOutButtonElement.addEventListener("click", handleMarkdownMermaidZoomOutClick);
  zoomInButtonElement.addEventListener("click", handleMarkdownMermaidZoomInClick);
  resetButtonElement.addEventListener("click", handleMarkdownMermaidResetClick);
  copyButtonElement.addEventListener("click", handleMarkdownMermaidCopyClick);
  fullscreenButtonElement.addEventListener("click", handleMermaidFullscreenButtonClick);
  return restoredState;
}

/**
 * 按动作值查询 Mermaid 工具按钮。
 * @param figureElement Mermaid 外层 figure。
 * @param actionValue 工具动作值。
 * @returns 对应按钮。
 */
function queryMarkdownMermaidActionButton(
  figureElement: HTMLElement,
  actionValue: (typeof MERMAID_CONTROL_ACTION)[keyof typeof MERMAID_CONTROL_ACTION]
): HTMLButtonElement | null {
  return figureElement.querySelector<HTMLButtonElement>(
    `[data-${toKebabCaseDataKey(MERMAID_CONTROL_ACTION_DATA_KEY)}="${actionValue}"]`
  );
}

/**
 * 把 dataset camelCase 键转换为 data-* 属性中的 kebab-case。
 * @param dataKey dataset 键。
 * @returns data 属性键。
 */
function toKebabCaseDataKey(dataKey: string): string {
  return dataKey.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * 从交互事件找到 Mermaid 非全屏状态。
 * @param event Mermaid 工具按钮或画布事件。
 * @returns 所属图表状态。
 */
function getMarkdownMermaidInlineStateFromEvent(
  event: Event
): MarkdownMermaidInlineState | undefined {
  // 事件目标元素。
  const targetElement = event.target as Element | null;
  // 所属 Mermaid figure。
  const figureElement =
    targetElement?.closest<HTMLElement>(`.${MERMAID_FIGURE_CLASS_NAME}`) ?? null;
  if (!figureElement) {
    return undefined;
  }
  return mermaidInlineStateByFigureElement.get(figureElement);
}

/**
 * 切换 Mermaid 非全屏选择 / 拖拽模式。
 * @param event 模式按钮点击事件。
 */
function handleMarkdownMermaidModeClick(event: MouseEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }

  inlineState.isDragMode = !inlineState.isDragMode;
  inlineState.figureElement.classList.toggle(MERMAID_DRAG_MODE_CLASS_NAME, inlineState.isDragMode);
  inlineState.modeButtonElement.innerHTML = inlineState.isDragMode
    ? VIEWER_DRAG_MODE_ICON_SVG
    : VIEWER_SELECT_MODE_ICON_SVG;
  inlineState.modeButtonElement.setAttribute(
    "aria-pressed",
    inlineState.isDragMode ? "true" : "false"
  );
  // aria-label 描述点击后将执行的动作，而图标与 aria-pressed 表达当前模式。
  const modeActionLabel = inlineState.isDragMode
    ? t("mermaid.switchToSelect")
    : t("mermaid.switchToDrag");
  inlineState.modeButtonElement.setAttribute("aria-label", modeActionLabel);
  inlineState.modeButtonElement.setAttribute("title", modeActionLabel);
}

/**
 * 处理 Mermaid 非全屏缩小。
 * @param event 缩小按钮点击事件。
 */
function handleMarkdownMermaidZoomOutClick(event: MouseEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }
  updateMarkdownMermaidInlineZoom(
    inlineState,
    inlineState.zoomValue - getMarkdownViewerZoomStep(inlineState.zoomValue)
  );
}

/**
 * 处理 Mermaid 非全屏放大。
 * @param event 放大按钮点击事件。
 */
function handleMarkdownMermaidZoomInClick(event: MouseEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }
  updateMarkdownMermaidInlineZoom(
    inlineState,
    inlineState.zoomValue + getMarkdownViewerZoomStep(inlineState.zoomValue)
  );
}

/**
 * 处理 Mermaid 非全屏重置缩放。
 * @param event 重置按钮点击事件。
 */
function handleMarkdownMermaidResetClick(event: MouseEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }
  updateMarkdownMermaidInlineZoom(inlineState, VIEWER_DEFAULT_ZOOM);
}

/**
 * 清除 Mermaid 非全屏画布因缩放锚点与拖拽产生的视口偏移。
 * @param inlineState 当前图表状态。
 */
function resetMarkdownMermaidInlineViewport(inlineState: MarkdownMermaidInlineState): void {
  // 清理旧版本可能遗留在 live DOM 中的画布位移。
  inlineState.canvasElement.style.removeProperty("transform");
  inlineState.bodyElement.scrollLeft = 0;
  inlineState.bodyElement.scrollTop = 0;
}

/**
 * 处理 Mermaid 源码复制。
 * @param event 复制按钮点击事件。
 */
function handleMarkdownMermaidCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }
  // 图表源码由 decorate 阶段寄存在 figure dataset。
  const mermaidSource = inlineState.figureElement.dataset[MERMAID_SOURCE_DATA_KEY] ?? "";
  void copyMarkdownTextWithFeedback(copyButtonElement, mermaidSource);
}

/**
 * 处理非全屏 Mermaid 滚轮缩放；拖拽模式始终接管滚轮，选择模式仅响应缩放修饰键。
 * @param event 图表正文滚轮事件。
 */
function handleMarkdownMermaidWheel(event: WheelEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState) {
    return;
  }
  // 是否由当前交互模式或明确的缩放修饰键接管滚轮。
  const shouldZoom = shouldZoomMarkdownViewerWheel({
    isDragMode: inlineState.isDragMode,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey
  });
  if (!shouldZoom) {
    return;
  }
  // 当前滚轮事件对应的目标倍率。
  const nextZoom = getMarkdownViewerWheelZoom(inlineState.zoomValue, event.deltaY);
  // 应用当前图表边界后的目标倍率。
  const normalizedNextZoom = clampMarkdownMermaidZoom(nextZoom, inlineState.zoomBounds);
  // 关键步骤：拖拽模式的滚轮由图表完整接管，到达倍率边界后也不滚动外层页面。
  event.preventDefault();
  event.stopPropagation();
  if (normalizedNextZoom === inlineState.zoomValue) {
    return;
  }
  updateMarkdownMermaidInlineZoom(inlineState, normalizedNextZoom, {
    x: event.clientX,
    y: event.clientY
  });
}

/**
 * 拖拽模式下开始平移非全屏 Mermaid。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState?.isDragMode) {
    return;
  }
  // 当前滚动视口。
  const bodyElement = event.currentTarget as HTMLElement;
  // 横向是否可滚动。
  const canScrollHorizontally = bodyElement.scrollWidth > bodyElement.clientWidth;
  // 纵向是否可滚动。
  const canScrollVertically = bodyElement.scrollHeight > bodyElement.clientHeight;
  if (!canScrollHorizontally && !canScrollVertically) {
    return;
  }

  inlineState.isDragging = true;
  inlineState.dragStartClientX = event.clientX;
  inlineState.dragStartClientY = event.clientY;
  inlineState.dragStartScrollLeft = bodyElement.scrollLeft;
  inlineState.dragStartScrollTop = bodyElement.scrollTop;
  inlineState.figureElement.classList.add(MERMAID_DRAGGING_CLASS_NAME);
  if (typeof bodyElement.setPointerCapture === "function") {
    bodyElement.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

/**
 * 拖拽模式下更新非全屏 Mermaid 平移量。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerMove(event: PointerEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState?.isDragging) {
    return;
  }
  // 当前滚动视口。
  const bodyElement = event.currentTarget as HTMLElement;
  // 横向拖拽位移。
  const deltaX = event.clientX - inlineState.dragStartClientX;
  // 纵向拖拽位移。
  const deltaY = event.clientY - inlineState.dragStartClientY;
  bodyElement.scrollLeft = inlineState.dragStartScrollLeft - deltaX;
  bodyElement.scrollTop = inlineState.dragStartScrollTop - deltaY;
}

/**
 * 结束非全屏 Mermaid 拖拽。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerUp(event: PointerEvent): void {
  // 当前图表状态。
  const inlineState = getMarkdownMermaidInlineStateFromEvent(event);
  if (!inlineState?.isDragging) {
    return;
  }
  // 当前滚动视口。
  const bodyElement = event.currentTarget as HTMLElement;
  inlineState.isDragging = false;
  inlineState.figureElement.classList.remove(MERMAID_DRAGGING_CLASS_NAME);
  if (
    typeof bodyElement.releasePointerCapture === "function" &&
    bodyElement.hasPointerCapture(event.pointerId)
  ) {
    bodyElement.releasePointerCapture(event.pointerId);
  }
}

/**
 * 更新 Mermaid 非全屏缩放比例与画布尺寸。
 * @param inlineState 当前图表状态。
 * @param nextZoom 目标缩放倍数。
 * @param zoomAnchor 可选缩放焦点。
 */
function updateMarkdownMermaidInlineZoom(
  inlineState: MarkdownMermaidInlineState,
  nextZoom: number,
  zoomAnchor?: MarkdownViewerZoomAnchor
): void {
  // 归一化缩放倍数。
  const normalizedZoom = clampMarkdownMermaidZoom(nextZoom, inlineState.zoomBounds);
  // 回到默认倍率必须恢复规范视图，不能保留锚点补偿的画布位移或滚动量。
  if (normalizedZoom === VIEWER_DEFAULT_ZOOM) {
    inlineState.zoomValue = VIEWER_DEFAULT_ZOOM;
    inlineState.zoomValueElement.textContent = `${Math.round(VIEWER_DEFAULT_ZOOM * 100)}%`;
    inlineState.zoomOutButtonElement.disabled = VIEWER_DEFAULT_ZOOM <= inlineState.zoomBounds.min;
    inlineState.zoomInButtonElement.disabled = VIEWER_DEFAULT_ZOOM >= inlineState.zoomBounds.max;
    inlineState.resetButtonElement.disabled = true;
    updateMarkdownMermaidInlineCanvasSize(inlineState);
    resetMarkdownMermaidInlineViewport(inlineState);
    return;
  }
  // 已到达缩放边界时不再重复修正焦点，避免滚轮事件的像素舍入让视图持续漂移。
  if (shouldSkipMarkdownViewerAnchoredZoom(inlineState.zoomValue, normalizedZoom, zoomAnchor)) {
    return;
  }
  // 缩放前焦点。
  const focalPoint = captureMarkdownMermaidInlineFocalPoint(inlineState, zoomAnchor);
  inlineState.zoomValue = normalizedZoom;
  inlineState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  inlineState.zoomOutButtonElement.disabled = normalizedZoom <= inlineState.zoomBounds.min;
  inlineState.zoomInButtonElement.disabled = normalizedZoom >= inlineState.zoomBounds.max;
  inlineState.resetButtonElement.disabled = false;
  updateMarkdownMermaidInlineCanvasSize(inlineState);
  if (focalPoint) {
    applyMarkdownMermaidInlineFocalPoint(inlineState, focalPoint);
  }
}

/**
 * 按当前正文视口和图表内容刷新 Mermaid 缩放边界。
 * @param inlineState 当前图表状态。
 */
function refreshMarkdownMermaidInlineZoomBounds(inlineState: MarkdownMermaidInlineState): void {
  // 关键步骤：边界仅在首次渲染或外层尺寸变化时更新，避免滚轮缩放导致上限漂移。
  updateMarkdownMermaidInlineCanvasSize(inlineState);
  inlineState.zoomBounds = readMarkdownMermaidInlineZoomBounds(inlineState);
}

/**
 * 读取 Mermaid 正文图表在当前布局下的内容自适应缩放边界。
 * @param inlineState 当前图表状态。
 * @returns 当前图表对应的缩放边界。
 */
function readMarkdownMermaidInlineZoomBounds(
  inlineState: MarkdownMermaidInlineState
): MarkdownMermaidZoomBounds {
  /** 当前画布内是否存在可缩放的 SVG。 */
  const hasSvg = inlineState.canvasElement.querySelector("svg") !== null;
  if (!hasSvg) {
    return {
      min: MERMAID_FIT_VIEW_ZOOM,
      max: MERMAID_FIT_VIEW_ZOOM
    };
  }

  return getMarkdownMermaidZoomBounds({
    currentZoom: inlineState.zoomValue,
    fitScale: getMarkdownMermaidInlineFitScale(inlineState),
    naturalWidth: inlineState.naturalWidth,
    naturalHeight: inlineState.naturalHeight,
    textHeights: readMarkdownMermaidTextHeights(inlineState.canvasElement)
  });
}

/**
 * 计算 Mermaid 图表固有尺寸完整适配正文视口所需的绝对缩放比例。
 * @param inlineState 当前图表状态。
 * @returns 图表适配正文视口的绝对缩放比例。
 */
function getMarkdownMermaidInlineFitScale(inlineState: MarkdownMermaidInlineState): number {
  /** 不受滚动条显隐影响的正文视口布局尺寸。 */
  const viewportSize = readMarkdownViewerViewportSize(inlineState.bodyElement);
  /** 扣除正文 padding 并预留安全边距后的可用宽度。 */
  const viewportWidth = Math.max(
    (viewportSize.width - MERMAID_BODY_PADDING_TOTAL_PX) * VIEWER_FIT_RATIO,
    1
  );
  /** 扣除正文 padding 并预留安全边距后的可用高度。 */
  const viewportHeight = Math.max(
    (viewportSize.height - MERMAID_BODY_PADDING_TOTAL_PX) * VIEWER_FIT_RATIO,
    1
  );
  /** SVG 固有宽度的安全值。 */
  const naturalWidth = Math.max(inlineState.naturalWidth, 1);
  /** SVG 固有高度的安全值。 */
  const naturalHeight = Math.max(inlineState.naturalHeight, 1);

  return Math.min(1, viewportWidth / naturalWidth, viewportHeight / naturalHeight);
}

/**
 * 记录非全屏缩放前的画布焦点。
 * @param inlineState 当前图表状态。
 * @param zoomAnchor 可选客户端坐标锚点。
 * @returns 画布归一化焦点。
 */
function captureMarkdownMermaidInlineFocalPoint(
  inlineState: MarkdownMermaidInlineState,
  zoomAnchor?: MarkdownViewerZoomAnchor
): MarkdownViewerFocalPoint | undefined {
  // 缩放前画布矩形。
  const canvasRect = inlineState.canvasElement.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return undefined;
  }
  // 正文视口矩形。
  const bodyRect = inlineState.bodyElement.getBoundingClientRect();
  // 客户端 X 锚点。
  const anchorClientX = zoomAnchor?.x ?? bodyRect.left + bodyRect.width / 2;
  // 客户端 Y 锚点。
  const anchorClientY = zoomAnchor?.y ?? bodyRect.top + bodyRect.height / 2;
  // 画布归一化 X。
  const normalizedX = (anchorClientX - canvasRect.left) / canvasRect.width;
  // 画布归一化 Y。
  const normalizedY = (anchorClientY - canvasRect.top) / canvasRect.height;
  return { anchorClientX, anchorClientY, normalizedX, normalizedY };
}

/**
 * 在非全屏缩放后恢复焦点的客户端位置。
 * @param inlineState 当前图表状态。
 * @param focalPoint 缩放前焦点。
 */
function applyMarkdownMermaidInlineFocalPoint(
  inlineState: MarkdownMermaidInlineState,
  focalPoint: MarkdownViewerFocalPoint
): void {
  // 缩放后、滚动校正前的画布矩形。
  const canvasRectBeforeScroll = inlineState.canvasElement.getBoundingClientRect();
  if (canvasRectBeforeScroll.width <= 0 || canvasRectBeforeScroll.height <= 0) {
    return;
  }
  // 关键步骤：基于当前滚动量做增量校正，避免清零视口造成锚点位置逐次漂移。
  inlineState.bodyElement.scrollLeft = getMarkdownViewerAnchoredScrollOffset(
    inlineState.bodyElement.scrollLeft,
    canvasRectBeforeScroll.left,
    focalPoint.anchorClientX,
    focalPoint.normalizedX,
    canvasRectBeforeScroll.width
  );
  inlineState.bodyElement.scrollTop = getMarkdownViewerAnchoredScrollOffset(
    inlineState.bodyElement.scrollTop,
    canvasRectBeforeScroll.top,
    focalPoint.anchorClientY,
    focalPoint.normalizedY,
    canvasRectBeforeScroll.height
  );
  // 浏览器会把超出范围的滚动量钳制到 0 或最大值。某一轴到达边界后允许内容自然偏移，
  // 不再叠加 canvas transform 强行维持鼠标锚点，避免产生不可逆的残留位移。
}

/**
 * 按正文可用区域和缩放比例更新非全屏画布尺寸。
 * @param inlineState 当前图表状态。
 */
function updateMarkdownMermaidInlineCanvasSize(inlineState: MarkdownMermaidInlineState): void {
  // 图表完整适配正文视口时的绝对缩放比例。
  const fitScale = getMarkdownMermaidInlineFitScale(inlineState);
  // SVG 固有宽度。
  const naturalWidth = Math.max(inlineState.naturalWidth, 1);
  // SVG 固有高度。
  const naturalHeight = Math.max(inlineState.naturalHeight, 1);
  // 当前显示宽度。
  const displayWidth = Math.max(1, naturalWidth * fitScale * inlineState.zoomValue);
  // 当前显示高度。
  const displayHeight = Math.max(1, naturalHeight * fitScale * inlineState.zoomValue);
  inlineState.canvasElement.style.width = `${displayWidth}px`;
  inlineState.canvasElement.style.height = `${displayHeight}px`;

  // 内部 SVG 改由 canvas 尺寸统一控制。
  const svgElement = inlineState.canvasElement.querySelector<SVGSVGElement>("svg");
  if (svgElement) {
    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
    svgElement.style.width = "100%";
    svgElement.style.height = "100%";
    svgElement.style.maxWidth = "none";
    svgElement.style.maxHeight = "none";
  }
}

/**
 * 监听非全屏图表容器尺寸变化并重新适配画布。
 * @param inlineState 当前图表状态。
 */
function observeMarkdownMermaidInlineSize(inlineState: MarkdownMermaidInlineState): void {
  if (inlineState.resizeObserver) {
    return;
  }
  // 当前宿主的 ResizeObserver 构造器。
  const ResizeObserverConstructor =
    inlineState.figureElement.ownerDocument.defaultView?.ResizeObserver;
  if (!ResizeObserverConstructor) {
    return;
  }
  inlineState.resizeObserver = new ResizeObserverConstructor(() => {
    refreshMarkdownMermaidInlineZoomBounds(inlineState);
    updateMarkdownMermaidInlineZoom(inlineState, inlineState.zoomValue);
  });
  // 观察外层 figure 的布局变化，避免 body 滚动条显隐自身触发反馈循环。
  inlineState.resizeObserver.observe(inlineState.figureElement);
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

  // Mermaid 原始源码。
  const mermaidSource = figureElement.dataset[MERMAID_SOURCE_DATA_KEY] ?? "";
  event.preventDefault();
  event.stopPropagation();
  openMarkdownMermaidViewer(figureElement.ownerDocument, svgSource, mermaidSource);
}

export { hydrateMermaidBlocks, MERMAID_LANGUAGE_ID };
