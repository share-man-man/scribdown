import morphdom from "morphdom";
import { hydrateMarkdown, mountMarkdownToolbar } from "@scribdown/markdown-renderer";
import {
  SOURCE_LINE_ACTIVE_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE,
  SOURCE_LINE_OFFSCREEN_HINT_BOTTOM_CLASS_NAME,
  SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME,
  SOURCE_LINE_OFFSCREEN_HINT_TOP_CLASS_NAME
} from "@scribdown/shared";

/**
 * 目录标题链接 class，与 @scribdown/markdown-renderer 的 TOC_LINK_CLASS_NAME 对应。
 * 这些链接的跳转由渲染器在冒泡阶段处理，捕获阶段的宿主锚点拦截器需放行（详见拦截逻辑注释）。
 */
const TOC_LINK_CLASS_NAME = "scribdown-toc-link";

/**
 * 目录跳转的手动平滑滚动动画时长（毫秒）。
 */
const TOC_SCROLL_DURATION_MS = 320;

/**
 * 以 requestAnimationFrame 手动平滑滚动到目标标题顶部，注入给渲染器的目录跳转使用。
 * 关键步骤：VS Code webview 内容 frame 不动画化原生 scrollIntoView({behavior:"smooth"})
 * （对真实锚点点击会瞬时，且与 reduced-motion 无关），故宿主自行用逐帧 scrollTo 实现平滑。
 * 平台差异在此落地，渲染器保持跨端一致（只调用注入的实现）。
 * @param targetElement 目标标题元素。
 */
function scrollHeadingIntoViewSmoothly(targetElement: HTMLElement): void {
  // 文档滚动根。
  const scroller = document.scrollingElement ?? document.documentElement;
  // 动画起始纵向滚动量。
  const startY = scroller.scrollTop;
  // 目标纵向滚动量：元素相对视口顶 + 当前滚动量。
  const targetY = targetElement.getBoundingClientRect().top + startY;
  // 本次滚动位移。
  const distance = targetY - startY;
  if (distance === 0) {
    return;
  }
  // 动画起始时间戳，首帧赋值。
  let startTimestamp: number | undefined;

  /**
   * 推进单帧滚动。
   * @param timestamp 当前帧时间戳。
   */
  const stepScroll = (timestamp: number): void => {
    startTimestamp ??= timestamp;
    // 动画进度 0..1。
    const progress = Math.min(1, (timestamp - startTimestamp) / TOC_SCROLL_DURATION_MS);
    // easeInOutCubic 缓动。
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    window.scrollTo(0, startY + distance * eased);
    if (progress < 1) {
      window.requestAnimationFrame(stepScroll);
    }
  };

  window.requestAnimationFrame(stepScroll);
}

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
  previewShellElementId: string;
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
 * 对预览根节点执行内容 hydrate（图片加载态、代码块包裹等）。
 * 在 detached 节点（morphdom 合并前）与 live DOM（合并后）两个阶段均会调用：
 * 前者让代码块等结构提前对齐，后者负责把交互绑回真正渲染的节点上。
 * 关键步骤：浮动工具栏不在此挂载 —— 它需挂在满宽外壳（shell）而非带边框/居中的 .scribdown-markdown 根节点上，
 * 否则目录折叠时侧栏会贴着根节点内容左缘漏出一截；工具栏由 {@link applyRenderedContent} 在 morphdom 后统一挂载。
 * @param rootElement 预览根节点。
 */
function hydratePreviewRoot(rootElement: Element): void {
  // 关键步骤：注入宿主自己的平滑滚动实现（手动 rAF），适配 webview 原生平滑被降级的问题。
  hydrateMarkdown(rootElement, { scrollToHeading: scrollHeadingIntoViewSmoothly });
}

// /**
//  * 预览滚动调试日志前缀，便于在 Webview 控制台按此关键字过滤。
//  */
// const PREVIEW_SCROLL_LOG_PREFIX = "[scribdown:preview-scroll]";

