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

// 查看器默认缩放倍数。
const VIEWER_DEFAULT_ZOOM = 1;

// 查看器最小缩放倍数。
const VIEWER_MIN_ZOOM = 0.25;

// 查看器最大缩放倍数。
const VIEWER_MAX_ZOOM = 4;

// 查看器每次缩放步进。
const VIEWER_ZOOM_STEP = 0.25;

// 滚轮 deltaY 转换为缩放增量的比例系数：触控板单次事件 deltaY 通常较小（个位数），
// 选 0.01 让一次轻微滑动只产生 ~1%-9% 的缩放变化，避免触控板上跳变过大。
const VIEWER_WHEEL_ZOOM_FACTOR = 0.01;

// 单次滚轮事件允许的最大缩放变化量，防止鼠标滚轮一格 deltaY=100 时跳得过远。
const VIEWER_WHEEL_ZOOM_MAX_DELTA = 0.1;

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

export type { MarkdownViewerFocalPoint, MarkdownViewerZoomAnchor, MarkdownViewerButtonOptions };
export {
  VIEWER_DEFAULT_ZOOM,
  VIEWER_MIN_ZOOM,
  VIEWER_MAX_ZOOM,
  VIEWER_ZOOM_STEP,
  VIEWER_WHEEL_ZOOM_FACTOR,
  VIEWER_WHEEL_ZOOM_MAX_DELTA,
  VIEWER_FIT_RATIO,
  VIEWER_CLOSE_TEXT,
  VIEWER_ZOOM_IN_TEXT,
  VIEWER_ZOOM_OUT_TEXT,
  VIEWER_RESET_TEXT,
  clampMarkdownViewerZoom
};
