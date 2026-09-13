/**
 * Mermaid 图表 hydration：把 mermaid 代码块替换为图表 figure 结构，
 * 按需加载 mermaid 主包并在 live DOM 阶段触发异步渲染，失败时展示 fallback。
 */

import {
  MARKDOWN_SOURCE_DATA_ATTRIBUTE,
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
  MERMAID_LABEL_CLASS_NAME,
  MERMAID_ZOOM_GROUP_CLASS_NAME,
  MERMAID_ZOOM_VALUE_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE,
  VIEWER_CONTROL_BUTTON_CLASS_NAME,
  t
} from "@scribdown/shared";

import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { CODE_BLOCK_HYDRATED_DATA_KEY } from "./code-block-chrome";
import {
  copyMarkdownTextWithFeedback,
  createMarkdownCopyButton,
  readMarkdownSource
} from "../core/copy-control";
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
  clampMarkdownMermaidZoom,
  getMarkdownMermaidZoomBounds,
  readMarkdownMermaidTextHeights,
  MERMAID_FIT_VIEW_ZOOM,
  type MarkdownMermaidZoomBounds
} from "./mermaid-zoom-geometry";
import { createMarkdownMermaidThemeVariables } from "./mermaid-theme";

// 两个场景共用的图表标签。
const MERMAID_LABEL_TEXT = "Mermaid";

// Mermaid 代码块的语言标识，对应 fixture 中的 ```mermaid。
const MERMAID_LANGUAGE_ID = "mermaid";

// Mermaid 渲染已启动标记，避免在 live DOM 重复触发 mermaid.render。
const MERMAID_RENDER_STARTED_DATA_KEY = "scribdownMermaidRenderStarted";

// Mermaid SVG 节点宿主元素 id 前缀，确保多图表 id 唯一。
const MERMAID_RENDER_ID_PREFIX = "scribdown-mermaid-";

// Mermaid 渲染顺序计数器，配合前缀生成全局唯一 id。
let mermaidRenderIdCounter = 0;

// Mermaid 流程图长文案的最大排版宽度，超出后由 Mermaid 参与换行和节点尺寸计算。
const MERMAID_FLOWCHART_WRAPPING_WIDTH_PX = 200;

// Mermaid 工具按钮动作 dataset 键。
const MERMAID_CONTROL_ACTION_DATA_KEY = "scribdownMermaidAction";

// Mermaid 工具按钮动作值，供结构创建与 live DOM 状态恢复统一引用。
const MERMAID_CONTROL_ACTION = {
  mode: "mode",
  zoomOut: "zoom-out",
  zoomIn: "zoom-in",
  reset: "reset",
  copy: "copy",
  scene: "scene"
} as const;

// Mermaid 图表运行时状态映射。
const mermaidRendererStateByFigureElement = new WeakMap<
  HTMLElement,
  MarkdownMermaidRendererState
>();

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

/** 场景参数；图表渲染及交互不区分全屏与正文。 */
export interface MarkdownMermaidRendererOptions {
  /** 场景入口可访问名称。 */
  actionLabel: string;
  /** 场景入口图标。 */
  actionIcon: string;
  /** 场景入口样式。 */
  actionClassNames: string[];
  /** 关闭入口在加载或失败阶段也可用。 */
  actionAvailableWhileLoading?: boolean;
  /**
   * 执行宿主动作。
   * @param svgSource 当前画布 SVG。
   * @param markdownSource 当前 Markdown 原文。
   */
  onAction: (svgSource: string, markdownSource: string) => void;
}

/** 独立图表实例，宿主仅负责挂载与生命周期。 */
export interface MarkdownMermaidRenderer {
  /** 完整图表 DOM。 */
  element: HTMLElement;
  /** 宿主变得可测量后刷新布局。 */
  refresh: () => void;
  /** 断开观察器并移除实例。 */
  destroy: () => void;
}

/**
 * Mermaid 图表运行时状态。
 */
interface MarkdownMermaidRendererState {
  /** 创建当前实例的场景参数。 */
  options: MarkdownMermaidRendererOptions;
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
  sceneButtonElement: HTMLButtonElement;
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
  /** 当前捕获的拖拽指针，供切换模式或销毁时释放。 */
  activePointerId?: number;
  /** 响应式尺寸观察器。 */
  resizeObserver?: ResizeObserver;
}

/**
 * 等待图表宿主文档的字体完成加载，避免 Mermaid 使用回退字体测量后再切换字体导致标签被裁切。
 * @param ownerDocument Mermaid 图表所在文档。
 * @returns 字体加载完成后的 Promise。
 */
