#!/usr/bin/env node
/**
 * 使用 roughjs 生成手绘风格的横线 / 竖线 SVG 资产。
 * 通过 RoughGenerator 在 Node 环境直接生成路径，无需 DOM。
 * 一次运行同时产出 rough-line-horizontal.svg 与 rough-line-vertical.svg。
 *
 * 横线和竖线的笔触配置完全独立（HORIZONTAL_* 与 VERTICAL_* 互不复用），
 * 调整任意一条不会影响其他笔触。
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rough from "roughjs";

// 当前脚本所在目录，作为路径锚点
const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 画布尺寸：横线 / 竖线各自独立
// ============================================================
const HORIZONTAL_WIDTH = 200;
const HORIZONTAL_HEIGHT = 6;
const VERTICAL_WIDTH = 6;
const VERTICAL_HEIGHT = 200;

// ============================================================
// 【横线】笔触 A —— 所有字段独立列出，可单独调试
// waveAxis: "y" 表示弯曲偏移作用在 y 方向（横线沿 x 走 → 抖动在 y）
// ============================================================
const HORIZONTAL_STROKE_A = {
  // —— 几何（画布坐标系） ——
  /** 起点 X */
  startX: -1,
  /** 起点 Y */
  startY: HORIZONTAL_HEIGHT / 2 - 0.4,
  /** 终点 X */
  endX: HORIZONTAL_WIDTH + 1,
  /** 终点 Y */
  endY: HORIZONTAL_HEIGHT / 2 + 0.4,
  /** 控制点数量（含首尾），决定沿线弯曲个数 */
  wavePoints: 6,
  /** 中间控制点上下交替偏移幅度 */
  waveAmplitude: 0.6,
  /** 弯曲偏移作用轴：横线为 "y"，竖线为 "x" */
  waveAxis: "y",

  // —— roughjs 参数 ——
  /** 随机数种子，固定后产物可重现 */
  seed: 1,
  /** 抖动强度 */
  roughness: 0.5,
  /** 整体弯曲倾向 */
  bowing: 1,
  /** 曲线拟合紧度（0=Catmull-Rom 标准） */
  curveTightness: 0,
  /** 每段曲线的细分步数，越大越平滑 */
  curveStepCount: 0.2,
  /** 关闭 roughjs 自带双笔触：本脚本手工组合两条独立曲线 */
  disableMultiStroke: true,
  /** 描边颜色 */
  stroke: "#2F6A5F",
  /** 描边宽度 */
  strokeWidth: 1.5
};

// ============================================================
// 【横线】笔触 B —— 与 A 完全独立
// ============================================================
const HORIZONTAL_STROKE_B = {
  // —— 几何（画布坐标系） ——
  /** 起点 X */
  startX: 20,
  /** 起点 Y */
  startY: HORIZONTAL_HEIGHT / 2 + 0.1,
  /** 终点 X */
  endX: HORIZONTAL_WIDTH - 2,
  /** 终点 Y */
  endY: HORIZONTAL_HEIGHT / 2 + 1.2,
  /** 控制点数量（含首尾），决定沿线弯曲个数 */
  wavePoints: 4,
  /** 中间控制点上下交替偏移幅度 */
  waveAmplitude: 0.5,
  /** 弯曲偏移作用轴：横线为 "y"，竖线为 "x" */
  waveAxis: "y",

  // —— roughjs 参数 ——
  /** 随机数种子，固定后产物可重现 */
  seed: 7,
  /** 抖动强度 */
  roughness: 0.5,
  /** 整体弯曲倾向 */
  bowing: 1.2,
  /** 曲线拟合紧度（0=Catmull-Rom 标准） */
  curveTightness: 0,
  /** 每段曲线的细分步数，越大越平滑 */
  curveStepCount: 9,
  /** 关闭 roughjs 自带双笔触：本脚本手工组合两条独立曲线 */
  disableMultiStroke: true,
  /** 描边颜色 */
  stroke: "#2F6A5F",
  /** 描边宽度 */
  strokeWidth: 1.5
};

// ============================================================
// 【竖线】笔触 A —— 与横线笔触完全独立，单独调试
// waveAxis: "x" 表示弯曲偏移作用在 x 方向（竖线沿 y 走 → 抖动在 x）
// ============================================================
const VERTICAL_STROKE_A = {
  // —— 几何（画布坐标系） ——
  /** 起点 X */
  startX: VERTICAL_WIDTH / 2 - 0.4,
  /** 起点 Y */
  startY: -1,
  /** 终点 X */
  endX: VERTICAL_WIDTH / 2 + 0.4,
  /** 终点 Y */
  endY: VERTICAL_HEIGHT + 1,
  /** 控制点数量（含首尾），决定沿线弯曲个数 */
  wavePoints: 6,
  /** 中间控制点左右交替偏移幅度 */
  waveAmplitude: 0.6,
  /** 弯曲偏移作用轴：横线为 "y"，竖线为 "x" */
  waveAxis: "x",

  // —— roughjs 参数 ——
  /** 随机数种子，固定后产物可重现 */
  seed: 1,
  /** 抖动强度 */
  roughness: 1,
  /** 整体弯曲倾向 */
  bowing: 1,
  /** 曲线拟合紧度（0=Catmull-Rom 标准） */
  curveTightness: 0,
  /** 每段曲线的细分步数，越大越平滑 */
  curveStepCount: 2,
  /** 关闭 roughjs 自带双笔触：本脚本手工组合两条独立曲线 */
  disableMultiStroke: true,
  /** 描边颜色 */
  stroke: "#2F6A5F",
  /** 描边宽度 */
  strokeWidth: 1.5
};

