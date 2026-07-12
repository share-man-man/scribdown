/**
 * rehype 插件：为用户手写的内容折叠块 <details>
 * 打上 scribdown-details + scribdown-frame 手绘边框 class。
 */

import { DETAILS_CLASS_NAME, FRAME_CLASS_NAME, TOC_CLASS_NAME } from "@scribdown/shared";

import type { Root } from "hast";
import { classnames } from "hast-util-classnames";
import { visit } from "unist-util-visit";

/**
 * rehype 插件：为内容折叠块注入手绘边框 class，实现样式层的 opt-in。
 * 用户手写的原生 <details>（非目录用）打上 scribdown-details + scribdown-frame；
 * 目录根的 scribdown-frame 已在 mdast 阶段注入，目录根在此跳过（分支已改用 button，无 details）。
 * 该插件运行在 rehype-raw 之后、rehype-sanitize 之前，注入的 class 由 sanitize 白名单放行。
 * @returns hast 转换器。
 */
function rehypeFrameClass(): (tree: Root) => void {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "details") {
        return;
      }

      // 当前 details 已有的 class 列表（可能是数组、字符串或缺失）。
      const classNames = normalizeClassNames(node.properties.className);

      // 目录根使用自己的命名空间，不当作内容折叠块处理。
      if (!classNames.includes(TOC_CLASS_NAME)) {
        // 关键步骤：hast-util-classnames 追加 class 并去重，保留已有 class。
        classnames(node, DETAILS_CLASS_NAME, FRAME_CLASS_NAME);
      }
    });
  };
}

/**
 * 将 hast 节点的 className 属性标准化为字符串数组。
 * @param className hast 节点上的 className 属性原值。
 * @returns 标准化后的 class 名数组。
 */
function normalizeClassNames(className: unknown): string[] {
  if (Array.isArray(className)) {
    return className.filter((item): item is string => typeof item === "string");
  }
  if (typeof className === "string") {
    return className.split(/\s+/u).filter(Boolean);
  }
  return [];
}

export { rehypeFrameClass };