async function waitForMarkdownMermaidFonts(ownerDocument: Document): Promise<void> {
  // 部分旧版 Webview 不提供 FontFaceSet；此时保持兼容并直接继续渲染。
  if (!ownerDocument.fonts) {
    return;
  }

  await ownerDocument.fonts.ready;
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
 * @param options 当前展示场景配置。
 */
function hydrateMermaidBlocks(
  rootElement: ParentNode,
  options: MarkdownMermaidRendererOptions
): void {
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

    decorateMermaidBlock(preElement, codeElement, options);
  });

  kickOffPendingMermaidRenders(rootElement, options);
}

/**
 * 从完整 Markdown 中提取 Mermaid 渲染代码。
 * @param markdownSource 含围栏及可选列表、引用上下文的 Markdown 原文。
 * @returns 不含围栏的图表代码；没有 Mermaid 代码块时返回空字符串。
 */
function parseMarkdownMermaidSource(markdownSource: string): string {
  // 使用与主渲染链路相同的解析器处理围栏长度、缩进和嵌套容器。
  const tree = unified().use(remarkParse).parse(markdownSource);
  // 只提取当前源码中的首个 Mermaid 代码块。
  let source: string | undefined;
  visit(tree, "code", (node) => {
    if (source === undefined && node.lang === MERMAID_LANGUAGE_ID) {
      source = node.value;
    }
  });
  return source ?? "";
}

/**
 * 针对 live DOM 中仍处于 loading 态的 mermaid figure 启动 mermaid.render。
 * 未连接到 document 的 figure 直接跳过，等下一次 hydrate（live DOM 阶段）再触发。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 * @param options 当前展示场景配置。
 */
function kickOffPendingMermaidRenders(
  rootElement: ParentNode,
  options: MarkdownMermaidRendererOptions
): void {
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

    // 从当前 DOM 的完整 Markdown 恢复渲染输入，兼容克隆和宿主更新节点。
    const canvasElement = figureElement.querySelector<HTMLElement>(`.${MERMAID_CANVAS_CLASS_NAME}`);
    // 图表代码只在本次渲染调用中持有，不再写入第二个 DOM 属性。
    const mermaidSource = parseMarkdownMermaidSource(readMarkdownSource(figureElement) ?? "");

    if (!canvasElement || mermaidSource.length === 0) {
      return;
    }

    // 关键步骤：detached figure 被宿主合并进 live DOM 后，重新建立状态与事件绑定。
    ensureMarkdownMermaidRendererState(figureElement, options);
    figureElement.dataset[MERMAID_RENDER_STARTED_DATA_KEY] = "true";
    void renderMermaidIntoCanvas(figureElement, canvasElement, mermaidSource);
  });
}

/**
 * 将代码节点替换为统一渲染器实例。
 * @param preElement 原代码块容器。
 * @param codeElement 原代码节点。
 * @param options 当前展示场景参数。
 */
function decorateMermaidBlock(
  preElement: HTMLPreElement,
  codeElement: HTMLElement,
  options: MarkdownMermaidRendererOptions
): void {
  // 未经过原文保留插件的宿主 HTML 使用代码文本补齐围栏。
  const markdownSource =
    readMarkdownSource(codeElement) ??
    `~~~${MERMAID_LANGUAGE_ID}\n${codeElement.textContent ?? ""}\n~~~`;
  // 独立图表实例，detached 阶段只创建 DOM。
  const renderer = createMarkdownMermaidRenderer(preElement.ownerDocument, markdownSource, options);
  // 源码行锚点用于编辑器双向滚动。
  const sourceLine = codeElement.getAttribute(SOURCE_LINE_DATA_ATTRIBUTE);
  if (sourceLine !== null) renderer.element.setAttribute(SOURCE_LINE_DATA_ATTRIBUTE, sourceLine);
  preElement.replaceWith(renderer.element);
}

/**
 * 创建独立的 Mermaid 渲染器；两个场景仅通过参数选择入口和布局。
 * @param ownerDocument 宿主文档。
 * @param markdownSource 完整 Markdown 原文。
 * @param options 场景配置，实例之间不共享交互状态。
 * @param svgSource 可选的已渲染 SVG，避免全屏重复计算图表。
 * @returns 图表实例及布局、销毁接口。
 */
