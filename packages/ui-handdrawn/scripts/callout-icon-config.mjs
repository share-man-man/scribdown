/** 仅供离线图标生成使用的形状和笔触配置，不通过共享包导出或随 UI 包发布。 */
import { CalloutKind } from "../../shared/src/callouts.ts";

/** 所有图标共用的画布与笔触，固定种子保证重复生成结果一致。 */
export const CALLOUT_ICON_STYLE = {
  size: 24,
  stroke: "currentColor",
  strokeWidth: 1.6,
  roughness: 0.55,
  bowing: 0.5,
  seed: 41,
  disableMultiStroke: false,
  preserveVertices: true
};

/** 警示图标的外轮廓增加笔触错位与弯曲；若有内部符号，则沿用基础笔触。 */
export const CALLOUT_ICON_OUTLINE_STYLES = {
  [CalloutKind.Warning]: {
    roughness: 1.8,
    bowing: 2,
    maxRandomnessOffset: 1,
    preserveVertices: false
  },
  [CalloutKind.Caution]: {
    roughness: 1.8,
    bowing: 2,
    maxRandomnessOffset: 1,
    preserveVertices: false
  }
};

/** 各类型的轮廓和内部符号分开描绘，避免小尺寸下笔触互相干扰。 */
export const CALLOUT_ICON_PATHS = {
  [CalloutKind.Note]: [
    "M 21 12 A 9 9 0 1 1 3 12 A 9 9 0 1 1 21 12 Z",
    "M 12 10.5 L 12 17",
    "M 12 7 L 12 7.3"
  ],
  [CalloutKind.Tip]: [
    "M 8.5 16 C 8.5 13.8 5.5 12.5 5.5 8.8 C 5.5 0.8 18.5 0.8 18.5 8.8 C 18.5 12.5 15.5 13.8 15.5 16 Z",
    "M 9 19 L 15 19 M 10 21.5 L 14 21.5",
    "M 12 15.5 L 12 10.5 M 9.5 9 L 12 11 L 14.5 9"
  ],
  [CalloutKind.Important]: [
    "M 5 3.5 L 19 3.5 Q 21 3.5 21 5.5 L 21 15 Q 21 17 19 17 L 10 17 L 5 21 L 5 17 Q 3 17 3 15 L 3 5.5 Q 3 3.5 5 3.5 Z",
    "M 12 7 L 12 10.5",
    "M 12 13.5 L 12 13.8"
  ],
  [CalloutKind.Warning]: ["M 12 3 L 22 20.5 L 2 20.5 Z", "M 12 9 L 12 13.5", "M 12 17 L 12 17.3"],
  // 闪电的折角轮廓在小尺寸下也能与 Note 圆圈、Warning 三角形清楚区分。
  [CalloutKind.Caution]: ["M 14 3 L 4.5 13 L 11 13 L 9.5 21 L 20 10 L 13.5 10 Z"]
};
