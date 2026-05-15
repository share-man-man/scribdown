import { hydrateMarkdownPreview } from "@scribdown/markdown-renderer";
import { SOURCE_LINE_DATA_ATTRIBUTE } from "@scribdown/shared";

/**
 * VS Code Webview API 的最小能力声明。
 */
interface VscodeWebviewApi {
  postMessage(message: unknown): void;
}

/**
 * VS Code Webview 侧运行时入参。
 */
export interface VscodePreviewRuntimeBootstrapOptions {
  previewRootElementId: string;
  previewBaseElementId: string;
  renderContentMessageType: string;
  setPreviewScrollMessageType: string;
  previewReadyMessageType: string;
  previewScrollChangedMessageType: string;
}

/**
 * 运行时消息的最小标准结构。
 */
interface NormalizedRuntimeMessage {
  type: string;
  baseHref?: string;
  renderedHtml?: string;
  sourceLine?: number;
}

/**
 * 预览中一个源码行锚点：记录块级元素的源码行号与文档绝对像素偏移。
 */
interface SourceLineAnchor {
  /** 源码起始行号（1-based）。 */
  line: number;
  /** 元素相对文档顶部的像素偏移。 */
  offsetTop: number;
}

/**
 * 执行 Scribdown 统一预览 hydration。
 * @param rootElement 预览根节点。
 */
export function hydrateScribdownPreview(rootElement: ParentNode): void {
  hydrateMarkdownPreview(rootElement);
}

/**
 * 在 VS Code Webview 环境中挂载消息桥与渲染更新逻辑。
 * @param options 运行时初始化参数。
 */
export function bootstrapVscodePreviewRuntime(
  options: VscodePreviewRuntimeBootstrapOptions
): void {
  // 全局对象上的 VS Code API 获取函数。
  const acquireVsCodeApiFunction = (
    globalThis as { acquireVsCodeApi?: () => VscodeWebviewApi }
  ).acquireVsCodeApi;

  if (typeof acquireVsCodeApiFunction !== "function") {
    return;
  }

  // VS Code Webview 提供的消息 API。
  const vscodeApi = acquireVsCodeApiFunction();
  // 预览内容根节点。
  const previewRootElement = document.getElementById(options.previewRootElementId);
  // 预览 base 标签节点。
  const previewBaseElement = document.getElementById(
    options.previewBaseElementId
  ) as HTMLBaseElement | null;

  if (!previewRootElement || !previewBaseElement) {
    return;
  }

  // 滚动上报的 rAF 节流句柄，0 表示当前无待处理帧。
  let scrollReportFrameHandle = 0;

  window.addEventListener("message", (event) => {
    // 来自主进程的标准化消息。
    const normalizedMessage = normalizeRuntimeMessage(event.data);

    if (!normalizedMessage) {
      return;
    }

    if (normalizedMessage.type === options.renderContentMessageType) {
      applyRenderedContent(previewRootElement, previewBaseElement, normalizedMessage);
      return;
    }

    if (normalizedMessage.type === options.setPreviewScrollMessageType) {
      scrollPreviewToSourceLine(previewRootElement, normalizedMessage.sourceLine);
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      // 关键步骤：用 rAF 节流，避免每个 scroll 事件都重新测量锚点。
      if (scrollReportFrameHandle !== 0) {
        return;
      }

      scrollReportFrameHandle = window.requestAnimationFrame(() => {
        scrollReportFrameHandle = 0;

        // 当前预览视口顶部对应的源码行号（可能为小数）。
        const topSourceLine = resolveTopSourceLine(previewRootElement);

        vscodeApi.postMessage({
          type: options.previewScrollChangedMessageType,
          sourceLine: topSourceLine
        });
      });
    },
    { passive: true }
  );

  vscodeApi.postMessage({ type: options.previewReadyMessageType });
}

/**
 * 校验并标准化运行时消息。
 * @param message 原始消息。
 * @returns 标准化结果，不合法时返回 undefined。
 */
function normalizeRuntimeMessage(message: unknown): NormalizedRuntimeMessage | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  // 原始消息对象。
  const messageRecord = message as Record<string, unknown>;
  // 消息类型字段。
  const messageTypeField = messageRecord.type;

  if (typeof messageTypeField !== "string") {
    return undefined;
  }

  // base 地址字段。
  const baseHrefField = messageRecord.baseHref;
  // 渲染 HTML 字段。
  const renderedHtmlField = messageRecord.renderedHtml;
  // 源码行号字段。
  const sourceLineField = messageRecord.sourceLine;

  return {
    type: messageTypeField,
    baseHref: typeof baseHrefField === "string" ? baseHrefField : undefined,
    renderedHtml: typeof renderedHtmlField === "string" ? renderedHtmlField : undefined,
    sourceLine: typeof sourceLineField === "number" ? sourceLineField : undefined
  };
}

/**
 * 应用主进程下发的渲染结果并执行 hydration。
 * @param previewRootElement 预览根节点。
 * @param previewBaseElement base 标签节点。
 * @param message 标准化渲染消息。
 */
