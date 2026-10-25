#!/usr/bin/env node
/**
 * 使用 Rough.js 离线生成无序列表三级 bullet 与任务列表复选框图标，浏览器无需加载 Rough.js。
 * 产物为单色 SVG，CSS 侧以 mask-image 引用，颜色由主题 token 控制，自动适配暗色。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import rough from "roughjs";

/** 相对于脚本定位资产目录，不依赖调用时的工作目录。 */
const outputDirectory = new URL("../src/assets/", import.meta.url);
/** 通过生成器直接导出路径，无需模拟 DOM。 */
const generator = rough.generator();
/** mask 只读取 alpha 通道，颜色取任意不透明色即可。 */
const INK = "#000";

/**
 * 各图标的画布与 Rough.js 图形定义；固定种子保证重复生成结果一致。
 * Rough.js 抖动按绝对单位计算，故在放大画布上绘制、由 CSS 缩放，避免小尺寸下变形成墨团。
 * @type {Record<string, { size: number, shapes: () => import("roughjs/bin/core").Drawable[] }>}
 */
const ICONS = {
  // 第 1 层：涂黑的墨点，抖动轮廓 + 斜向来回涂抹的 zigzag 填充，保留笔触间的细缝。
  "rough-list-bullet-1": {
    size: 48,
    shapes: () => [
      generator.ellipse(24, 25, 34, 31, {
        stroke: INK,
        strokeWidth: 3.2,
        fill: INK,
        fillStyle: "zigzag",
        fillWeight: 3.4,
        hachureGap: 4.6,
        hachureAngle: -52,
        roughness: 2.4,
        bowing: 3,
        curveStepCount: 6,
        seed: 31
      })
    ]
  },
  // 第 2 层：空心圆圈，两圈笔触明显错开，起笔处留一个小尾巴。
  "rough-list-bullet-2": {
    size: 48,
    shapes: () => [
      generator.ellipse(24, 24, 35, 33, {
        stroke: INK,
        strokeWidth: 3.2,
        roughness: 1.9,
        bowing: 2.4,
        curveFitting: 0.9,
        seed: 72
      })
    ]
  },
  // 第 3 层：交叉排线方块，四条边略歪、角点不严丝合缝。
  "rough-list-bullet-3": {
    size: 48,
    shapes: () => [
      generator.polygon(
        [
          [10.5, 13],
          [36.5, 9.5],
          [38, 36],
          [12, 37.5]
        ],
        {
          stroke: INK,
          strokeWidth: 3.2,
          fill: INK,
          fillStyle: "cross-hatch",
          fillWeight: 2.6,
          hachureGap: 5.2,
          hachureAngle: 38,
          roughness: 2.2,
          bowing: 3,
          preserveVertices: false,
          seed: 33
        }
      )
    ]
  },
  // 复选框外框：四条独立的边，端点在角上互相冲出，像速写时一笔一笔画的方框。
  "rough-checkbox-box": {
    size: 40,
    shapes: () =>
      [
        [3.5, 7, 36, 5.5],
        [33.5, 4, 34.5, 36.5],
        [37, 33.5, 4, 34.5],
        [6.5, 37, 6, 3.5]
      ].map(([x1, y1, x2, y2], index) =>
        generator.line(x1, y1, x2, y2, {
          stroke: INK,
          strokeWidth: 2.6,
          roughness: 1.6,
          bowing: 2,
          maxRandomnessOffset: 1.4,
          seed: 81 + index
        })
      )
  },
  // 已完成钩：短笔下压后顺势长笔上挑并甩出外框，双笔触带出墨迹的粗细变化。
  "rough-checkbox-check": {
    size: 40,
    shapes: () => [
      generator.linearPath(
        [
          [8, 19.5],
          [16, 29.5],
          [37, 4]
        ],
        {
          stroke: INK,
          strokeWidth: 3.2,
          roughness: 1.9,
          bowing: 2.6,
          maxRandomnessOffset: 2,
          seed: 57
        }
      )
    ]
  }
};

/**
 * 将 Rough.js 路径数值精简到两位小数以控制资产体积。
 * @param {string} d 原始 path d。
 * @returns {string} 精简后的 path d。
 */
function compactPath(d) {
  return d.replace(/-?\d+\.\d+/g, (number) => String(Number(Number(number).toFixed(2))));
}

/**
 * 把一组 drawable 渲染为完整 SVG 文本。
 * @param {number} size 正方形画布边长。
 * @param {import("roughjs/bin/core").Drawable[]} drawables Rough.js 图形。
 * @returns {string} SVG 文本。
 */
function renderSvg(size, drawables) {
  /** 每个 PathInfo 自带描边 / 填充，直接映射为 path 属性。 */
  const body = drawables
    .flatMap((drawable) => generator.toPaths(drawable))
    .map(
      ({ d, stroke, strokeWidth, fill }) =>
        `  <path d="${compactPath(d)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill ?? "none"}" />`
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" stroke-linecap="round" stroke-linejoin="round">
${body}
</svg>
`;
}

/** 逐个输出图标文件。 */
for (const [name, { size, shapes }] of Object.entries(ICONS)) {
  /** 输出路径：src/assets/<name>.svg */
  const output = new URL(`${name}.svg`, outputDirectory);
  writeFileSync(output, renderSvg(size, shapes()), "utf8");
  console.log(`[generate-rough-list-icons] ${fileURLToPath(output)}`);
}