function createMarkdownMermaidRenderer(
  ownerDocument: Document,
  markdownSource: string,
  options: MarkdownMermaidRendererOptions,
  svgSource?: string
): MarkdownMermaidRenderer {
  // 外层 figure 容器，承载顶部标签与图表正文。
  const figureElement = ownerDocument.createElement("figure");
  figureElement.className = `${MERMAID_FIGURE_CLASS_NAME} ${MERMAID_FIGURE_LOADING_CLASS_NAME}`;

  // 顶部 chrome，仅承载 Mermaid 类型标签。
  const chromeElement = ownerDocument.createElement("div");
  chromeElement.className = MERMAID_CHROME_CLASS_NAME;

  // 图表类型标签。
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
  const sceneButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    options.actionLabel,
    options.actionIcon,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME, ...options.actionClassNames]
  );
  sceneButtonElement.dataset[MERMAID_CONTROL_ACTION_DATA_KEY] = MERMAID_CONTROL_ACTION.scene;
  // 渲染过程中先禁用，避免点击空白图表。
  sceneButtonElement.disabled = !options.actionAvailableWhileLoading;
  sceneButtonElement.addEventListener("click", handleMarkdownMermaidSceneActionClick);

  controlsElement.append(
    modeButtonElement,
    zoomGroupElement,
    resetButtonElement,
    copyButtonElement,
    sceneButtonElement
  );
  chromeElement.append(labelElement, controlsElement);
  bodyElement.append(canvasElement);
  figureElement.append(chromeElement, bodyElement);

  // 图表交互状态，渲染成功后补充 SVG 固有尺寸并启用按钮。
  const rendererState: MarkdownMermaidRendererState = {
    options,
    figureElement,
    bodyElement,
    canvasElement,
    modeButtonElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    sceneButtonElement,
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
  mermaidRendererStateByFigureElement.set(figureElement, rendererState);
  bodyElement.addEventListener("wheel", handleMarkdownMermaidWheel, { passive: false });
  bodyElement.addEventListener("pointerdown", handleMarkdownMermaidPointerDown);
  bodyElement.addEventListener("pointermove", handleMarkdownMermaidPointerMove);
  bodyElement.addEventListener("pointerup", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("pointercancel", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("lostpointercapture", handleMarkdownMermaidPointerUp);

  figureElement.setAttribute(MARKDOWN_SOURCE_DATA_ATTRIBUTE, encodeURIComponent(markdownSource));
  figureElement.tabIndex = -1;
  figureElement.addEventListener("keydown", handleMarkdownMermaidKeyDown);
  if (svgSource !== undefined) {
    canvasElement.innerHTML = svgSource;
    completeMarkdownMermaidRender(rendererState);
  }
  return {
    element: figureElement,
    refresh: () => {
      refreshMarkdownMermaidRendererZoomBounds(rendererState);
      updateMarkdownMermaidRendererZoom(rendererState, rendererState.zoomValue);
    },
    destroy: () => {
      stopMarkdownMermaidDrag(rendererState);
      rendererState.resizeObserver?.disconnect();
      mermaidRendererStateByFigureElement.delete(figureElement);
      figureElement.remove();
    }
  };
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
        markdownAutoWrap: true,
        themeVariables: createMarkdownMermaidThemeVariables(figureElement),
        flowchart: {
          useMaxWidth: false,
          wrappingWidth: MERMAID_FLOWCHART_WRAPPING_WIDTH_PX
        },
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
    // 按需取得 Mermaid 渲染 API。
    const mermaidApi = await loadMermaid();
    if (!mermaidApi) {
      // 非浏览器环境：保留 loading 类名但不抛错，避免单测污染。
      return;
    }

    // 关键步骤：Mermaid 会按渲染时的字体计算 foreignObject 与节点尺寸，必须先等最终字体就绪。
    await waitForMarkdownMermaidFonts(figureElement.ownerDocument);

    mermaidRenderIdCounter += 1;
    // 本次渲染使用的唯一标识。
    const renderId = `${MERMAID_RENDER_ID_PREFIX}${mermaidRenderIdCounter}`;
    // 图表生成结果及可选交互绑定。
    const { svg, bindFunctions } = await renderMermaidWithProjectTheme(
      mermaidApi,
      figureElement,
      renderId,
      mermaidSource
    );

    canvasElement.innerHTML = svg;
    bindFunctions?.(canvasElement);
    // 两种场景共用同一套尺寸计算与交互激活。
    const rendererState = ensureMarkdownMermaidRendererState(figureElement);
    if (rendererState) completeMarkdownMermaidRender(rendererState);
  } catch (renderError: unknown) {
    showMermaidFallback(figureElement, canvasElement, mermaidSource, renderError);
  }
}

/**
 * SVG 就绪后启用图表控件并适配画布。
 * @param state 当前独立实例。
 */
function completeMarkdownMermaidRender(state: MarkdownMermaidRendererState): void {
  state.figureElement.classList.remove(MERMAID_FIGURE_LOADING_CLASS_NAME);
  state.figureElement.classList.add(MERMAID_FIGURE_LOADED_CLASS_NAME);
  // 以 SVG 固有尺寸作为缩放基准。
  const dimensions = readSvgNaturalDimensions(state.canvasElement);
  state.naturalWidth = dimensions.width;
  state.naturalHeight = dimensions.height;
  state.modeButtonElement.disabled = false;
  state.sceneButtonElement.disabled = false;
  refreshMarkdownMermaidRendererZoomBounds(state);
  updateMarkdownMermaidRendererZoom(state, VIEWER_DEFAULT_ZOOM);
  observeMarkdownMermaidRendererSize(state);
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
  // 当前图表所属文档。
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

  // 没有图表时移除全屏入口，但保留宿主配置的关闭入口。
  const state = mermaidRendererStateByFigureElement.get(figureElement);
  if (!state?.options.actionAvailableWhileLoading) state?.sceneButtonElement.remove();

  // 失败态：清空 SVG 画布并替换为错误说明 + 源码块。
  canvasElement.replaceChildren();

  // mermaid 抛错时通常会污染 document 末尾的临时 div，需要清理。
  cleanupOrphanMermaidNodes(ownerDocument);

  // 错误占位容器。
  const fallbackElement = ownerDocument.createElement("div");
  fallbackElement.className = MERMAID_FALLBACK_CLASS_NAME;

  // 错误提示图标。
  const iconElement = ownerDocument.createElement("span");
  iconElement.className = MERMAID_FALLBACK_ICON_CLASS_NAME;
  iconElement.setAttribute("aria-hidden", "true");
  fallbackElement.append(iconElement);

  // 错误摘要文字。
  const textElement = ownerDocument.createElement("p");
  textElement.className = MERMAID_FALLBACK_TEXT_CLASS_NAME;
  textElement.textContent = t("mermaid.renderFailed");
  fallbackElement.append(textElement);

  // mermaid 错误对象常带可读 message，附在源码块前给排查使用。
  const errorMessage = extractErrorMessage(renderError);
  if (errorMessage) {
    // 渲染器返回的错误详情。
    const messageElement = ownerDocument.createElement("p");
    messageElement.className = MERMAID_FALLBACK_SOURCE_CLASS_NAME;
    messageElement.textContent = errorMessage;
    fallbackElement.append(messageElement);
  }

  // 源码 pre：失败时把原文展示给用户便于复制修改。
  if (mermaidSource.length > 0) {
    // 失败时展示的图表代码。
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
 * @param options 克隆节点需要宿主重新提供的场景参数。
 * @returns 已恢复的交互状态；结构不完整时返回 undefined。
 */
function ensureMarkdownMermaidRendererState(
  figureElement: HTMLElement,
  options?: MarkdownMermaidRendererOptions
): MarkdownMermaidRendererState | undefined {
  // 已存在的状态。
  const existingState = mermaidRendererStateByFigureElement.get(figureElement);
  if (existingState) {
    return existingState;
  }

  if (!options) return undefined;

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
  const sceneButtonElement = queryMarkdownMermaidActionButton(
    figureElement,
    MERMAID_CONTROL_ACTION.scene
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
    !sceneButtonElement
  ) {
    return undefined;
  }

  // 从当前 DOM 恢复的图表交互状态。
  const restoredState: MarkdownMermaidRendererState = {
    options,
    figureElement,
    bodyElement,
    canvasElement,
    modeButtonElement,
    zoomOutButtonElement,
    zoomValueElement,
    zoomInButtonElement,
    resetButtonElement,
    sceneButtonElement,
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

  mermaidRendererStateByFigureElement.set(figureElement, restoredState);
  figureElement.addEventListener("keydown", handleMarkdownMermaidKeyDown);
  bodyElement.addEventListener("wheel", handleMarkdownMermaidWheel, { passive: false });
  bodyElement.addEventListener("pointerdown", handleMarkdownMermaidPointerDown);
  bodyElement.addEventListener("pointermove", handleMarkdownMermaidPointerMove);
  bodyElement.addEventListener("pointerup", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("pointercancel", handleMarkdownMermaidPointerUp);
  bodyElement.addEventListener("lostpointercapture", handleMarkdownMermaidPointerUp);
  modeButtonElement.addEventListener("click", handleMarkdownMermaidModeClick);
  zoomOutButtonElement.addEventListener("click", handleMarkdownMermaidZoomOutClick);
  zoomInButtonElement.addEventListener("click", handleMarkdownMermaidZoomInClick);
  resetButtonElement.addEventListener("click", handleMarkdownMermaidResetClick);
  copyButtonElement.addEventListener("click", handleMarkdownMermaidCopyClick);
  sceneButtonElement.addEventListener("click", handleMarkdownMermaidSceneActionClick);
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
 * 从交互事件找到 Mermaid 图表状态。
 * @param event Mermaid 工具按钮或画布事件。
 * @returns 所属图表状态。
 */
function getMarkdownMermaidRendererStateFromEvent(
  event: Event
): MarkdownMermaidRendererState | undefined {
  // 事件目标元素。
  const targetElement = event.target as Element | null;
  // 所属 Mermaid figure。
  const figureElement =
    targetElement?.closest<HTMLElement>(`.${MERMAID_FIGURE_CLASS_NAME}`) ?? null;
  if (!figureElement) {
    return undefined;
  }
  return mermaidRendererStateByFigureElement.get(figureElement);
}

/**
 * 切换 Mermaid 图表选择 / 拖拽模式。
 * @param event 模式按钮点击事件。
 */
function handleMarkdownMermaidModeClick(event: MouseEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }

  stopMarkdownMermaidDrag(rendererState);
  rendererState.isDragMode = !rendererState.isDragMode;
  rendererState.figureElement.classList.toggle(
    MERMAID_DRAG_MODE_CLASS_NAME,
    rendererState.isDragMode
  );
  rendererState.modeButtonElement.innerHTML = rendererState.isDragMode
    ? VIEWER_DRAG_MODE_ICON_SVG
    : VIEWER_SELECT_MODE_ICON_SVG;
  rendererState.modeButtonElement.setAttribute(
    "aria-pressed",
    rendererState.isDragMode ? "true" : "false"
  );
  // aria-label 描述点击后将执行的动作，而图标与 aria-pressed 表达当前模式。
  const modeActionLabel = rendererState.isDragMode
    ? t("mermaid.switchToSelect")
    : t("mermaid.switchToDrag");
  rendererState.modeButtonElement.setAttribute("aria-label", modeActionLabel);
  rendererState.modeButtonElement.setAttribute("title", modeActionLabel);
}

/**
 * 处理 Mermaid 图表缩小。
 * @param event 缩小按钮点击事件。
 */
function handleMarkdownMermaidZoomOutClick(event: MouseEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }
  updateMarkdownMermaidRendererZoom(
    rendererState,
    rendererState.zoomValue - getMarkdownViewerZoomStep(rendererState.zoomValue)
  );
}

/**
 * 处理 Mermaid 图表放大。
 * @param event 放大按钮点击事件。
 */
function handleMarkdownMermaidZoomInClick(event: MouseEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }
  updateMarkdownMermaidRendererZoom(
    rendererState,
    rendererState.zoomValue + getMarkdownViewerZoomStep(rendererState.zoomValue)
  );
}

/**
 * 处理 Mermaid 图表重置缩放。
 * @param event 重置按钮点击事件。
 */
function handleMarkdownMermaidResetClick(event: MouseEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }
  updateMarkdownMermaidRendererZoom(rendererState, VIEWER_DEFAULT_ZOOM);
}

/**
 * 清除 Mermaid 图表画布因缩放锚点与拖拽产生的视口偏移。
 * @param rendererState 当前图表状态。
 */
function resetMarkdownMermaidRendererViewport(rendererState: MarkdownMermaidRendererState): void {
  // 清理旧版本可能遗留在 live DOM 中的画布位移。
  rendererState.canvasElement.style.removeProperty("transform");
  rendererState.bodyElement.scrollLeft = 0;
  rendererState.bodyElement.scrollTop = 0;
}

/**
 * 处理 Mermaid 源码复制。
 * @param event 复制按钮点击事件。
 */
function handleMarkdownMermaidCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }
  // 图表源码由 decorate 阶段寄存在 figure dataset。
  const mermaidSource = readMarkdownSource(rendererState.figureElement) ?? "";
  void copyMarkdownTextWithFeedback(copyButtonElement, mermaidSource);
}

