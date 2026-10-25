/** 仅供离线图标生成使用的形状和笔触配置，不通过共享包导出或随 UI 包发布。 */
import { CalloutKind } from "../../shared/src/callouts.ts";

/**
 * 所有图标共用的画布与笔触，固定种子保证重复生成结果一致。
 * Rough.js 抖动按绝对单位计算，故在 48 单位的放大画布上绘制，输出尺寸仍为 24，由 viewBox 缩放；
 * 关闭 preserveVertices 让端点和转角错开、冲出，形成速写的「没对齐」感。
 */
export const CALLOUT_ICON_STYLE = {
  size: 24,
  viewBoxSize: 48,
  stroke: "currentColor",
  strokeWidth: 3.2,
  roughness: 1.5,
  bowing: 1.8,
  maxRandomnessOffset: 1.6,
  seed: 41,
  disableMultiStroke: false,
  preserveVertices: false
};

/** 外轮廓统一加大抖动与弯曲，内部符号沿用基础笔触以保证小尺寸下可辨认。 */
const OUTLINE_STYLE = {
  roughness: 1.9,
  bowing: 2.4,
  maxRandomnessOffset: 2
};

/** 各类型外轮廓的笔触；Caution 闪电没有内部符号，额外用斜向排线涂满。 */
export const CALLOUT_ICON_OUTLINE_STYLES = {
  [CalloutKind.Note]: OUTLINE_STYLE,
  [CalloutKind.Tip]: OUTLINE_STYLE,
  [CalloutKind.Important]: OUTLINE_STYLE,
  [CalloutKind.Warning]: OUTLINE_STYLE,
  [CalloutKind.Caution]: {
    ...OUTLINE_STYLE,
    fill: "currentColor",
    fillStyle: "hachure",
    fillWeight: 1.6,
    hachureGap: 3.2,
    hachureAngle: -50
  }
};

/** 各类型的轮廓和内部符号分开描绘（48 单位坐标），避免小尺寸下笔触互相干扰。 */
export const CALLOUT_ICON_PATHS = {
  [CalloutKind.Note]: [
    "M 42 24 A 18 18 0 1 1 6 24 A 18 18 0 1 1 42 24 Z",
    "M 24 21 L 24 34",
    "M 24 14 L 24 14.6"
  ],
  [CalloutKind.Tip]: [
    "M 17 32 C 17 27.6 11 25 11 17.6 C 11 1.6 37 1.6 37 17.6 C 37 25 31 27.6 31 32 Z",
    "M 18 38 L 30 38 M 20 43 L 28 43",
    "M 24 31 L 24 21 M 19 18 L 24 22 L 29 18"
  ],
  [CalloutKind.Important]: [
    "M 10 7 L 38 7 Q 42 7 42 11 L 42 30 Q 42 34 38 34 L 20 34 L 10 42 L 10 34 Q 6 34 6 30 L 6 11 Q 6 7 10 7 Z",
    "M 24 14 L 24 21",
    "M 24 27 L 24 27.6"
  ],
  [CalloutKind.Warning]: ["M 24 6 L 44 41 L 4 41 Z", "M 24 18 L 24 27", "M 24 34 L 24 34.6"],
  // 闪电的折角轮廓在小尺寸下也能与 Note 圆圈、Warning 三角形清楚区分。
  [CalloutKind.Caution]: ["M 28 6 L 9 26 L 22 26 L 19 42 L 40 20 L 27 20 Z"]
};
