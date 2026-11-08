import {
  CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR,
  CONTENT_DENSITY_PRESETS,
  CONTENT_DENSITY_SPACING_CSS_VAR,
  CONTENT_DENSITY_STORAGE_KEY,
  CONTENT_DENSITY_MIN,
  CONTENT_DENSITY_MAX,
  CONTENT_DENSITY_STEP,
  CONTENT_DENSITY_PERCENT_SCALE,
  DEFAULT_CONTENT_DENSITY
} from "@scribdown/shared";

/**
 * 限制滑块值并吸附步进，非法数值恢复标准排版。
 * @param density 待校验的间距百分比。
 * @returns 可供滑块与 CSS 使用的百分比。
 */
export function normalizeContentDensity(density: number): number {
  if (!Number.isFinite(density)) return DEFAULT_CONTENT_DENSITY;
  return Math.min(
    CONTENT_DENSITY_MAX,
    Math.max(CONTENT_DENSITY_MIN, Math.round(density / CONTENT_DENSITY_STEP) * CONTENT_DENSITY_STEP)
  );
}

/**
 * 读取紧凑程度，兼容原三档选择保存的枚举值。
 * @param ownerDocument 工具栏所属文档。
 * @returns 校验后的间距百分比。
 */
export function loadContentDensity(ownerDocument: Document): number {
  try {
    /** 宿主本地存储中的原始值。 */
    const stored = ownerDocument.defaultView?.localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY);
    if (!stored?.trim()) return DEFAULT_CONTENT_DENSITY;
    /** 旧版档位映射，避免升级后丢失用户选择。 */
    const legacyPreset = CONTENT_DENSITY_PRESETS.find((preset) => preset.value === stored);
    return normalizeContentDensity(
      legacyPreset ? legacyPreset.spacing * CONTENT_DENSITY_PERCENT_SCALE : Number(stored)
    );
  } catch {
    return DEFAULT_CONTENT_DENSITY;
  }
}

/**
 * 保存间距百分比；受限宿主仍可在本次阅读中调整。
 * @param ownerDocument 工具栏所属文档。
 * @param density 用户选择的间距百分比。
 */
export function saveContentDensity(ownerDocument: Document, density: number): void {
  try {
    ownerDocument.defaultView?.localStorage.setItem(
      CONTENT_DENSITY_STORAGE_KEY,
      String(normalizeContentDensity(density))
    );
  } catch {
    // 存储不可用时不阻断滑块交互。
  }
}

/**
 * 用原三档作为插值锚点，连续调整正文间距与行高。
 * @param ownerDocument 工具栏所属文档。
 * @param density 间距百分比，100 表示原标准排版。
 */
export function applyContentDensity(ownerDocument: Document, density: number): void {
  /** 已吸附到滑块步进的间距比例。 */
  const spacing = normalizeContentDensity(density) / CONTENT_DENSITY_PERCENT_SCALE;
  /** 相邻排版锚点，标准档两侧分别插值以保持旧档位视觉效果。 */
  const [lower, upper] =
    spacing <= DEFAULT_CONTENT_DENSITY / CONTENT_DENSITY_PERCENT_SCALE
      ? [CONTENT_DENSITY_PRESETS[0], CONTENT_DENSITY_PRESETS[1]]
      : [CONTENT_DENSITY_PRESETS[1], CONTENT_DENSITY_PRESETS[2]];
  /** 当前间距在两个锚点间的位置。 */
  const progress = (spacing - lower.spacing) / (upper.spacing - lower.spacing);
  /** 插值行高；代码与行号共用同一变量，始终对齐。 */
  const lineHeight = lower.lineHeight + (upper.lineHeight - lower.lineHeight) * progress;
  ownerDocument.documentElement.style.setProperty(CONTENT_DENSITY_SPACING_CSS_VAR, String(spacing));
  ownerDocument.documentElement.style.setProperty(
    CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR,
    String(lineHeight)
  );
}