/**
 * 处理图表 Mermaid 滚轮缩放；拖拽模式始终接管滚轮，选择模式仅响应缩放修饰键。
 * @param event 图表正文滚轮事件。
 */
function handleMarkdownMermaidWheel(event: WheelEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState) {
    return;
  }
  // 是否由当前交互模式或明确的缩放修饰键接管滚轮。
  const shouldZoom = shouldZoomMarkdownViewerWheel({
    isDragMode: rendererState.isDragMode,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey
  });
  if (!shouldZoom) {
    return;
  }
  // 当前滚轮事件对应的目标倍率。
  const nextZoom = getMarkdownViewerWheelZoom(rendererState.zoomValue, event.deltaY);
  // 应用当前图表边界后的目标倍率。
  const normalizedNextZoom = clampMarkdownMermaidZoom(nextZoom, rendererState.zoomBounds);
  // 关键步骤：拖拽模式的滚轮由图表完整接管，到达倍率边界后也不滚动外层页面。
  event.preventDefault();
  event.stopPropagation();
  if (normalizedNextZoom === rendererState.zoomValue) {
    return;
  }
  updateMarkdownMermaidRendererZoom(rendererState, normalizedNextZoom, {
    x: event.clientX,
    y: event.clientY
  });
}

/**
 * 拖拽模式下开始平移图表 Mermaid。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState?.isDragMode || rendererState.isDragging) {
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

  rendererState.activePointerId = event.pointerId;
  rendererState.isDragging = true;
  rendererState.dragStartClientX = event.clientX;
  rendererState.dragStartClientY = event.clientY;
  rendererState.dragStartScrollLeft = bodyElement.scrollLeft;
  rendererState.dragStartScrollTop = bodyElement.scrollTop;
  rendererState.figureElement.classList.add(MERMAID_DRAGGING_CLASS_NAME);
  if (typeof bodyElement.setPointerCapture === "function") {
    bodyElement.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

/**
 * 拖拽模式下更新图表 Mermaid 平移量。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerMove(event: PointerEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState?.isDragging) {
    return;
  }
  // 当前滚动视口。
  const bodyElement = event.currentTarget as HTMLElement;
  // 横向拖拽位移。
  const deltaX = event.clientX - rendererState.dragStartClientX;
  // 纵向拖拽位移。
  const deltaY = event.clientY - rendererState.dragStartClientY;
  bodyElement.scrollLeft = rendererState.dragStartScrollLeft - deltaX;
  bodyElement.scrollTop = rendererState.dragStartScrollTop - deltaY;
}

/**
 * 结束图表 Mermaid 拖拽。
 * @param event 图表正文指针事件。
 */
