import { hydrateMarkdownPreview } from "@scribdown/markdown-renderer";
import { SOURCE_LINE_ACTIVE_CLASS_NAME, SOURCE_LINE_DATA_ATTRIBUTE } from "@scribdown/shared";

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
  setPreviewCursorMessageType: string;
  clearPreviewCursorMessageType: string;
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
  visibleTopLine?: number;
  visibleBottomLine?: number;
}

/**
 * 光标定位滚动请求：把光标所在块对齐到编辑器中该块起始行的纵向位置。
 */
interface CursorAlignRequest {
  /** 光标所在源码行号（1-based）。 */
  sourceLine: number;
  /** 编辑器可视区顶部源码行号（1-based）。 */
  visibleTopLine: number;
  /** 编辑器可视区底部源码行号（1-based）。 */
  visibleBottomLine: number;
}

/**
 * 预览中一个源码行锚点：记录块级元素的源码行号与文档绝对像素偏移。
 */
interface SourceLineAnchor {
  /** 源码起始行号（1-based）。 */
  line: number;
  /** 元素相对文档顶部的像素偏移。 */
  offsetTop: number;
  /** 锚点对应的块级元素，用于光标定位高亮。 */
  element: HTMLElement;
}

/**
 * 源码行锚点索引：缓存锚点采集结果，避免每个滚动帧重复测量 DOM。
 */
interface SourceLineAnchorIndex {
  /** 获取当前锚点数组；缓存有效时直接返回，失效时重新采集。 */
  getAnchors(): SourceLineAnchor[];
  /** 标记缓存失效，下次获取时重新采集。 */
  invalidate(): void;
}

/**
 * 创建源码行锚点索引。
 * @param previewRootElement 预览根节点。
 * @returns 锚点索引实例。
 */
function createSourceLineAnchorIndex(
  previewRootElement: HTMLElement
): SourceLineAnchorIndex {
  // 已缓存的锚点数组；undefined 表示缓存失效需重新采集。
  let cachedAnchors: SourceLineAnchor[] | undefined;

  return {
    getAnchors(): SourceLineAnchor[] {
      if (!cachedAnchors) {
        cachedAnchors = collectSourceLineAnchors(previewRootElement);
      }

      return cachedAnchors;
    },
    invalidate(): void {
      cachedAnchors = undefined;
    }
  };
}

/**
 * 执行 Scribdown 统一预览 hydration。
 * @param rootElement 预览根节点。
 */
export function hydrateScribdownPreview(rootElement: ParentNode): void {
  hydrateMarkdownPreview(rootElement);
}

/**
 * 光标定位滚动的节流间隔（毫秒）：间隔内的多次光标变化合并为一次定位滚动，避免预览频繁晃动。
 */
