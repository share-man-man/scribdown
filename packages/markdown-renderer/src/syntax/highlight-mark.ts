/**
 * remark 插件：把行内 text 节点中的 ==text== 转换为 <mark> 高亮节点。
 */

import type { MarkdownNode } from "../core/ast";

// ==text== 高亮匹配：成对的 == 之间不能换行或再次出现 ==。
const HIGHLIGHT_MARKER_PATTERN = /==([^=\n]+?)==/g;

/**
 * remark 插件：把行内 text 节点中的 ==text== 转换为 <mark> 节点。
 * GFM 本身不支持该语法，因此独立实现以覆盖 fixture 中的高亮用法。
 * @returns Markdown AST 转换器。
 */
function remarkHighlightMark(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    transformHighlightMarks(tree);
  };
}

/**
 * 深度优先遍历，把 text 节点中匹配 ==..== 的片段替换为 mark 节点。
 * @param node 当前节点。
 */
function transformHighlightMarks(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  // 处理后写回的新子节点列表。
  const nextChildren: MarkdownNode[] = [];
  // 子节点索引。
  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    // 当前子节点。
    const childNode = node.children[childIndex];

    if (
      childNode.type === "text" &&
      typeof childNode.value === "string" &&
      childNode.value.includes("==")
    ) {
      nextChildren.push(...splitHighlightMarks(childNode.value));
      continue;
    }

    transformHighlightMarks(childNode);
    nextChildren.push(childNode);
  }

  node.children = nextChildren;
}

/**
 * 拆分 text 字符串，把 ==content== 段落转换成 mark 节点。
 * @param textValue 原始 text 节点的内容。
 * @returns 拆分后的行内节点列表。
 */
function splitHighlightMarks(textValue: string): MarkdownNode[] {
  // 拆分结果。
  const segments: MarkdownNode[] = [];
  // 当前游标位置。
  let cursor = 0;

  HIGHLIGHT_MARKER_PATTERN.lastIndex = 0;
  // 上一个匹配结果。
  let match: RegExpExecArray | null = HIGHLIGHT_MARKER_PATTERN.exec(textValue);

  while (match !== null) {
    // 当前匹配开始位置之前的普通文本。
    const leadingText = textValue.slice(cursor, match.index);

    if (leadingText.length > 0) {
      segments.push({ type: "text", value: leadingText });
    }

    segments.push({
      type: "highlightMark",
      data: {
        hName: "mark"
      },
      children: [{ type: "text", value: match[1] }]
    });

    cursor = match.index + match[0].length;
    match = HIGHLIGHT_MARKER_PATTERN.exec(textValue);
  }

  // 尾部剩余文本。
  const trailingText = textValue.slice(cursor);
  if (trailingText.length > 0) {
    segments.push({ type: "text", value: trailingText });
  }

  return segments;
}

export { remarkHighlightMark };