function applyRenderedContent(
  previewRootElement: HTMLElement,
  previewBaseElement: HTMLBaseElement,
  message: NormalizedRuntimeMessage
): void {
  // 下一次生效的 base href。
  const nextBaseHref = message.baseHref ?? "";
  // 下一次生效的 HTML 字符串。
  const nextRenderedHtml = message.renderedHtml ?? "";

  previewBaseElement.setAttribute("href", nextBaseHref);
  previewRootElement.innerHTML = nextRenderedHtml;
  hydrateScribdownPreview(previewRootElement);
}

/**
 * 采集预览中带源码行号的锚点元素，按源码行号升序返回。
 * @param previewRootElement 预览根节点。
 * @returns 源码行锚点数组。
 */
function collectSourceLineAnchors(previewRootElement: HTMLElement): SourceLineAnchor[] {
  // 带源码行号属性的锚点元素集合。
  const anchorElements = previewRootElement.querySelectorAll<HTMLElement>(
    `[${SOURCE_LINE_DATA_ATTRIBUTE}]`
  );
  // 采集结果。
  const anchors: SourceLineAnchor[] = [];

  anchorElements.forEach((anchorElement) => {
    // 锚点元素上的源码行号文本。
    const lineText = anchorElement.getAttribute(SOURCE_LINE_DATA_ATTRIBUTE);
    // 解析后的源码行号。
    const line = lineText ? Number.parseInt(lineText, 10) : Number.NaN;

    if (!Number.isFinite(line)) {
      return;
    }

    // 元素相对文档顶部的绝对像素偏移。
    const offsetTop = anchorElement.getBoundingClientRect().top + window.scrollY;
    anchors.push({ line, offsetTop });
  });

  // 顶层块级元素的源码行号与像素偏移均单调递增，按行号排序保证有序。
  anchors.sort((firstAnchor, secondAnchor) => firstAnchor.line - secondAnchor.line);

  return anchors;
}

/**
 * 计算当前预览视口顶部对应的源码行号。
 * @param previewRootElement 预览根节点。
 * @returns 源码行号（1-based，可能为小数）。
 */
function resolveTopSourceLine(previewRootElement: HTMLElement): number {
  // 全部源码行锚点。
  const anchors = collectSourceLineAnchors(previewRootElement);

  if (anchors.length === 0) {
    return 1;
  }

  // 当前视口顶部的文档像素偏移。
  const viewportTop = window.scrollY;
  // 视口顶部之上（含等于）的最后一个锚点索引。
  let previousAnchorIndex = -1;

  for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
    if (anchors[anchorIndex].offsetTop <= viewportTop) {
      previousAnchorIndex = anchorIndex;
    } else {
      break;
    }
  }

  // 视口处于首个锚点之前时，取首个锚点行号。
  if (previousAnchorIndex < 0) {
    return anchors[0].line;
  }

  // 视口处于末个锚点之后时，取末个锚点行号。
  if (previousAnchorIndex >= anchors.length - 1) {
    return anchors[anchors.length - 1].line;
  }

  // 视口前方锚点。
  const previousAnchor = anchors[previousAnchorIndex];
  // 视口后方锚点。
  const nextAnchor = anchors[previousAnchorIndex + 1];
  // 两锚点间的像素跨度。
  const pixelSpan = nextAnchor.offsetTop - previousAnchor.offsetTop;
  // 视口顶部落在两锚点间的比例。
  const fraction = pixelSpan <= 0 ? 0 : (viewportTop - previousAnchor.offsetTop) / pixelSpan;

  return previousAnchor.line + fraction * (nextAnchor.line - previousAnchor.line);
}

/**
 * 按目标源码行号滚动预览到对应像素位置。
 * @param previewRootElement 预览根节点。
 * @param sourceLine 目标源码行号（1-based，可能为小数）。
 */
function scrollPreviewToSourceLine(
  previewRootElement: HTMLElement,
  sourceLine: number | undefined
): void {
  if (typeof sourceLine !== "number") {
    return;
  }

  // 全部源码行锚点。
  const anchors = collectSourceLineAnchors(previewRootElement);

  if (anchors.length === 0) {
    return;
  }

  // 目标行号之前（含等于）的最后一个锚点索引。
  let previousAnchorIndex = -1;

  for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
    if (anchors[anchorIndex].line <= sourceLine) {
      previousAnchorIndex = anchorIndex;
    } else {
      break;
    }
  }

  // 目标滚动到的文档像素偏移。
  let targetOffsetTop: number;

  if (previousAnchorIndex < 0) {
    // 目标行在首个锚点之前，对齐首个锚点。
    targetOffsetTop = anchors[0].offsetTop;
  } else if (previousAnchorIndex >= anchors.length - 1) {
    // 目标行在末个锚点之后，对齐末个锚点。
    targetOffsetTop = anchors[anchors.length - 1].offsetTop;
  } else {
    // 目标行前方锚点。
    const previousAnchor = anchors[previousAnchorIndex];
    // 目标行后方锚点。
    const nextAnchor = anchors[previousAnchorIndex + 1];
    // 两锚点间的行号跨度。
    const lineSpan = nextAnchor.line - previousAnchor.line;
    // 目标行落在两锚点间的比例。
    const fraction = lineSpan <= 0 ? 0 : (sourceLine - previousAnchor.line) / lineSpan;

    targetOffsetTop =
      previousAnchor.offsetTop + fraction * (nextAnchor.offsetTop - previousAnchor.offsetTop);
  }

  window.scrollTo(0, targetOffsetTop);
}