// /**
//  * 打印一条预览滚动调试日志，用于排查滚动由哪个来源触发。
//  * @param trigger 触发滚动的来源标识。
//  * @param detail 附加的调试信息。
//  */
// function logPreviewScroll(trigger: string, detail: Record<string, unknown>): void {
//   console.log(PREVIEW_SCROLL_LOG_PREFIX, trigger, detail);
// }

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
  // 预览满宽外壳节点，浮动工具栏与目录侧栏的挂载点。
  const previewShellElement = document.getElementById(options.previewShellElementId);

  if (!previewRootElement || !previewBaseElement || !previewShellElement) {
    return;
  }

  // 关键步骤：VS Code Webview 文档承载于 iframe 且设置了 <base href="…vscode-resource…">，
  // 原生点击 <a href="#id">（目录、行内 [TOC]、脚注等同文档锚点）会把 hash 解析到 base 上、
  // 触发 iframe 导航，被 CSP "frame-src 'self'" 拦截而报错。
  // 这里在「捕获阶段」统一拦截同文档锚点点击——捕获先于元素自身的冒泡监听执行，
  // 不受目录分支链接 stopPropagation 影响——改为 JS 平滑滚动到目标，规避导航。
  previewShellElement.addEventListener(
    "click",
    (event) => {
      // 命中的锚点元素（点击可能落在其内部子节点上，向上就近匹配）。
      const anchorElement =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchorElement instanceof HTMLAnchorElement)) {
        return;
      }
      // 原始 href 文本：仅处理形如 "#id" 的同文档锚点，放过空 hash 与外链。
      const rawHref = anchorElement.getAttribute("href");
      if (!rawHref || rawHref.length < 2 || rawHref.charAt(0) !== "#") {
        return;
      }
      // 关键步骤：目录标题链接（class 对应 markdown-renderer 的 TOC_LINK_CLASS_NAME）由渲染器
      // 在「冒泡阶段」自行 scrollIntoView 平滑滚动；本拦截器处于「捕获阶段」，实测在此调用
      // scrollIntoView 会被 webview 降级为瞬时滚动，故对目录链接放行，避免抢先做瞬时滚动。
      if (anchorElement.classList.contains(TOC_LINK_CLASS_NAME)) {
        return;
      }
      // 锚点 id（去掉前导 #）：优先按原文匹配，失败再尝试解码兜底（兼容被编码的中文 id）。
      const rawTargetId = rawHref.slice(1);
      let targetElement = document.getElementById(rawTargetId);
      if (!targetElement) {
        try {
          targetElement = document.getElementById(decodeURIComponent(rawTargetId));
        } catch {
          targetElement = null;
        }
      }
      if (!targetElement) {
        return;
      }
      // 关键步骤：阻止原生 hash 导航，改用 JS 滚动定位，规避 CSP frame-src 拦截。
      event.preventDefault();
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    true
  );

  // 滚动上报的 rAF 节流句柄，0 表示当前无待处理帧。
  let scrollReportFrameHandle = 0;
  // 程序化滚动后的实际纵向位置，用于跳过自身触发的 scroll 回声；undefined 表示无待跳过回声。
  let suppressedScrollY: number | undefined;
  // 当前光标定位高亮的元素；undefined 表示当前无高亮元素。
  let activeHighlightElement: HTMLElement | undefined;
  // 上次离屏提示所在边缘；undefined 表示高亮块当前在视口内。
  let lastOffscreenHintEdge: "top" | "bottom" | undefined;
  // 源码行锚点索引，缓存锚点测量结果。
  const anchorIndex = createSourceLineAnchorIndex(previewRootElement);

  // 关键步骤：光标定位高亮采用独立浮层，覆盖在目标块之上，不向预览内容 DOM 注入 class。
  const cursorHighlightOverlay = document.createElement("div");
  cursorHighlightOverlay.classList.add(SOURCE_LINE_ACTIVE_CLASS_NAME);
  cursorHighlightOverlay.style.display = "none";
  document.body.appendChild(cursorHighlightOverlay);

  // 关键步骤：高亮块在视口外时，用贴边的弧形辉光浮层提示其方向。
  const offscreenHintOverlay = document.createElement("div");
  offscreenHintOverlay.classList.add(SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME);
  document.body.appendChild(offscreenHintOverlay);

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

  /**
   * 在指定边缘闪一次弧形辉光，提示视口外高亮块的方向。
   * @param edge 提示所在边缘：top 表示高亮块在上方，bottom 表示在下方。
   */
  const flashOffscreenHint = (edge: "top" | "bottom"): void => {
    // 目标边缘对应的修饰 class。
    const edgeClassName =
      edge === "top"
        ? SOURCE_LINE_OFFSCREEN_HINT_TOP_CLASS_NAME
        : SOURCE_LINE_OFFSCREEN_HINT_BOTTOM_CLASS_NAME;

    offscreenHintOverlay.className = `${SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME} ${edgeClassName}`;

    // 关键步骤：浮层为复用元素，重置动画以便每次都重新触发闪烁。
    offscreenHintOverlay.style.animation = "none";
    void offscreenHintOverlay.offsetWidth;
    offscreenHintOverlay.style.animation = "";
  };

  /**
   * 判断当前高亮块是否在视口外，必要时在对应边缘闪一次方向提示。
   * @param force 为 true 时只要在视口外就闪（用于光标移动）；
   *   为 false 时仅在「进入视口外」或「方向翻转」的状态切换时闪（用于滚动）。
   */
  const evaluateOffscreenHint = (force: boolean): void => {
    if (!activeHighlightElement) {
      lastOffscreenHintEdge = undefined;
      return;
    }

    // 高亮块相对视口的矩形。
    const rect = activeHighlightElement.getBoundingClientRect();
    // 高亮块所在边缘：完全在视口上方为 top，完全在下方为 bottom，部分可见为 undefined。
    const edge: "top" | "bottom" | undefined =
      rect.bottom <= 0 ? "top" : rect.top >= window.innerHeight ? "bottom" : undefined;

    if (edge && (force || edge !== lastOffscreenHintEdge)) {
      flashOffscreenHint(edge);
    }

    lastOffscreenHintEdge = edge;
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
      applyRenderedContent(
        previewRootElement,
        previewBaseElement,
        previewShellElement,
        normalizedMessage
      );
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

      // 关键步骤：光标消息只更新高亮浮层，不触发滚动；滚动统一由编辑器可视区同步驱动。
      showCursorHighlight(targetElement);

      // 关键步骤：光标移动是显式操作，只要高亮块在视口外就闪一次方向提示。
      evaluateOffscreenHint(true);

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

        // 当前 scroll 事件是否为程序化滚动自身触发的回声。
        const isProgrammaticEcho =
          suppressedScrollY !== undefined &&
          Math.abs(window.scrollY - suppressedScrollY) < 1;

        // logPreviewScroll(isProgrammaticEcho ? "programmatic-echo" : "user-scroll", {
        //   scrollY: window.scrollY,
        //   suppressedScrollY
        // });

        // 关键步骤：滚动可能让高亮块移出视口，在「进入视口外/方向翻转」时闪一次方向提示。
        evaluateOffscreenHint(false);

        // 关键步骤：跳过程序化滚动自身触发的 scroll 回声，避免无谓的往返消息。
        if (isProgrammaticEcho) {
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
 * @param previewShellElement 满宽外壳节点，作为浮动工具栏与目录侧栏的挂载点。
 * @param message 标准化渲染消息。
 */
function applyRenderedContent(
  previewRootElement: HTMLElement,
  previewBaseElement: HTMLBaseElement,
  previewShellElement: HTMLElement,
  message: NormalizedRuntimeMessage
): void {
  // 下一次生效的 base href。
  const nextBaseHref = message.baseHref ?? "";
  // 下一次生效的 HTML 字符串。
  const nextRenderedHtml = message.renderedHtml ?? "";

  previewBaseElement.setAttribute("href", nextBaseHref);

  // 关键步骤：在游离节点上构建并 hydrate 新内容，使代码块等结构与现有 DOM 对齐，
  // morphdom 才能逐节点比对而非按标签差异整块销毁重建。
  /** 用于构建下一次预览快照的游离节点；标签与 previewRootElement 保持一致。 */
  const incomingRoot = previewRootElement.ownerDocument.createElement(
    previewRootElement.tagName
  );
  incomingRoot.innerHTML = nextRenderedHtml;
  hydratePreviewRoot(incomingRoot);

  // 关键步骤：增量更新预览 DOM，仅替换真正变化的节点，
  // 未变节点原地保留，避免整体替换 innerHTML 造成的闪烁、图片重载与滚动抖动。
  morphdom(previewRootElement, incomingRoot, { childrenOnly: true });

  // 关键步骤：morphdom 同步属性会抹掉 hydration 运行时写入的图片加载状态类，
  // 重新 hydrate 由 updateMarkdownImageState 依据真实加载结果纠正；
  // 代码块 hydrate 带幂等守卫，已包裹的块会被跳过。
  hydratePreviewRoot(previewRootElement);

  // 关键步骤：内容落到 live DOM 后，把浮动工具栏（含按当前标题构建的目录）挂到满宽外壳上。
  // mountMarkdownToolbar 幂等：会先清理旧实例，再依据最新标题重建目录侧栏。
  // 注入宿主自己的平滑滚动实现，使侧栏目录跳转与行内 [TOC] 一致平滑。
  mountMarkdownToolbar(previewShellElement, { scrollToHeading: scrollHeadingIntoViewSmoothly });
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

  // 目标纵向位置：源码行锚点换算出的文档像素偏移。
  const targetY = resolveSourceLineOffsetTop(anchors, sourceLine);

  window.scrollTo(0, targetY);

  // logPreviewScroll("set-preview-scroll", {
  //   sourceLine,
  //   targetY,
  //   scrolledY: window.scrollY
  // });

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