function handleMarkdownMermaidPointerUp(event: PointerEvent): void {
  // 当前图表状态。
  const rendererState = getMarkdownMermaidRendererStateFromEvent(event);
  if (!rendererState?.isDragging) {
    return;
  }
  if (rendererState.activePointerId !== event.pointerId) return;
  stopMarkdownMermaidDrag(rendererState);
}

/**
 * 结束拖拽并释放指针捕获，模式切换、取消和销毁共用。
 * @param state 当前图表实例。
 */
function stopMarkdownMermaidDrag(state: MarkdownMermaidRendererState): void {
  // 保存指针编号后先清理状态，避免释放捕获触发重复处理。
  const pointerId = state.activePointerId;
  state.activePointerId = undefined;
  state.isDragging = false;
  state.figureElement.classList.remove(MERMAID_DRAGGING_CLASS_NAME);
  if (pointerId !== undefined && state.bodyElement.hasPointerCapture?.(pointerId)) {
    state.bodyElement.releasePointerCapture(pointerId);
  }
}

/**
 * 更新 Mermaid 图表缩放比例与画布尺寸。
 * @param rendererState 当前图表状态。
 * @param nextZoom 目标缩放倍数。
 * @param zoomAnchor 可选缩放焦点。
 */
function updateMarkdownMermaidRendererZoom(
  rendererState: MarkdownMermaidRendererState,
  nextZoom: number,
  zoomAnchor?: MarkdownViewerZoomAnchor
): void {
  // 归一化缩放倍数。
  const normalizedZoom = clampMarkdownMermaidZoom(nextZoom, rendererState.zoomBounds);
  // 回到默认倍率必须恢复规范视图，不能保留锚点补偿的画布位移或滚动量。
  if (normalizedZoom === VIEWER_DEFAULT_ZOOM) {
    rendererState.zoomValue = VIEWER_DEFAULT_ZOOM;
    rendererState.zoomValueElement.textContent = `${Math.round(VIEWER_DEFAULT_ZOOM * 100)}%`;
    rendererState.zoomOutButtonElement.disabled =
      VIEWER_DEFAULT_ZOOM <= rendererState.zoomBounds.min;
    rendererState.zoomInButtonElement.disabled =
      VIEWER_DEFAULT_ZOOM >= rendererState.zoomBounds.max;
    rendererState.resetButtonElement.disabled = true;
    updateMarkdownMermaidRendererCanvasSize(rendererState);
    resetMarkdownMermaidRendererViewport(rendererState);
    return;
  }
  // 已到达缩放边界时不再重复修正焦点，避免滚轮事件的像素舍入让视图持续漂移。
  if (shouldSkipMarkdownViewerAnchoredZoom(rendererState.zoomValue, normalizedZoom, zoomAnchor)) {
    return;
  }
  // 缩放前焦点。
  const focalPoint = captureMarkdownMermaidRendererFocalPoint(rendererState, zoomAnchor);
  rendererState.zoomValue = normalizedZoom;
  rendererState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  rendererState.zoomOutButtonElement.disabled = normalizedZoom <= rendererState.zoomBounds.min;
  rendererState.zoomInButtonElement.disabled = normalizedZoom >= rendererState.zoomBounds.max;
  rendererState.resetButtonElement.disabled = false;
  updateMarkdownMermaidRendererCanvasSize(rendererState);
  if (focalPoint) {
    applyMarkdownMermaidRendererFocalPoint(rendererState, focalPoint);
  }
}

