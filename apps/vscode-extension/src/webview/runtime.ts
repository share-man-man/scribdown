import { hydrateMarkdownPreview } from "@scribdown/markdown-renderer";

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
  scrollPercentage?: number;
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
      syncPreviewScroll(normalizedMessage.scrollPercentage);
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      // 当前页面最大可滚动高度。
      const maxScrollTop = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0
      );
      // 当前滚动百分比。
      const scrollPercentage =
        maxScrollTop === 0 ? 0 : clampScrollPercentage(window.scrollY / maxScrollTop);

      vscodeApi.postMessage({
        type: options.previewScrollChangedMessageType,
        scrollPercentage
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
  // 滚动百分比字段。
  const scrollPercentageField = messageRecord.scrollPercentage;

  return {
    type: messageTypeField,
    baseHref: typeof baseHrefField === "string" ? baseHrefField : undefined,
    renderedHtml: typeof renderedHtmlField === "string" ? renderedHtmlField : undefined,
    scrollPercentage:
      typeof scrollPercentageField === "number" ? scrollPercentageField : undefined
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
 * 按指定百分比同步预览滚动位置。
 * @param scrollPercentage 目标滚动百分比。
 */
function syncPreviewScroll(scrollPercentage: number | undefined): void {
  // 归一化滚动百分比。
  const normalizedScrollPercentage = clampScrollPercentage(scrollPercentage ?? 0);
  // 页面最大可滚动高度。
  const maxScrollTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

  window.scrollTo(0, maxScrollTop * normalizedScrollPercentage);
}

/**
 * 约束滚动百分比到 0~1。
 * @param value 原始值。
 * @returns 约束后的百分比。
 */
function clampScrollPercentage(value: number): number {
  return Math.min(1, Math.max(0, value));
}
