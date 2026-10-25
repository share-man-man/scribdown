#!/usr/bin/env node
/** 使用 Rough.js 离线生成目录分支折叠图标（圆圈 + 朝右箭头），浏览器无需加载 Rough.js。 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import rough from "roughjs";

/** 相对于脚本定位输出文件，不依赖调用时的工作目录。 */
const output = new URL("../src/assets/toc-branch-toggle.svg", import.meta.url);
/** 通过生成器直接导出路径，无需模拟 DOM。 */
const generator = rough.generator();

/** 画布尺寸：与原图标一致，CSS 侧按 100% 缩放。 */
const SIZE = 22;
/** 固定种子保证重复生成结果一致。 */
const SEED = 7;

/**
 * 图标作为 CSS background-image 使用，无法继承 currentColor，
 * 因此颜色写死在 SVG 内并通过 prefers-color-scheme 切换暗色。
 */
const COLORS = {
  /** 外圈：墨绿 */
  ring: { light: "#2F6A5F", dark: "#5FBFAD" },
  /** 箭头：赭石 */
  chevron: { light: "#8B6B2E", dark: "#C49A4A" }
};

/**
 * 将 Rough.js drawable 转换为 path d 列表，坐标精简到两位小数以控制体积。
 * @param {import("roughjs/bin/core").Drawable} drawable Rough.js 生成的图形。
 * @returns {string[]} SVG path d 字符串。
 */
function toPathData(drawable) {
  return generator
    .toPaths(drawable)
    .map(({ d }) => d.replace(/-?\d+\.\d+/g, (number) => String(Number(Number(number).toFixed(2)))));
}

/** 外圈：略扁、略偏的椭圆，双笔触不闭合，保留手绘的起笔错位。 */
const ringPaths = toPathData(
  generator.ellipse(11, 11.2, 15.6, 15, {
    roughness: 0.8,
    bowing: 1,
    curveFitting: 0.9,
    curveStepCount: 7,
    seed: SEED
  })
);

/** 箭头：两段折线，单独加大抖动让笔画更像手写。 */
const chevronPaths = toPathData(
  generator.linearPath(
    [
      [8.6, 6.6],
      [14.2, 11],
      [8.4, 15.4]
    ],
    {
      roughness: 0.9,
      bowing: 1.6,
      maxRandomnessOffset: 0.9,
      seed: SEED + 1
    }
  )
);

/**
 * 生成带样式的 path 元素。
 * @param {string} className 对应 <style> 中的类名。
 * @param {string[]} paths path d 列表。
 * @returns {string} SVG 片段。
 */
function renderPaths(className, paths) {
  return paths.map((d) => `  <path class="${className}" d="${d}" />`).join("\n");
}

/** 最终 SVG：外圈细而淡，箭头粗而实，主次分明。 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <style>
    path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ring {
      opacity: 0.78;
      stroke: ${COLORS.ring.light};
      stroke-width: 1.1;
    }

    .chevron {
      stroke: ${COLORS.chevron.light};
      stroke-width: 1.7;
    }

    @media (prefers-color-scheme: dark) {
      .ring {
        stroke: ${COLORS.ring.dark};
      }

      .chevron {
        stroke: ${COLORS.chevron.dark};
      }
    }
  </style>
${renderPaths("ring", ringPaths)}
${renderPaths("chevron", chevronPaths)}
</svg>
`;

writeFileSync(output, svg, "utf8");
console.log(`[generate-rough-toc-toggle] ${fileURLToPath(output)}`);