// ============================================================
// 【竖线】笔触 B —— 与上述三条完全独立
// ============================================================
const VERTICAL_STROKE_B = {
  // —— 几何（画布坐标系） ——
  /** 起点 X */
  startX: VERTICAL_WIDTH / 2 + 1.5,
  /** 起点 Y */
  startY: 20,
  /** 终点 X */
  endX: VERTICAL_WIDTH / 2 ,
  /** 终点 Y */
  endY: VERTICAL_HEIGHT - 2,
  /** 控制点数量（含首尾），决定沿线弯曲个数 */
  wavePoints: 4,
  /** 中间控制点左右交替偏移幅度 */
  waveAmplitude: 3,
  /** 弯曲偏移作用轴：横线为 "y"，竖线为 "x" */
  waveAxis: "x",

  // —— roughjs 参数 ——
  /** 随机数种子，固定后产物可重现 */
  seed: 7,
  /** 抖动强度 */
  roughness: 2,
  /** 整体弯曲倾向 */
  bowing: 1.2,
  /** 曲线拟合紧度（0=Catmull-Rom 标准） */
  curveTightness: 0,
  /** 每段曲线的细分步数，越大越平滑 */
  curveStepCount: 9,
  /** 关闭 roughjs 自带双笔触：本脚本手工组合两条独立曲线 */
  disableMultiStroke: true,
  /** 描边颜色 */
  stroke: "#2F6A5F",
  /** 描边宽度 */
  strokeWidth: 1.5
};

// ============================================================
// 输出任务：每个文件对应一组独立的 strokes
// ============================================================
const OUTPUTS = [
  {
    /** 输出文件名（不含目录） */
    fileName: "rough-line-horizontal.svg",
    /** 画布宽 */
    width: HORIZONTAL_WIDTH,
    /** 画布高 */
    height: HORIZONTAL_HEIGHT,
    /** 该文件包含的笔触列表 */
    strokes: [HORIZONTAL_STROKE_A, HORIZONTAL_STROKE_B]
  },
  {
    fileName: "rough-line-vertical.svg",
    width: VERTICAL_WIDTH,
    height: VERTICAL_HEIGHT,
    strokes: [VERTICAL_STROKE_A, VERTICAL_STROKE_B]
  }
];

// ============================================================
// 生成逻辑
// ============================================================
// roughjs 生成器
const generator = rough.generator();

for (const output of OUTPUTS) {
  // 每条 stroke：沿直线均匀采样控制点 → roughjs curve → SVG path d
  const paths = output.strokes
    .map((cfg) =>
      generator.curve(
        Array.from({ length: cfg.wavePoints }, (_, i) => {
          const t = i / (cfg.wavePoints - 1);
          // 基线坐标：从 (startX, startY) 线性插值到 (endX, endY)
          const baseX = cfg.startX + (cfg.endX - cfg.startX) * t;
          const baseY = cfg.startY + (cfg.endY - cfg.startY) * t;
          // 首尾贴合配置坐标，中间点上下交替偏移制造弯曲
          const offset =
            i === 0 || i === cfg.wavePoints - 1
              ? 0
              : (i % 2 === 0 ? -1 : 1) * cfg.waveAmplitude;
          // 偏移作用在 waveAxis 指定的轴上
          return cfg.waveAxis === "x" ? [baseX + offset, baseY] : [baseX, baseY + offset];
        }),
        cfg
      )
    )
    .flatMap((drawable) => drawable.sets.map((set) => generator.opsToPath(set)))
    .map((d) => `  <path d="${d}" />`)
    .join("\n");

  // 组装 SVG，样式集中放在 <style> 中，stroke 与 generator 的配置保持一致
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${output.width}" height="${output.height}" viewBox="0 0 ${output.width} ${output.height}" preserveAspectRatio="none">
  <style>
    path {
      fill: none;
      stroke: #2F6A5F;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (prefers-color-scheme: dark) {
      path {
        stroke: #5FBFAD;
      }
    }
  </style>
${paths}
</svg>
`;

  // 输出到 packages/ui-handdrawn/src/assets/{fileName}
  const outputPath = resolve(__dirname, `../src/assets/${output.fileName}`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, svg, "utf8");
  console.log(`[generate-rough-lines] 已写入 ${outputPath}`);
}
