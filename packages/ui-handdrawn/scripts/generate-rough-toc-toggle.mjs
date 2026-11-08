#!/usr/bin/env node
/**
 * 使用 Rough.js 离线生成单色目录折叠图标：错位双线圆圈与朝右箭头。
 * SVG 只提供笔触形状，宿主通过 CSS mask 着色，不内置主题或彩色样式。
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import rough from "roughjs";

/** 相对于脚本定位输出文件，不依赖调用时的工作目录。 */
const output = new URL("../src/assets/toc-branch-toggle.svg", import.meta.url);
/** 使用无 DOM 的生成器，浏览器运行时不加载 Rough.js。 */
const generator = rough.generator();
/** 保持原资产的显示尺寸，避免改变既有布局。 */
const SIZE = 22;
/** 在双倍画布绘制，保留笔触错位且避免小尺寸下抖成墨团。 */
const VIEWBOX_SIZE = SIZE * 2;
/** 固定种子保证每次重新生成的路径一致。 */
const SEED = 7;
/** 单色不透明笔触，仅供 CSS mask 读取 alpha 通道。 */
const INK = "#000";

/**
 * 导出 Rough.js 路径，保留生成器给出的描边宽度并精简小数位。
 * @param {import("roughjs/bin/core").Drawable} drawable 待导出的手绘图形。
 * @returns {string} SVG path 元素。
 */
function renderPaths(drawable) {
  return generator.toPaths(drawable).map(({ d, strokeWidth }) => {
    /** 保留两位小数的路径坐标，减少资产体积。 */
    const pathData = d.replace(/-?\d+\.\d+/g, (number) => String(Number(Number(number).toFixed(2))));
    return `  <path d="${pathData}" stroke-width="${strokeWidth}" />`;
  }).join("\n");
}

/** 外圈：略扁的双线椭圆，起笔错开，曲线保留不规则的铅笔感。 */
const ring = generator.ellipse(22, 22.4, 33, 31, {
  stroke: INK,
  strokeWidth: 2.2,
  roughness: 1.8,
  bowing: 2.2,
  curveFitting: 0.9,
  curveStepCount: 7,
  disableMultiStroke: false,
  seed: SEED
});

/** 箭头：略不对称的折线，双笔触比圆圈更厚，缩小后仍能辨认方向。 */
const chevron = generator.linearPath([[17, 13], [28.5, 22], [16.5, 31.4]], {
  stroke: INK,
  strokeWidth: 2.8,
  roughness: 1.4,
  bowing: 2,
  maxRandomnessOffset: 1.2,
  disableMultiStroke: false,
  seed: SEED + 1
});

/** 最终 SVG 仅包含单色几何路径，不携带彩色、透明度或明暗主题规则。 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}" fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
${renderPaths(ring)}
${renderPaths(chevron)}
</svg>
`;

writeFileSync(output, svg, "utf8");
console.log(`[generate-rough-toc-toggle] ${fileURLToPath(output)}`);
