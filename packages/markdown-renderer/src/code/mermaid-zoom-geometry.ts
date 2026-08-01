/**
 * Mermaid 正文与全屏查看器共用的内容自适应缩放边界计算。
 */

/** Mermaid 节点文字在最大缩放状态下的目标检查高度。 */
const MERMAID_INSPECT_TEXT_HEIGHT = 80;

/** Mermaid 完整适配视口时对应的相对缩放倍数。 */
const MERMAID_FIT_VIEW_ZOOM = 1;

/** Mermaid 节点与分组标签的文字选择器。 */
const MERMAID_NODE_TEXT_SELECTOR =
  ".node text, .node tspan, .nodeLabel, .nodeLabel *, .cluster-label text, .cluster-label span";

/** Mermaid 通用文字选择器，用于无法匹配节点标签时的测量兜底。 */
const MERMAID_FALLBACK_TEXT_SELECTOR = "svg text, svg tspan, svg foreignObject";

/**
 * Mermaid 缩放边界。
 */
interface MarkdownMermaidZoomBounds {
  /** 完整适配图表时的最小缩放倍数。 */
  min: number;
  /** 根据当前图表内容计算的最大缩放倍数。 */
  max: number;
}

/**
 * Mermaid 自适应缩放边界计算参数。
 */
interface MarkdownMermaidZoomBoundsOptions {
  /** 当前相对缩放倍数。 */
  currentZoom: number;
  /** 图表固有尺寸适配视口所需的绝对缩放比例。 */
  fitScale: number;
  /** 图表固有宽度。 */
  naturalWidth: number;
  /** 图表固有高度。 */
  naturalHeight: number;
  /** 当前缩放状态下可测得的文字高度列表。 */
  textHeights: number[];
}

/**
 * 限制 Mermaid 缩放倍数。
 * @param zoomValue 待限制的缩放倍数。
 * @param zoomBounds 当前图表的动态缩放边界。
 * @returns 限制后的缩放倍数。
 */
function clampMarkdownMermaidZoom(
  zoomValue: number,
  zoomBounds: MarkdownMermaidZoomBounds
): number {
  return Math.min(zoomBounds.max, Math.max(zoomBounds.min, zoomValue));
}

/**
 * 读取 Mermaid 画布中可见文字的高度。
 * @param canvasElement Mermaid SVG 挂载画布。
 * @returns 优先来自节点标签的可见文字高度列表。
 */
function readMarkdownMermaidTextHeights(canvasElement: HTMLElement): number[] {
  /** 优先参与测量的 Mermaid 节点文字元素。 */
  const nodeTextElements = Array.from(canvasElement.querySelectorAll(MERMAID_NODE_TEXT_SELECTOR));
  /** 实际参与测量的文字元素。 */
  const textElements =
    nodeTextElements.length > 0
      ? nodeTextElements
      : Array.from(canvasElement.querySelectorAll(MERMAID_FALLBACK_TEXT_SELECTOR));

  return textElements
    .filter((textElement) => (textElement.textContent ?? "").trim().length > 0)
    .map((textElement) => textElement.getBoundingClientRect().height);
}

/**
 * 基于 Mermaid 图表尺寸与实际文字高度计算内容自适应缩放边界。
 * @param options 当前图表的尺寸与测量结果。
 * @returns 当前图表适用的动态缩放边界。
 */
function getMarkdownMermaidZoomBounds(
  options: MarkdownMermaidZoomBoundsOptions
): MarkdownMermaidZoomBounds {
  /** 可用于计算的正数文字高度，排序后取中位数以规避异常小元素。 */
  const measurableTextHeights = options.textHeights
    .filter((textHeight) => Number.isFinite(textHeight) && textHeight > 0)
    .sort((firstHeight, secondHeight) => firstHeight - secondHeight);
  /** 当前缩放倍数的安全值。 */
  const currentZoom = Math.max(options.currentZoom, Number.EPSILON);
  /** 图表适配视口绝对缩放比例的安全值。 */
  const fitScale = Math.max(options.fitScale, Number.EPSILON);
  /** 根据图表内容推导出的最大缩放倍数。 */
  let maximumZoom: number;

  if (measurableTextHeights.length > 0) {
    /** 当前图表文字高度的中位数。 */
    const medianTextHeight =
      measurableTextHeights[Math.floor(measurableTextHeights.length / 2)];
    maximumZoom = (currentZoom * MERMAID_INSPECT_TEXT_HEIGHT) / medianTextHeight;
  } else {
    /** 无文字可测时，使用图表最长边平方根作为绝对缩放上限。 */
    const fallbackAbsoluteScale = Math.sqrt(
      Math.max(1, options.naturalWidth, options.naturalHeight)
    );
    maximumZoom = fallbackAbsoluteScale / fitScale;
  }

  return {
    min: MERMAID_FIT_VIEW_ZOOM,
    max: Math.max(MERMAID_FIT_VIEW_ZOOM, maximumZoom)
  };
}

export type { MarkdownMermaidZoomBounds, MarkdownMermaidZoomBoundsOptions };
export {
  clampMarkdownMermaidZoom,
  getMarkdownMermaidZoomBounds,
  readMarkdownMermaidTextHeights,
  MERMAID_FIT_VIEW_ZOOM
};
