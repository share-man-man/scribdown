/**
 * 图片 / Mermaid 全屏查看器共用的缩放常量、焦点类型与缩放限制工具。
 */

/**
 * 缩放前记录的视口焦点信息，用于保持光标/视口中心在缩放后位置不变。
 */
interface MarkdownViewerFocalPoint {
  /** 焦点在客户端坐标系的 X。 */
  anchorClientX: number;
  /** 焦点在客户端坐标系的 Y。 */
  anchorClientY: number;
  /** 焦点在内容（图片 / 画布）内的归一化 X (0..1)。 */
  normalizedX: number;
  /** 焦点在内容（图片 / 画布）内的归一化 Y (0..1)。 */
  normalizedY: number;
}

/**
 * 触发缩放时的可选锚点（鼠标客户端坐标）。
 */
interface MarkdownViewerZoomAnchor {
  x: number;
  y: number;
}

/**
 * 全屏查看器按钮配置。
 */
interface MarkdownViewerButtonOptions {
  ariaLabel: string;
  className?: string;
  text: string;
}

/**
 * 不受内部滚动条占位影响的查看器视口尺寸。
 */
interface MarkdownViewerViewportSize {
  /** 视口布局宽度。 */
  width: number;
  /** 视口布局高度。 */
  height: number;
}

// 查看器默认缩放倍数。
const VIEWER_DEFAULT_ZOOM = 1;

// 查看器最小缩放倍数。
const VIEWER_MIN_ZOOM = 0.25;

// 查看器最大缩放倍数。
const VIEWER_MAX_ZOOM = 4;

// 查看器按钮 / 键盘每次缩放相对当前值的步进比例。
const VIEWER_ZOOM_STEP_RATIO = 0.25;

// 滚轮 deltaY 转换为缩放增量的比例系数：触控板单次事件 deltaY 通常较小（个位数），
// 选 0.01 让一次轻微滑动只产生 ~1%-9% 的缩放变化，避免触控板上跳变过大。
const VIEWER_WHEEL_ZOOM_FACTOR = 0.01;

// 单次滚轮事件允许的最大缩放变化比例，防止鼠标滚轮一格 deltaY=100 时跳得过远。
const VIEWER_WHEEL_ZOOM_MAX_RATIO = 0.1;

// 查看器适配视口时预留的安全比例。
const VIEWER_FIT_RATIO = 0.92;

// 查看器关闭按钮文本。
const VIEWER_CLOSE_TEXT = "x";

// 查看器放大按钮文本。
const VIEWER_ZOOM_IN_TEXT = "+";

// 查看器缩小按钮文本。
const VIEWER_ZOOM_OUT_TEXT = "-";

// 查看器重置按钮文本。
const VIEWER_RESET_TEXT = "1:1";

/**
 * 限制查看器缩放倍数。
 * @param zoomValue 待限制的缩放倍数。
 * @returns 限制后的缩放倍数。
 */
function clampMarkdownViewerZoom(zoomValue: number): number {
  return Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, zoomValue));
}

/**
 * 根据当前缩放倍数计算按钮 / 键盘缩放步进。
 * @param zoomValue 当前缩放倍数。
 * @returns 当前缩放倍数对应的动态步进。
 */
function getMarkdownViewerZoomStep(zoomValue: number): number {
  return Math.max(zoomValue, Number.EPSILON) * VIEWER_ZOOM_STEP_RATIO;
}

/**
 * 根据当前缩放倍数与滚轮位移计算下一缩放倍数。
 * @param zoomValue 当前缩放倍数。
 * @param deltaY 滚轮纵向位移。
 * @returns 按当前缩放比例变化后的目标缩放倍数。
 */
function getMarkdownViewerWheelZoom(zoomValue: number, deltaY: number): number {
  /** 滚轮位移转换后的原始缩放变化比例。 */
  const rawZoomRatio = -deltaY * VIEWER_WHEEL_ZOOM_FACTOR;
  /** 限制单次变化后的缩放比例。 */
  const zoomRatio = Math.max(
    -VIEWER_WHEEL_ZOOM_MAX_RATIO,
    Math.min(VIEWER_WHEEL_ZOOM_MAX_RATIO, rawZoomRatio)
  );

  return zoomValue * (1 + zoomRatio);
}

/**
 * 判断带锚点的缩放是否已被边界截断为无变化。
 * @param currentZoom 当前缩放倍数。
 * @param normalizedZoom 应用边界限制后的目标缩放倍数。
 * @param zoomAnchor 可选的缩放锚点。
 * @returns 是否应跳过焦点和滚动位置修正。
 */
function shouldSkipMarkdownViewerAnchoredZoom(
  currentZoom: number,
  normalizedZoom: number,
  zoomAnchor?: MarkdownViewerZoomAnchor
): boolean {
  return zoomAnchor !== undefined && normalizedZoom === currentZoom;
}

/**
 * 读取稳定的查看器视口尺寸。
 *
 * `clientWidth/clientHeight` 会在经典滚动条出现时扣除滚动条宽度，
 * 若它们参与 fitScale 计算，会形成“出现滚动条 → 内容缩小 → 滚动条消失”的布局反馈循环。
 * `offsetWidth/offsetHeight` 表示元素布局外框，不随内部滚动条显隐变化。
 *
 * @param viewportElement 图片或 Mermaid 的滚动视口。
 * @returns 不受内部滚动条占位影响的视口宽高。
 */
function readMarkdownViewerViewportSize(viewportElement: HTMLElement): MarkdownViewerViewportSize {
  /** 视口当前的客户端矩形，供尚未生成 offset 尺寸的宿主环境兜底。 */
  const viewportRect = viewportElement.getBoundingClientRect();
  /** 优先使用稳定的布局宽度，再依次回退到矩形和内容区宽度。 */
  const viewportWidth =
    viewportElement.offsetWidth || viewportRect.width || viewportElement.clientWidth;
  /** 优先使用稳定的布局高度，再依次回退到矩形和内容区高度。 */
  const viewportHeight =
    viewportElement.offsetHeight || viewportRect.height || viewportElement.clientHeight;

  return {
    width: Math.max(viewportWidth, 1),
    height: Math.max(viewportHeight, 1)
  };
}

export type {
  MarkdownViewerFocalPoint,
  MarkdownViewerZoomAnchor,
  MarkdownViewerButtonOptions,
  MarkdownViewerViewportSize
};
export {
  VIEWER_DEFAULT_ZOOM,
  VIEWER_MIN_ZOOM,
  VIEWER_MAX_ZOOM,
  VIEWER_FIT_RATIO,
  VIEWER_CLOSE_TEXT,
  VIEWER_ZOOM_IN_TEXT,
  VIEWER_ZOOM_OUT_TEXT,
  VIEWER_RESET_TEXT,
  clampMarkdownViewerZoom,
  getMarkdownViewerWheelZoom,
  getMarkdownViewerZoomStep,
  readMarkdownViewerViewportSize,
  shouldSkipMarkdownViewerAnchoredZoom
};
