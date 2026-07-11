/**
 * remark 插件：为块级节点标注 data-source-line 源码行锚点，
 * 供编辑器与预览的双向滚动对齐使用。
 */

import { SOURCE_LINE_DATA_ATTRIBUTE } from "@scribdown/shared";

import type { MarkdownNode, MarkdownNodeData } from "./ast";

/**
 * 源码行号在 hast 节点上的属性名（camelCase）。
 * rehype-raw 会把 DOM 属性 data-source-line 回解析为该 camelCase 形式，
 * sanitize 白名单与 hProperties 注入均需以此形式匹配，序列化后仍输出 data-source-line。
 */
const SOURCE_LINE_HAST_PROPERTY = SOURCE_LINE_DATA_ATTRIBUTE.replace(
  /-([a-z])/gu,
  (_match: string, letter: string) => letter.toUpperCase()
);

/**
 * 块级容器节点类型集合：这些节点的子节点同样是块级节点，需递归下钻标注源码行锚点，
 * 以覆盖列表中的代码块、嵌套引用等场景。
 */
const BLOCK_CONTAINER_NODE_TYPES = new Set(["list", "listItem", "blockquote"]);

/**
 * remark 插件：为块级节点标注源码起始行号，递归覆盖嵌套块级结构。
 * 通过 hProperties 注入 data-source-line 属性，供编辑器与预览的双向滚动对齐使用。
 * @returns Markdown AST 转换器。
 */
function remarkSourceLine(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    // 顶层块级节点列表。
    const blockNodes = tree.children ?? [];

    blockNodes.forEach((blockNode) => {
      annotateSourceLine(blockNode);

      // 关键步骤：列表项、引用等不在顶层，递归下钻为内部块级节点标注源码行锚点。
      annotateNestedBlockSourceLines(blockNode);
    });
  };
}

/**
 * 为单个节点注入 data-source-line 源码行锚点。
 * @param node 目标 Markdown 节点。
 */
function annotateSourceLine(node: MarkdownNode): void {
  // 当前节点的源码起始行号（1-based）。
  const startLine = node.position?.start.line;

  // 仅标注带源码位置的节点；TOC、定义列表、图片 figure 等转换节点已显式保留原段落位置，
  // 真正无源码位置的纯生成节点自动跳过。
  if (typeof startLine !== "number") {
    return;
  }

  // 节点 HTML 转换元数据容器。
  const nodeData: MarkdownNodeData = node.data ?? {};
  // 节点 hast 属性容器。
  const hProperties: Record<string, unknown> = nodeData.hProperties ?? {};

  hProperties[SOURCE_LINE_HAST_PROPERTY] = startLine;
  nodeData.hProperties = hProperties;
  node.data = nodeData;
}

/**
 * 递归为块级容器节点内部的子节点标注源码行锚点。
 * 覆盖列表项、嵌套子列表、引用内的代码块与嵌套引用等场景。
 * @param node 当前块级节点。
 */
function annotateNestedBlockSourceLines(node: MarkdownNode): void {
  // 仅块级容器节点的子节点为块级节点，非容器节点无需下钻。
  if (!BLOCK_CONTAINER_NODE_TYPES.has(node.type)) {
    return;
  }

  // 容器节点的直接子节点。
  const childNodes = node.children ?? [];

  childNodes.forEach((childNode) => {
    annotateSourceLine(childNode);
    annotateNestedBlockSourceLines(childNode);
  });
}

export { SOURCE_LINE_HAST_PROPERTY, remarkSourceLine };
