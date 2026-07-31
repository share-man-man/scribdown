/**
 * Mermaid 全屏查看器：每个 document 复用一个 dialog 单例，
 * 注入渲染缓存的 SVG 源码，支持缩放、拖拽平移与键盘操作。
 */

import {
  MERMAID_CONTROL_BUTTON_CLASS_NAME,
  MERMAID_VIEWER_BUTTON_CLASS_NAME,
  MERMAID_VIEWER_CANVAS_CLASS_NAME,
  MERMAID_VIEWER_CAPTION_CLASS_NAME,
  MERMAID_VIEWER_CHROME_CLASS_NAME,
  MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME,
  MERMAID_VIEWER_CONTROLS_CLASS_NAME,
  MERMAID_VIEWER_DIALOG_CLASS_NAME,
  MERMAID_VIEWER_DRAG_MODE_CLASS_NAME,
  MERMAID_VIEWER_DRAGGING_CLASS_NAME,
  MERMAID_VIEWER_VIEWPORT_CLASS_NAME,
  MERMAID_VIEWER_ZOOMED_CLASS_NAME,
  MERMAID_VIEWER_ZOOM_VALUE_CLASS_NAME,
  MERMAID_ZOOM_GROUP_CLASS_NAME,
  MERMAID_ZOOM_VALUE_CLASS_NAME,
  VIEWER_CONTROL_BUTTON_CLASS_NAME,
  t
} from "@scribdown/shared";

import {
  VIEWER_CLOSE_TEXT,
  VIEWER_DEFAULT_ZOOM,
  VIEWER_FIT_RATIO,
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
  VIEWER_WHEEL_ZOOM_FACTOR,
  VIEWER_WHEEL_ZOOM_MAX_DELTA,
  VIEWER_ZOOM_STEP,
  clampMarkdownViewerZoom,
  type MarkdownViewerFocalPoint,
  type MarkdownViewerZoomAnchor
} from "../core/viewer-shared";
import { copyMarkdownTextWithFeedback, createMarkdownCopyButton } from "../core/copy-control";
import {
  createMarkdownViewerControlButton,
  createMarkdownViewerZoomControls,
  VIEWER_DRAG_MODE_ICON_SVG,
  VIEWER_RESET_ZOOM_ICON_SVG,
  VIEWER_SELECT_MODE_ICON_SVG
} from "../core/viewer-controls";

// Mermaid 顶部展示标签（figure chrome 与全屏查看器 caption 共用）。
// 安家在查看器侧而非 mermaid.ts：mermaid.ts 已依赖本模块的 openMarkdownMermaidViewer，
// 反向导出会构成循环依赖。
const MERMAID_LABEL_TEXT = "Mermaid";

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
  /** 选择 / 拖拽模式按钮。 */
  modeButtonElement: HTMLButtonElement;
  /** 缩放比例显示节点。 */
  zoomValueElement: HTMLElement;
  /** 缩小按钮。 */
  zoomOutButtonElement: HTMLButtonElement;
  /** 放大按钮。 */
  zoomInButtonElement: HTMLButtonElement;
  /** 重置按钮。 */
  resetButtonElement: HTMLButtonElement;
  /** Mermaid 源码复制按钮。 */
  copyButtonElement: HTMLButtonElement;
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
  /** 当前全屏图表对应的 Mermaid 源码。 */
  mermaidSource: string;
  /** 当前是否处于鼠标拖拽平移状态。 */
  isDragging: boolean;
  /** 当前是否为拖拽模式。 */
  isDragMode: boolean;
  /** 拖拽起始时鼠标的客户端 X 坐标。 */
  dragStartClientX: number;
  /** 拖拽起始时鼠标的客户端 Y 坐标。 */
  dragStartClientY: number;
  /** 拖拽起始时视口的横向滚动量。 */
  dragStartScrollLeft: number;
  /** 拖拽起始时视口的纵向滚动量。 */
  dragStartScrollTop: number;
}

/**
 * 打开 mermaid 全屏查看器。
 * @param ownerDocument 当前 figure 所在 document。
 * @param svgSource 缓存的 SVG HTML 源码。
 * @param mermaidSource 图表对应的 Mermaid 源码。
 */