/**
 * 按当前正文视口和图表内容刷新 Mermaid 缩放边界。
 * @param rendererState 当前图表状态。
 */
function refreshMarkdownMermaidRendererZoomBounds(
  rendererState: MarkdownMermaidRendererState
): void {
  // 关键步骤：边界仅在首次渲染或外层尺寸变化时更新，避免滚轮缩放导致上限漂移。
  updateMarkdownMermaidRendererCanvasSize(rendererState);
  rendererState.zoomBounds = readMarkdownMermaidRendererZoomBounds(rendererState);
}

/**
 * 读取 Mermaid 正文图表在当前布局下的内容自适应缩放边界。
 * @param rendererState 当前图表状态。
 * @returns 当前图表对应的缩放边界。
 */
function readMarkdownMermaidRendererZoomBounds(
  rendererState: MarkdownMermaidRendererState
): MarkdownMermaidZoomBounds {
  /** 当前画布内是否存在可缩放的 SVG。 */
  const hasSvg = rendererState.canvasElement.querySelector("svg") !== null;
  if (!hasSvg) {
    return {
      min: MERMAID_FIT_VIEW_ZOOM,
      max: MERMAID_FIT_VIEW_ZOOM
    };
  }

  return getMarkdownMermaidZoomBounds({
    currentZoom: rendererState.zoomValue,
    fitScale: getMarkdownMermaidRendererFitScale(rendererState),
    naturalWidth: rendererState.naturalWidth,
    naturalHeight: rendererState.naturalHeight,
    textHeights: readMarkdownMermaidTextHeights(rendererState.canvasElement)
  });
}

