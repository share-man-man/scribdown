#!/usr/bin/env node
/**
 * 使用 Rough.js 离线生成「渲染失败」统一图标（图片 / 视频 / Mermaid 共用），浏览器无需加载 Rough.js。
 * 拆为外框与裂痕两张单色 SVG，CSS 侧分别以 mask 引用，便于两部分使用不同主题色。
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
/** 画布宽高：与 CSS 中图标 5:4 的显示比例一致。 */
const WIDTH = 70;
/** 画布高度。 */
const HEIGHT = 56;

/**
 * 两个图层的 Rough.js 图形定义；固定种子保证重复生成结果一致。
 * @type {Record<string, () => import("roughjs/bin/core").Drawable[]>}
 */
const LAYERS = {
  // 外框：独立的边在角上互相冲出；上下两条边在裂痕处断开并上下错位，像被劈成两半的画框。
  "rough-fallback-frame": () =>
    [
      [3, 8, 33, 7],
      [40, 8.5, 66, 7],
      [62.5, 3, 64, 52],
      [67, 49, 39.5, 50.5],
      [32.5, 48.5, 4, 49.5],
      [7, 53, 6.5, 4]
    ].map(([x1, y1, x2, y2], index) =>
      generator.line(x1, y1, x2, y2, {
        stroke: INK,
        strokeWidth: 3,
        roughness: 1.6,
        bowing: 2,
        maxRandomnessOffset: 1.6,
        seed: 61 + index
      })
    ),
  // 裂痕：自上而下的折线把画框劈开，两端冲出外框；旁边两道短碎纹增强「破损」感。
  "rough-fallback-crack": () => [
    generator.linearPath(
      [
        [37, 1.5],
        [32, 15],
        [40, 23],
        [30, 34],
        [37, 42],
        [33, 54.5]
      ],
      {
        stroke: INK,
        strokeWidth: 2.8,
        roughness: 1.5,
        bowing: 2,
        maxRandomnessOffset: 1.4,
        seed: 71
      }
    ),
    generator.line(40, 23, 47, 19.5, {
      stroke: INK,
      strokeWidth: 2.2,
      roughness: 1.2,
      bowing: 1.5,
      seed: 72
    }),
    generator.line(30, 34, 23.5, 37, {
      stroke: INK,
      strokeWidth: 2.2,
      roughness: 1.2,
      bowing: 1.5,
      seed: 73
    })
  ]
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
 * @param {import("roughjs/bin/core").Drawable[]} drawables Rough.js 图形。
 * @returns {string} SVG 文本。
 */
function renderSvg(drawables) {
  /** 每个 PathInfo 自带描边 / 填充，直接映射为 path 属性。 */
  const body = drawables
    .flatMap((drawable) => generator.toPaths(drawable))
    .map(
      ({ d, stroke, strokeWidth, fill }) =>
        `  <path d="${compactPath(d)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill ?? "none"}" />`
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" stroke-linecap="round" stroke-linejoin="round">
${body}
</svg>
`;
}

/** 逐个输出图层文件。 */
for (const [name, shapes] of Object.entries(LAYERS)) {
  /** 输出路径：src/assets/<name>.svg */
  const output = new URL(`${name}.svg`, outputDirectory);
  writeFileSync(output, renderSvg(shapes()), "utf8");
  console.log(`[generate-rough-fallback-icon] ${fileURLToPath(output)}`);
}
