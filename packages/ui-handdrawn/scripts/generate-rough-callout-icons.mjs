#!/usr/bin/env node
/** 使用 Rough.js 离线生成五种提示图标，浏览器无需加载 Rough.js。 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import rough from "roughjs";
import { CALLOUT_META } from "../../shared/src/callouts.ts";
import {
  CALLOUT_ICON_OUTLINE_STYLES,
  CALLOUT_ICON_PATHS,
  CALLOUT_ICON_STYLE
} from "./callout-icon-config.mjs";

/** 相对于脚本定位资产目录，不依赖调用时的工作目录。 */
const outputDirectory = new URL("../src/assets/", import.meta.url);
/** 通过生成器直接导出路径，无需模拟 DOM。 */
const generator = rough.generator();

/**
 * 将图标几何路径转换为可复现的手绘 SVG。
 * @param {string} kind 共享的提示类型，用于获取可访问标题。
 * @param {readonly string[]} paths 轮廓与符号的 SVG 路径。
 * @returns {string} 带尺寸、标题及 currentColor 描边的 SVG 文本。
 */
function createIcon(kind, paths) {
  /** 每段路径独立设定种子，保证重跑或调整生成顺序不改变其他图标。 */
  const strokes = paths.flatMap((path, index) =>
    generator.toPaths(
      generator.path(path, {
        ...CALLOUT_ICON_STYLE,
        // 首条路径是外轮廓，仅对配置过的类型增强手绘笔触。
        ...(index === 0 ? CALLOUT_ICON_OUTLINE_STYLES[kind] : {}),
        seed: CALLOUT_ICON_STYLE.seed + index
      })
    )
  );
  /** 圆角笔触保留手绘感，坐标精简到两位小数以控制资产体积；排线填充的线宽与轮廓不同，按路径单独写出。 */
  const body = strokes
    .map(({ d, strokeWidth }) => {
      /** 精简后的路径数据。 */
      const data = d.replace(/-?\d+\.\d+/g, (number) => String(Number(Number(number).toFixed(2))));
      /** 与根节点不同的线宽才单独声明。 */
      const width = strokeWidth === CALLOUT_ICON_STYLE.strokeWidth ? "" : ` stroke-width="${strokeWidth}"`;
      return `  <path d="${data}"${width} />`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CALLOUT_ICON_STYLE.size}" height="${CALLOUT_ICON_STYLE.size}" viewBox="0 0 ${CALLOUT_ICON_STYLE.viewBoxSize} ${CALLOUT_ICON_STYLE.viewBoxSize}" fill="none" stroke="${CALLOUT_ICON_STYLE.stroke}" stroke-width="${CALLOUT_ICON_STYLE.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" role="img">
  <title>${CALLOUT_META[kind].title}</title>
${body}
</svg>
`;
}

mkdirSync(outputDirectory, { recursive: true });
/** 遍历共享类型映射，为每个类型输出独立的 SVG。 */
for (const [kind, paths] of Object.entries(CALLOUT_ICON_PATHS)) {
  /** 沿用 UI 资产的 rough- 前缀。 */
  const output = new URL(`rough-callout-${kind}.svg`, outputDirectory);
  writeFileSync(output, createIcon(kind, paths), "utf8");
  console.log(`[generate-rough-callout-icons] ${fileURLToPath(output)}`);
}
