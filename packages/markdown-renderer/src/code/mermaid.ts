/**
 * Mermaid 图表 hydration：把 mermaid 代码块替换为图表 figure 结构，
 * 按需加载 mermaid 主包并在 live DOM 阶段触发异步渲染，失败时展示 fallback。
 */

import {
  MERMAID_BODY_CLASS_NAME,
  MERMAID_CANVAS_CLASS_NAME,
  MERMAID_CHROME_CLASS_NAME,
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
  SOURCE_LINE_DATA_ATTRIBUTE
} from "@scribdown/shared";

import { CODE_BLOCK_HYDRATED_DATA_KEY } from "./code-block-chrome";
import { MERMAID_LABEL_TEXT, openMarkdownMermaidViewer } from "./mermaid-viewer";

// Mermaid 代码块的语言标识，对应 fixture 中的 ```mermaid。
const MERMAID_LANGUAGE_ID = "mermaid";

// Mermaid 已 hydrate 标记的 dataset 键（仅表示结构已构建）。
const MERMAID_HYDRATED_DATA_KEY = "scribdownMermaidHydrated";

// Mermaid 渲染已启动标记，避免在 live DOM 重复触发 mermaid.render。
const MERMAID_RENDER_STARTED_DATA_KEY = "scribdownMermaidRenderStarted";

// Mermaid 源码寄存在 figure 上的 dataset 键，供延后的 live-DOM 渲染读取。
const MERMAID_SOURCE_DATA_KEY = "scribdownMermaidSourceText";

// Mermaid 失败态默认文案。
const MERMAID_FALLBACK_DEFAULT_TEXT = "图表渲染失败";

// Mermaid SVG 节点宿主元素 id 前缀，确保多图表 id 唯一。
const MERMAID_RENDER_ID_PREFIX = "scribdown-mermaid-";

// Mermaid 渲染顺序计数器，配合前缀生成全局唯一 id。
let mermaidRenderIdCounter = 0;

// Mermaid 全屏按钮可访问名称。
const MERMAID_FULLSCREEN_BUTTON_ARIA_LABEL = "全屏查看图表";

// 是否允许 mermaid 在 figure 右下角悬浮显示全屏按钮（仅 loaded 态显示）。
const MERMAID_FULLSCREEN_AVAILABLE_DATA_KEY = "scribdownMermaidFullscreenReady";

// Mermaid 全屏查看器存放原始 SVG 字符串的 dataset 键。
const MERMAID_VIEWER_SOURCE_DATA_KEY = "scribdownMermaidSource";

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

export { hydrateMermaidBlocks, MERMAID_LANGUAGE_ID };