function openMarkdownMermaidViewer(
  ownerDocument: Document,
  svgSource: string,
  mermaidSource: string
): void {
  // 当前 document 对应的查看器状态（单例）。
  const viewerState = getOrCreateMarkdownMermaidViewerState(ownerDocument);

  // 关键步骤：注入 SVG 并解析固有尺寸，做为 fit + 缩放计算基准。
  viewerState.canvasElement.innerHTML = svgSource;
  const svgDimensions = readSvgNaturalDimensions(viewerState.canvasElement);
  viewerState.naturalWidth = svgDimensions.width;
  viewerState.naturalHeight = svgDimensions.height;
  viewerState.viewportElement.scrollLeft = 0;
  viewerState.viewportElement.scrollTop = 0;
  viewerState.zoomValue = VIEWER_DEFAULT_ZOOM;
  viewerState.mermaidSource = mermaidSource;
  setMarkdownMermaidViewerDragMode(viewerState, false);

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
  /** 选择 / 拖拽模式切换按钮。 */
  const modeButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.switchToDrag"),
    VIEWER_SELECT_MODE_ICON_SVG,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME, MERMAID_VIEWER_BUTTON_CLASS_NAME]
  );
  modeButtonElement.setAttribute("aria-pressed", "false");
  /** 与非全屏复用的缩放按钮组及子节点。 */
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
    [MERMAID_CONTROL_BUTTON_CLASS_NAME, MERMAID_VIEWER_BUTTON_CLASS_NAME],
    [MERMAID_ZOOM_VALUE_CLASS_NAME, MERMAID_VIEWER_ZOOM_VALUE_CLASS_NAME]
  );
  /** 重置按钮。 */
  const resetButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.zoomReset"),
    VIEWER_RESET_ZOOM_ICON_SVG,
    [MERMAID_CONTROL_BUTTON_CLASS_NAME, MERMAID_VIEWER_BUTTON_CLASS_NAME]
  );
  /** Mermaid 源码复制按钮。 */
  const copyButtonElement = createMarkdownCopyButton(ownerDocument);
  copyButtonElement.classList.add(
    VIEWER_CONTROL_BUTTON_CLASS_NAME,
    MERMAID_CONTROL_BUTTON_CLASS_NAME,
    MERMAID_VIEWER_BUTTON_CLASS_NAME
  );
  /** 关闭按钮。 */
  const closeButtonElement = createMarkdownViewerControlButton(
    ownerDocument,
    t("mermaid.close"),
    VIEWER_CLOSE_TEXT,
    [MERMAID_VIEWER_BUTTON_CLASS_NAME, MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME]
  );
  /** 滚动视口。 */
  const viewportElement = ownerDocument.createElement("div");
  /** SVG 画布。 */
  const canvasElement = ownerDocument.createElement("div");

  /** 查看器运行时状态。 */
  const viewerState: MarkdownMermaidViewerState = {
    dialogElement,
    captionElement,
    modeButtonElement,
    zoomValueElement,
    zoomOutButtonElement,
    zoomInButtonElement,
    resetButtonElement,
    copyButtonElement,
    closeButtonElement,
    viewportElement,
    canvasElement,
    naturalWidth: 720,
    naturalHeight: 480,
    zoomValue: VIEWER_DEFAULT_ZOOM,
    mermaidSource: "",
    isDragging: false,
    isDragMode: false,
    dragStartClientX: 0,
    dragStartClientY: 0,
    dragStartScrollLeft: 0,
    dragStartScrollTop: 0
  };
  /** 当前 document 对应的 window。 */
  const ownerWindow = ownerDocument.defaultView;

  dialogElement.className = MERMAID_VIEWER_DIALOG_CLASS_NAME;
  dialogElement.setAttribute("aria-modal", "true");
  dialogElement.setAttribute("aria-label", t("mermaid.fullscreen"));
  dialogElement.setAttribute("tabindex", "-1");
  chromeElement.className = MERMAID_VIEWER_CHROME_CLASS_NAME;
  captionElement.className = MERMAID_VIEWER_CAPTION_CLASS_NAME;
  captionElement.textContent = MERMAID_LABEL_TEXT;
  controlsElement.className = MERMAID_VIEWER_CONTROLS_CLASS_NAME;
  viewportElement.className = MERMAID_VIEWER_VIEWPORT_CLASS_NAME;
  canvasElement.className = MERMAID_VIEWER_CANVAS_CLASS_NAME;

  mermaidViewerStateByDialogElement.set(dialogElement, viewerState);
  controlsElement.append(
    modeButtonElement,
    zoomGroupElement,
    resetButtonElement,
    copyButtonElement,
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
  modeButtonElement.addEventListener("click", handleMarkdownMermaidViewerModeClick);
  zoomOutButtonElement.addEventListener("click", handleMarkdownMermaidViewerZoomOutClick);
  zoomInButtonElement.addEventListener("click", handleMarkdownMermaidViewerZoomInClick);
  resetButtonElement.addEventListener("click", handleMarkdownMermaidViewerResetClick);
  copyButtonElement.addEventListener("click", handleMarkdownMermaidViewerCopyClick);
  closeButtonElement.addEventListener("click", handleMarkdownMermaidViewerCloseClick);

  if (ownerWindow) {
    ownerWindow.addEventListener("resize", handleMarkdownMermaidViewerWindowResize);
  }

  updateMarkdownMermaidViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);

  return viewerState;
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
function handleMarkdownMermaidViewerDeferredLayout(viewerState: MarkdownMermaidViewerState): void {
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
  viewerState.zoomValue = VIEWER_DEFAULT_ZOOM;
  viewerState.mermaidSource = "";
  viewerState.isDragging = false;
  viewerState.isDragMode = false;
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_DRAGGING_CLASS_NAME);
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_DRAG_MODE_CLASS_NAME);
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
    updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue + VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue - VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "0") {
    event.preventDefault();
    updateMarkdownMermaidViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);
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
  const rawDelta = -event.deltaY * VIEWER_WHEEL_ZOOM_FACTOR;
  const zoomDelta = Math.max(
    -VIEWER_WHEEL_ZOOM_MAX_DELTA,
    Math.min(VIEWER_WHEEL_ZOOM_MAX_DELTA, rawDelta)
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
  if (!viewerState || !viewerState.isDragMode) {
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
 * 处理 Mermaid 全屏选择 / 拖拽模式切换。
 * @param event 模式按钮点击事件。
 */
function handleMarkdownMermaidViewerModeClick(event: MouseEvent): void {
  // 当前全屏查看器状态。
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  setMarkdownMermaidViewerDragMode(viewerState, !viewerState.isDragMode);
}

/**
 * 设置 Mermaid 全屏查看器模式并同步图标与可访问名称。
 * @param viewerState 当前全屏查看器状态。
 * @param isDragMode 是否启用拖拽模式。
 */
function setMarkdownMermaidViewerDragMode(
  viewerState: MarkdownMermaidViewerState,
  isDragMode: boolean
): void {
  viewerState.isDragMode = isDragMode;
  viewerState.isDragging = false;
  viewerState.dialogElement.classList.toggle(MERMAID_VIEWER_DRAG_MODE_CLASS_NAME, isDragMode);
  viewerState.dialogElement.classList.remove(MERMAID_VIEWER_DRAGGING_CLASS_NAME);
  viewerState.modeButtonElement.innerHTML = isDragMode
    ? VIEWER_DRAG_MODE_ICON_SVG
    : VIEWER_SELECT_MODE_ICON_SVG;
  viewerState.modeButtonElement.setAttribute("aria-pressed", String(isDragMode));

  // 按钮名称描述点击后的动作，图标和 aria-pressed 表达当前模式。
  const modeActionLabel = isDragMode ? t("mermaid.switchToSelect") : t("mermaid.switchToDrag");
  viewerState.modeButtonElement.setAttribute("aria-label", modeActionLabel);
  viewerState.modeButtonElement.setAttribute("title", modeActionLabel);
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
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue - VIEWER_ZOOM_STEP);
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
  updateMarkdownMermaidViewerZoom(viewerState, viewerState.zoomValue + VIEWER_ZOOM_STEP);
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
  updateMarkdownMermaidViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);
}

