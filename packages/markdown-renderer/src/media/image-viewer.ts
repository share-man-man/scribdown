/**
 * 图片全图查看器：每个 document 复用一个 dialog 单例，
 * 支持缩放、拖拽平移、键盘操作与焦点保持。
 */

import {
  IMAGE_VIEWER_BUTTON_CLASS_NAME,
  IMAGE_VIEWER_CAPTION_CLASS_NAME,
  IMAGE_VIEWER_CAPTION_GROUP_CLASS_NAME,
  IMAGE_VIEWER_CHROME_CLASS_NAME,
  IMAGE_VIEWER_CLOSE_BUTTON_CLASS_NAME,
  IMAGE_VIEWER_CONTROLS_CLASS_NAME,
  IMAGE_VIEWER_DIALOG_CLASS_NAME,
  IMAGE_VIEWER_DRAGGING_CLASS_NAME,
  IMAGE_VIEWER_HINT_CLASS_NAME,
  IMAGE_VIEWER_IMAGE_CLASS_NAME,
  IMAGE_VIEWER_VIEWPORT_CLASS_NAME,
  IMAGE_VIEWER_ZOOMED_CLASS_NAME,
  IMAGE_VIEWER_ZOOM_VALUE_CLASS_NAME,
  t
} from "@scribdown/shared";

import {
  VIEWER_CLOSE_TEXT,
  VIEWER_DEFAULT_ZOOM,
  VIEWER_FIT_RATIO,
  VIEWER_MAX_ZOOM,
  VIEWER_MIN_ZOOM,
  VIEWER_RESET_TEXT,
  VIEWER_WHEEL_ZOOM_FACTOR,
  VIEWER_WHEEL_ZOOM_MAX_DELTA,
  VIEWER_ZOOM_IN_TEXT,
  VIEWER_ZOOM_OUT_TEXT,
  VIEWER_ZOOM_STEP,
  clampMarkdownViewerZoom,
  type MarkdownViewerButtonOptions,
  type MarkdownViewerFocalPoint,
  type MarkdownViewerZoomAnchor
} from "../core/viewer-shared";

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

// 每个 document 复用一个图片查看器。
const imageViewerStateByDocument = new WeakMap<Document, MarkdownImageViewerState>();

// 从 dialog 反查图片查看器状态。
const imageViewerStateByDialogElement = new WeakMap<HTMLDialogElement, MarkdownImageViewerState>();

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
  viewerState.zoomValue = VIEWER_DEFAULT_ZOOM;

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
    ariaLabel: t("image.zoomOut"),
    text: VIEWER_ZOOM_OUT_TEXT
  });
  // 当前缩放比例文本。
  const zoomValueElement = ownerDocument.createElement("span");
  // 放大按钮。
  const zoomInButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: t("image.zoomIn"),
    text: VIEWER_ZOOM_IN_TEXT
  });
  // 重置缩放按钮。
  const resetButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: t("image.zoomReset"),
    text: VIEWER_RESET_TEXT
  });
  // 关闭按钮。
  const closeButtonElement = createMarkdownImageViewerButton(ownerDocument, {
    ariaLabel: t("image.close"),
    className: IMAGE_VIEWER_CLOSE_BUTTON_CLASS_NAME,
    text: VIEWER_CLOSE_TEXT
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
    zoomValue: VIEWER_DEFAULT_ZOOM,
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
  hintElement.textContent = t("image.hint");
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

  updateMarkdownImageViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);

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
  options: MarkdownViewerButtonOptions
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
    updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue + VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue - VIEWER_ZOOM_STEP);
    return;
  }

  if (event.key === "0") {
    event.preventDefault();
    updateMarkdownImageViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);
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
  const rawDelta = -event.deltaY * VIEWER_WHEEL_ZOOM_FACTOR;
  const zoomDelta = Math.max(
    -VIEWER_WHEEL_ZOOM_MAX_DELTA,
    Math.min(VIEWER_WHEEL_ZOOM_MAX_DELTA, rawDelta)
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

  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue - VIEWER_ZOOM_STEP);
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

  updateMarkdownImageViewerZoom(viewerState, viewerState.zoomValue + VIEWER_ZOOM_STEP);
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

  updateMarkdownImageViewerZoom(viewerState, VIEWER_DEFAULT_ZOOM);
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
  zoomAnchor?: MarkdownViewerZoomAnchor
): void {
  // 归一化后的缩放倍数。
  const normalizedZoom = clampMarkdownViewerZoom(nextZoom);
  // 缩放前的焦点信息，用于恢复光标/视口中心在新尺寸下的相对位置。
  const focalPoint = isMarkdownImageViewerOpen(viewerState)
    ? captureMarkdownImageViewerFocalPoint(viewerState, zoomAnchor)
    : undefined;

  viewerState.zoomValue = normalizedZoom;
  viewerState.dialogElement.classList.toggle(
    IMAGE_VIEWER_ZOOMED_CLASS_NAME,
    normalizedZoom > VIEWER_DEFAULT_ZOOM
  );
  viewerState.zoomValueElement.textContent = `${Math.round(normalizedZoom * 100)}%`;
  viewerState.zoomOutButtonElement.disabled = normalizedZoom <= VIEWER_MIN_ZOOM;
  viewerState.zoomInButtonElement.disabled = normalizedZoom >= VIEWER_MAX_ZOOM;
  viewerState.resetButtonElement.disabled = normalizedZoom === VIEWER_DEFAULT_ZOOM;
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
  zoomAnchor?: MarkdownViewerZoomAnchor
): MarkdownViewerFocalPoint | undefined {
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
  focalPoint: MarkdownViewerFocalPoint
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
  const viewportWidth = Math.max(viewerState.viewportElement.clientWidth * VIEWER_FIT_RATIO, 1);
  // 视口可用高度。
  const viewportHeight = Math.max(viewerState.viewportElement.clientHeight * VIEWER_FIT_RATIO, 1);
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
  viewerState.zoomValue = VIEWER_DEFAULT_ZOOM;

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
    return t("image.viewFull");
  }

  // 带标题时用整条含分隔符的文案，使全/半角分隔符随语言变化。
  return t("image.viewFullOf", { alt: imageAltText });
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

export { bindMarkdownImageViewer };