const CURSOR_ALIGN_THROTTLE_MS = 150;

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
  // 程序化滚动后的实际纵向位置，用于跳过自身触发的 scroll 回声；undefined 表示无待跳过回声。
  let suppressedScrollY: number | undefined;
  // 当前光标定位高亮的元素；undefined 表示当前无高亮元素。
  let activeHighlightElement: HTMLElement | undefined;
  // 光标定位滚动上次实际执行的时间戳（毫秒）。
  let cursorAlignLastAt = 0;
  // 光标定位滚动节流的尾随定时器句柄，0 表示当前无待处理定时器。
  let cursorAlignTrailingTimer = 0;
  // 节流间隔内待处理的最新光标定位请求；undefined 表示无待处理值。
  let cursorAlignPending: CursorAlignRequest | undefined;
  // 源码行锚点索引，缓存锚点测量结果。
  const anchorIndex = createSourceLineAnchorIndex(previewRootElement);

  /**
   * 立即执行一次光标定位滚动，并记录滚动位置用于跳过 scroll 回声。
   * @param request 光标定位滚动请求。
   */
  const runCursorAlign = (request: CursorAlignRequest): void => {
    // 光标定位滚动后的实际纵向位置。
    const scrolledY = alignPreviewToSourceLine(anchorIndex.getAnchors(), request);

    if (scrolledY !== undefined) {
      suppressedScrollY = scrolledY;
    }
  };

  /**
   * 以节流方式安排光标定位滚动：间隔外立即执行（leading），
   * 间隔内仅记录最新请求并安排一次尾随执行（trailing）。
   * @param request 光标定位滚动请求。
   */
  const scheduleCursorAlign = (request: CursorAlignRequest): void => {
    // 当前时间戳。
    const nowMs = Date.now();
    // 距上次实际执行经过的毫秒数。
    const elapsedMs = nowMs - cursorAlignLastAt;

    if (elapsedMs >= CURSOR_ALIGN_THROTTLE_MS) {
      // 已超出节流间隔，立即执行并清理待处理状态。
      cursorAlignLastAt = nowMs;
      cursorAlignPending = undefined;

      if (cursorAlignTrailingTimer !== 0) {
        window.clearTimeout(cursorAlignTrailingTimer);
        cursorAlignTrailingTimer = 0;
      }

      runCursorAlign(request);
      return;
    }

    // 处于节流间隔内：记录最新请求，已有尾随定时器则复用。
    cursorAlignPending = request;

    if (cursorAlignTrailingTimer !== 0) {
      return;
    }

    // 关键步骤：安排一次尾随执行，确保光标停止后预览定位到最终位置。
    cursorAlignTrailingTimer = window.setTimeout(() => {
      cursorAlignTrailingTimer = 0;

      // 尾随执行时的待处理请求。
      const pendingAlign = cursorAlignPending;
      cursorAlignPending = undefined;

      if (pendingAlign) {
        cursorAlignLastAt = Date.now();
        runCursorAlign(pendingAlign);
      }
    }, CURSOR_ALIGN_THROTTLE_MS - elapsedMs);
  };

  // 关键步骤：光标定位高亮采用独立浮层，覆盖在目标块之上，不向预览内容 DOM 注入 class。
  const cursorHighlightOverlay = document.createElement("div");
  cursorHighlightOverlay.classList.add(SOURCE_LINE_ACTIVE_CLASS_NAME);
  cursorHighlightOverlay.style.display = "none";
  document.body.appendChild(cursorHighlightOverlay);

  /**
   * 把光标定位高亮浮层定位覆盖到目标元素之上。
   * @param targetElement 目标块级元素。
   */
  const showCursorHighlight = (targetElement: HTMLElement): void => {
    activeHighlightElement = targetElement;

    // 目标元素相对视口的矩形。
    const rect = targetElement.getBoundingClientRect();

    // 浮层使用文档绝对坐标定位，随页面滚动自然移动，无需在滚动时更新。
    cursorHighlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    cursorHighlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    cursorHighlightOverlay.style.width = `${rect.width}px`;
    cursorHighlightOverlay.style.height = `${rect.height}px`;
    cursorHighlightOverlay.style.display = "block";

    // 关键步骤：浮层为复用元素，重置动画以便每次定位都重新触发 1s 闪烁。
    cursorHighlightOverlay.style.animation = "none";
    void cursorHighlightOverlay.offsetWidth;
    cursorHighlightOverlay.style.animation = "";
  };

  /**
   * 隐藏光标定位高亮浮层。
   */
  const hideCursorHighlight = (): void => {
    activeHighlightElement = undefined;
    cursorHighlightOverlay.style.display = "none";
  };

  /**
   * 按当前高亮目标元素重新定位浮层，用于内容尺寸变化后保持覆盖准确。
   */
  const repositionCursorHighlight = (): void => {
    if (activeHighlightElement) {
      showCursorHighlight(activeHighlightElement);
    }
  };

  // 内容尺寸变化（重渲染外的图片/字体加载、窗口缩放等）会改变锚点偏移，使缓存失效。
  const previewResizeObserver = new ResizeObserver(() => {
    anchorIndex.invalidate();
    // 内容尺寸变化会改变目标元素位置，同步重新定位高亮浮层。
    repositionCursorHighlight();
  });
  previewResizeObserver.observe(previewRootElement);

  window.addEventListener("message", (event) => {
    // 来自主进程的标准化消息。
    const normalizedMessage = normalizeRuntimeMessage(event.data);

    if (!normalizedMessage) {
      return;
    }

    if (normalizedMessage.type === options.renderContentMessageType) {
      applyRenderedContent(previewRootElement, previewBaseElement, normalizedMessage);
      // 关键步骤：重渲染替换了 DOM，锚点缓存立即失效。
      anchorIndex.invalidate();
      // 旧高亮目标元素已随 DOM 替换失效，置空待下次光标消息重新定位浮层。
      activeHighlightElement = undefined;
      return;
    }

    if (normalizedMessage.type === options.setPreviewScrollMessageType) {
      // 程序化滚动后的实际位置，用于在 scroll 回声中跳过上报。
      const scrolledY = scrollPreviewToSourceLine(
        anchorIndex.getAnchors(),
        normalizedMessage.sourceLine
      );

      if (scrolledY !== undefined) {
        suppressedScrollY = scrolledY;
      }

      return;
    }

    if (normalizedMessage.type === options.setPreviewCursorMessageType) {
      // 光标所在源码行号。
      const cursorSourceLine = normalizedMessage.sourceLine;

      if (typeof cursorSourceLine !== "number") {
        return;
      }

      // 光标所在源码行对应的预览块元素。
      const targetElement = findAnchorElementForLine(anchorIndex.getAnchors(), cursorSourceLine);

      if (!targetElement) {
        return;
      }

      // 关键步骤：高亮立即随光标移动，把浮层覆盖到目标块之上。
      showCursorHighlight(targetElement);

      // 关键步骤：定位滚动按节流执行，避免光标频繁变化时预览频繁晃动。
      scheduleCursorAlign({
        sourceLine: cursorSourceLine,
        visibleTopLine: normalizedMessage.visibleTopLine ?? cursorSourceLine,
        visibleBottomLine: normalizedMessage.visibleBottomLine ?? cursorSourceLine
      });

      return;
    }

    if (normalizedMessage.type === options.clearPreviewCursorMessageType) {
      // 关键步骤：光标离开绑定文档，隐藏高亮浮层。
      hideCursorHighlight();
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

        // 关键步骤：跳过程序化滚动自身触发的 scroll 回声，避免无谓的往返消息。
        if (
          suppressedScrollY !== undefined &&
          Math.abs(window.scrollY - suppressedScrollY) < 1
        ) {
          suppressedScrollY = undefined;
          return;
        }

        // 当前预览视口顶部对应的源码行号（可能为小数）。
        const topSourceLine = resolveTopSourceLine(anchorIndex.getAnchors());

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
  // 编辑器可视区顶部源码行号字段。
  const visibleTopLineField = messageRecord.visibleTopLine;
  // 编辑器可视区底部源码行号字段。
  const visibleBottomLineField = messageRecord.visibleBottomLine;

  return {
    type: messageTypeField,
    baseHref: typeof baseHrefField === "string" ? baseHrefField : undefined,
    renderedHtml: typeof renderedHtmlField === "string" ? renderedHtmlField : undefined,
    sourceLine: typeof sourceLineField === "number" ? sourceLineField : undefined,
    visibleTopLine: typeof visibleTopLineField === "number" ? visibleTopLineField : undefined,
    visibleBottomLine:
      typeof visibleBottomLineField === "number" ? visibleBottomLineField : undefined
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
    anchors.push({ line, offsetTop, element: anchorElement });
  });

  // 顶层块级元素的源码行号与像素偏移均单调递增，按行号排序保证有序。
  anchors.sort((firstAnchor, secondAnchor) => firstAnchor.line - secondAnchor.line);

  return anchors;
}

/**
 * 在升序锚点数组中二分查找最后一个「键值 ≤ 目标值」的锚点索引。
 * @param anchors 按所选键值升序排列的源码行锚点。
 * @param target 目标值。
 * @param selectKey 从锚点取出参与比较的键值。
 * @returns 命中索引；目标值小于首个锚点键值时返回 -1。
 */
function findLastAnchorIndexAtMost(
  anchors: SourceLineAnchor[],
  target: number,
  selectKey: (anchor: SourceLineAnchor) => number
): number {
  // 二分查找区间下界。
  let lowIndex = 0;
  // 二分查找区间上界。
  let highIndex = anchors.length - 1;
  // 命中的最后一个「键值 ≤ 目标值」索引。
  let resultIndex = -1;

  while (lowIndex <= highIndex) {
    // 当前二分中点索引。
    const midIndex = (lowIndex + highIndex) >> 1;

    if (selectKey(anchors[midIndex]) <= target) {
      resultIndex = midIndex;
      lowIndex = midIndex + 1;
    } else {
      highIndex = midIndex - 1;
    }
  }

  return resultIndex;
}

/**
 * 计算当前预览视口顶部对应的源码行号。
 * @param anchors 全部源码行锚点（按行号升序）。
 * @returns 源码行号（1-based，可能为小数）。
 */
function resolveTopSourceLine(anchors: SourceLineAnchor[]): number {
  if (anchors.length === 0) {
    return 1;
  }

  // 当前视口顶部的文档像素偏移。
  const viewportTop = window.scrollY;
  // 视口顶部之上（含等于）的最后一个锚点索引（按像素偏移二分）。
  const previousAnchorIndex = findLastAnchorIndexAtMost(
    anchors,
    viewportTop,
    (anchor) => anchor.offsetTop
  );

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
 * 按源码行号在锚点间插值计算其对应的文档像素偏移。
 * @param anchors 全部源码行锚点（按行号升序，非空）。
 * @param sourceLine 目标源码行号（1-based，可能为小数）。
 * @returns 目标行对应的文档绝对像素偏移。
 */
function resolveSourceLineOffsetTop(anchors: SourceLineAnchor[], sourceLine: number): number {
  // 目标行号之前（含等于）的最后一个锚点索引（按源码行号二分）。
  const previousAnchorIndex = findLastAnchorIndexAtMost(
    anchors,
    sourceLine,
    (anchor) => anchor.line
  );

  if (previousAnchorIndex < 0) {
    // 目标行在首个锚点之前，对齐首个锚点。
    return anchors[0].offsetTop;
  }

  if (previousAnchorIndex >= anchors.length - 1) {
    // 目标行在末个锚点之后，对齐末个锚点。
    return anchors[anchors.length - 1].offsetTop;
  }

  // 目标行前方锚点。
  const previousAnchor = anchors[previousAnchorIndex];
  // 目标行后方锚点。
  const nextAnchor = anchors[previousAnchorIndex + 1];
  // 两锚点间的行号跨度。
  const lineSpan = nextAnchor.line - previousAnchor.line;
  // 目标行落在两锚点间的比例。
  const fraction = lineSpan <= 0 ? 0 : (sourceLine - previousAnchor.line) / lineSpan;

  return previousAnchor.offsetTop + fraction * (nextAnchor.offsetTop - previousAnchor.offsetTop);
}

/**
 * 按目标源码行号滚动预览，使该行对齐视口顶部。
 * @param anchors 全部源码行锚点（按行号升序）。
 * @param sourceLine 目标源码行号（1-based，可能为小数）。
 * @returns 程序化滚动后的实际纵向位置；未执行滚动时返回 undefined。
 */
function scrollPreviewToSourceLine(
  anchors: SourceLineAnchor[],
  sourceLine: number | undefined
): number | undefined {
  if (typeof sourceLine !== "number" || anchors.length === 0) {
    return undefined;
  }

  window.scrollTo(0, resolveSourceLineOffsetTop(anchors, sourceLine));

  // 返回滚动后的实际位置（已被浏览器约束到有效区间），供回声跳过比对。
  return window.scrollY;
}

/**
 * 滚动预览，使光标所在块对齐到「编辑器中该块起始行」的纵向位置。
 * 以块起始行（锚点行）而非光标行为对齐基准：编辑器里锚点行在可视区的纵向比例，
 * 即预览里该块应处的纵向比例，从而做到编辑器锚点行与预览块逐像素对齐。
 * @param anchors 全部源码行锚点（按行号升序）。
 * @param request 光标定位滚动请求。
 * @returns 程序化滚动后的实际纵向位置；未执行滚动时返回 undefined。
 */
function alignPreviewToSourceLine(
  anchors: SourceLineAnchor[],
  request: CursorAlignRequest
): number | undefined {
  if (anchors.length === 0) {
    return undefined;
  }

  // 光标所在块的锚点索引（行号不大于光标行的最后一个锚点）。
  const anchorIndex = findLastAnchorIndexAtMost(
    anchors,
    request.sourceLine,
    (anchor) => anchor.line
  );
  // 光标所在块的锚点（含锚点行号与文档像素偏移）。
  const matchedAnchor = anchors[Math.max(0, anchorIndex)];

  // 编辑器可视区行跨度。
  const visibleLineSpan = request.visibleBottomLine - request.visibleTopLine;
  // 锚点行在编辑器可视区内的纵向比例（0 顶部，1 底部）；跨度非正时对齐顶部。
  const anchorFraction =
    visibleLineSpan > 0
      ? Math.min(
          1,
          Math.max(0, (matchedAnchor.line - request.visibleTopLine) / visibleLineSpan)
        )
      : 0;

  // 关键步骤：把锚点块按锚点行的编辑器纵向比例定位，不在块内按行号插值。
  window.scrollTo(0, matchedAnchor.offsetTop - anchorFraction * window.innerHeight);

  // 返回滚动后的实际位置（已被浏览器约束到有效区间），供回声跳过比对。
  return window.scrollY;
}

/**
 * 查找光标所在源码行对应的预览块元素。
 * @param anchors 全部源码行锚点（按行号升序）。
 * @param sourceLine 光标所在源码行号（1-based）。
 * @returns 命中的块级元素；无锚点或入参非法时返回 undefined。
 */
function findAnchorElementForLine(
  anchors: SourceLineAnchor[],
  sourceLine: number | undefined
): HTMLElement | undefined {
  if (typeof sourceLine !== "number" || anchors.length === 0) {
    return undefined;
  }

  // 行号不大于光标行的最后一个锚点索引（按源码行号二分）。
  const anchorIndex = findLastAnchorIndexAtMost(anchors, sourceLine, (anchor) => anchor.line);

  // 光标位于首个锚点之前时回退到首个锚点。
  return anchors[Math.max(0, anchorIndex)].element;
}