/**
 * 计算 Mermaid 图表固有尺寸完整适配正文视口所需的绝对缩放比例。
 * @param rendererState 当前图表状态。
 * @returns 图表适配正文视口的绝对缩放比例。
 */
function getMarkdownMermaidRendererFitScale(rendererState: MarkdownMermaidRendererState): number {
  /** 不受滚动条显隐影响的正文视口布局尺寸。 */
  const viewportSize = readMarkdownViewerViewportSize(rendererState.bodyElement);
  // 布局由场景 CSS 提供，尺寸算法统一扣除实际 padding。
  const style = rendererState.bodyElement.ownerDocument.defaultView?.getComputedStyle(
    rendererState.bodyElement
  );
  // 水平内边距。
  const paddingX =
    (parseFloat(style?.paddingLeft ?? "") || 0) + (parseFloat(style?.paddingRight ?? "") || 0);
  // 垂直内边距。
  const paddingY =
    (parseFloat(style?.paddingTop ?? "") || 0) + (parseFloat(style?.paddingBottom ?? "") || 0);
  /** 扣除正文 padding 并预留安全边距后的可用宽度。 */
  const viewportWidth = Math.max((viewportSize.width - paddingX) * VIEWER_FIT_RATIO, 1);
  /** 扣除正文 padding 并预留安全边距后的可用高度。 */
  const viewportHeight = Math.max((viewportSize.height - paddingY) * VIEWER_FIT_RATIO, 1);
  /** SVG 固有宽度的安全值。 */
  const naturalWidth = Math.max(rendererState.naturalWidth, 1);
  /** SVG 固有高度的安全值。 */
  const naturalHeight = Math.max(rendererState.naturalHeight, 1);

  return Math.min(1, viewportWidth / naturalWidth, viewportHeight / naturalHeight);
}

/**
 * 记录图表缩放前的画布焦点。
 * @param rendererState 当前图表状态。
 * @param zoomAnchor 可选客户端坐标锚点。
 * @returns 画布归一化焦点。
 */
function captureMarkdownMermaidRendererFocalPoint(
  rendererState: MarkdownMermaidRendererState,
  zoomAnchor?: MarkdownViewerZoomAnchor
): MarkdownViewerFocalPoint | undefined {
  // 缩放前画布矩形。
  const canvasRect = rendererState.canvasElement.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return undefined;
  }
  // 正文视口矩形。
  const bodyRect = rendererState.bodyElement.getBoundingClientRect();
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
 * 在图表缩放后恢复焦点的客户端位置。
 * @param rendererState 当前图表状态。
 * @param focalPoint 缩放前焦点。
 */