/**
 * 处理 Mermaid 源码复制按钮点击。
 * @param event 按钮点击事件。
 */
function handleMarkdownMermaidViewerCopyClick(event: MouseEvent): void {
  // 当前全屏查看器状态。
  const viewerState = getMarkdownMermaidViewerStateFromEvent(event);
  if (!viewerState) {
    return;
  }
  void copyMarkdownTextWithFeedback(viewerState.copyButtonElement, viewerState.mermaidSource);
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
  zoomAnchor?: MarkdownViewerZoomAnchor
): void {
  /** 归一化的缩放倍数。 */
  const normalizedZoom = clampMarkdownViewerZoom(nextZoom);
  /** 缩放前的焦点。 */
  const focalPoint = isMarkdownMermaidViewerOpen(viewerState)
    ? captureMarkdownMermaidViewerFocalPoint(viewerState, zoomAnchor)
    : undefined;

  viewerState.zoomValue = normalizedZoom;
  viewerState.dialogElement.classList.toggle(
    MERMAID_VIEWER_ZOOMED_CLASS_NAME,
    normalizedZoom > VIEWER_DEFAULT_ZOOM
  );
  viewerState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  viewerState.zoomOutButtonElement.disabled = normalizedZoom <= VIEWER_MIN_ZOOM;
  viewerState.zoomInButtonElement.disabled = normalizedZoom >= VIEWER_MAX_ZOOM;
  viewerState.resetButtonElement.disabled = normalizedZoom === VIEWER_DEFAULT_ZOOM;
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
  zoomAnchor?: MarkdownViewerZoomAnchor
): MarkdownViewerFocalPoint | undefined {
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
  focalPoint: MarkdownViewerFocalPoint
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
  const viewportWidth = Math.max(viewerState.viewportElement.clientWidth * VIEWER_FIT_RATIO, 1);
  const viewportHeight = Math.max(viewerState.viewportElement.clientHeight * VIEWER_FIT_RATIO, 1);
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

export { openMarkdownMermaidViewer, readSvgNaturalDimensions, MERMAID_LABEL_TEXT };
