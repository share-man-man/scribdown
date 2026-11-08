import type { Messages } from "./i18n/messages.types.js";

/** 阅读排版的紧凑程度，标准档保持既有排版。 */
export enum ContentDensity {
  Compact = "compact",
  Standard = "standard",
  Relaxed = "relaxed"
}

/** 阅读紧凑程度的本地存储键，与页面宽度使用相同的宿主存储范围。 */
export const CONTENT_DENSITY_STORAGE_KEY = "scribdown-content-density";

/** 正文纵向间距的缩放变量，不影响工具栏和侧栏。 */
export const CONTENT_DENSITY_SPACING_CSS_VAR = "--scribdown-density-spacing";

/** 正文与代码行号共用的行高变量。 */
export const CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR = "--scribdown-density-line-height";

/** 默认保持原有正文行高与间距。 */
export const DEFAULT_CONTENT_DENSITY = 100;

/** 滑块最小值：原紧凑档的间距比例。 */
export const CONTENT_DENSITY_MIN = 75;

/** 滑块最大值：原宽松档的间距比例。 */
export const CONTENT_DENSITY_MAX = 150;

/** 每次键盘移动或拖动吸附的步进，单位为百分比。 */
export const CONTENT_DENSITY_STEP = 5;

/** 百分比换算为 CSS 缩放比例的除数。 */
export const CONTENT_DENSITY_PERCENT_SCALE = 100;

/** 紧凑程度档位定义，各端统一复用数值与翻译键。 */
export const CONTENT_DENSITY_PRESETS: ReadonlyArray<{
  value: ContentDensity;
  labelKey: keyof Messages;
  spacing: number;
  lineHeight: number;
}> = [
  {
    value: ContentDensity.Compact,
    labelKey: "toolbar.densityCompact",
    spacing: 0.75,
    lineHeight: 1.45
  },
  {
    value: ContentDensity.Standard,
    labelKey: "toolbar.densityStandard",
    spacing: 1,
    lineHeight: 1.65
  },
  {
    value: ContentDensity.Relaxed,
    labelKey: "toolbar.densityRelaxed",
    spacing: 1.5,
    lineHeight: 1.9
  }
];