function applyMarkdownMermaidRendererFocalPoint(
  rendererState: MarkdownMermaidRendererState,
  focalPoint: MarkdownViewerFocalPoint
): void {
  // 缩放后、滚动校正前的画布矩形。
  const canvasRectBeforeScroll = rendererState.canvasElement.getBoundingClientRect();
  if (canvasRectBeforeScroll.width <= 0 || canvasRectBeforeScroll.height <= 0) {
    return;
  }
  // 关键步骤：基于当前滚动量做增量校正，避免清零视口造成锚点位置逐次漂移。
  rendererState.bodyElement.scrollLeft = getMarkdownViewerAnchoredScrollOffset(
    rendererState.bodyElement.scrollLeft,
    canvasRectBeforeScroll.left,
    focalPoint.anchorClientX,
    focalPoint.normalizedX,
    canvasRectBeforeScroll.width
  );
  rendererState.bodyElement.scrollTop = getMarkdownViewerAnchoredScrollOffset(
    rendererState.bodyElement.scrollTop,
    canvasRectBeforeScroll.top,
    focalPoint.anchorClientY,
    focalPoint.normalizedY,
    canvasRectBeforeScroll.height
  );
  // 浏览器会把超出范围的滚动量钳制到 0 或最大值。某一轴到达边界后允许内容自然偏移，
  // 不再叠加 canvas transform 强行维持鼠标锚点，避免产生不可逆的残留位移。
}

/**
 * 按正文可用区域和缩放比例更新图表画布尺寸。
 * @param rendererState 当前图表状态。
 */
function updateMarkdownMermaidRendererCanvasSize(
  rendererState: MarkdownMermaidRendererState
): void {
  // 图表完整适配正文视口时的绝对缩放比例。
  const fitScale = getMarkdownMermaidRendererFitScale(rendererState);
  // SVG 固有宽度。
  const naturalWidth = Math.max(rendererState.naturalWidth, 1);
  // SVG 固有高度。
  const naturalHeight = Math.max(rendererState.naturalHeight, 1);
  // 当前显示宽度。
  const displayWidth = Math.max(1, naturalWidth * fitScale * rendererState.zoomValue);
  // 当前显示高度。
  const displayHeight = Math.max(1, naturalHeight * fitScale * rendererState.zoomValue);
  rendererState.canvasElement.style.width = `${displayWidth}px`;
  rendererState.canvasElement.style.height = `${displayHeight}px`;

  // 内部 SVG 改由 canvas 尺寸统一控制。
  const svgElement = rendererState.canvasElement.querySelector<SVGSVGElement>("svg");
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
 * 监听图表容器尺寸变化并重新适配画布。
 * @param rendererState 当前图表状态。
 */
function observeMarkdownMermaidRendererSize(rendererState: MarkdownMermaidRendererState): void {
  if (rendererState.resizeObserver) {
    return;
  }
  // 当前宿主的 ResizeObserver 构造器。
  const ResizeObserverConstructor =
    rendererState.figureElement.ownerDocument.defaultView?.ResizeObserver;
  if (!ResizeObserverConstructor) {
    return;
  }
  rendererState.resizeObserver = new ResizeObserverConstructor(() => {
    refreshMarkdownMermaidRendererZoomBounds(rendererState);
    updateMarkdownMermaidRendererZoom(rendererState, rendererState.zoomValue);
  });
  // 观察外层 figure 的布局变化，避免 body 滚动条显隐自身触发反馈循环。
  rendererState.resizeObserver.observe(rendererState.figureElement);
}

/**
 * 调用场景提供的入口动作（全屏或关闭）。
 * @param event 场景按钮点击事件。
 */
function handleMarkdownMermaidSceneActionClick(event: MouseEvent): void {
  // 当前图表实例。
  const state = getMarkdownMermaidRendererStateFromEvent(event);
  if (!state) return;
  // 从当前画布读取独立 SVG 副本，DOM 不保存冗余 SVG 属性。
  const svg = state.canvasElement.querySelector<SVGSVGElement>(":scope > svg")?.outerHTML ?? "";
  event.preventDefault();
  event.stopPropagation();
  state.options.onAction(svg, readMarkdownSource(state.figureElement) ?? "");
}

/**
 * 两个图表场景共用键盘缩放行为。
 * @param event 当前实例中的键盘事件。
 */
function handleMarkdownMermaidKeyDown(event: KeyboardEvent): void {
  // 键盘事件所属实例。
  const state = getMarkdownMermaidRendererStateFromEvent(event);
  if (!state || !["+", "=", "-", "0"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  updateMarkdownMermaidRendererZoom(
    state,
    event.key === "0"
      ? VIEWER_DEFAULT_ZOOM
      : state.zoomValue + (event.key === "-" ? -1 : 1) * getMarkdownViewerZoomStep(state.zoomValue)
  );
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
  // SVG 声明的固有高度。
  const heightAttribute = parseFloat(svgElement.getAttribute("height") ?? "");

  if (Number.isFinite(widthAttribute) && Number.isFinite(heightAttribute)) {
    return {
      width: widthAttribute > 0 ? widthAttribute : 720,
      height: heightAttribute > 0 ? heightAttribute : 480
    };
  }

  return { width: 720, height: 480 };
}

export { createMarkdownMermaidRenderer, hydrateMermaidBlocks, MERMAID_LANGUAGE_ID };
