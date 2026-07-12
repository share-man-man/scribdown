/**
 * remark 插件：把行内 text 节点中的 ==text== 转换为 <mark> 高亮节点。
 */

import type { PhrasingContent, Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";

// ==text== 高亮匹配：成对的 == 之间不能换行或再次出现 ==。
const HIGHLIGHT_MARKER_PATTERN = /==([^=\n]+?)==/g;

/**
 * remark 插件：把行内 text 节点中的 ==text== 转换为 <mark> 节点。
 * GFM 本身不支持该语法，因此独立实现以覆盖 fixture 中的高亮用法。
 * @returns Markdown AST 转换器。
 */
function remarkHighlightMark(): (tree: Root) => void {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (parent === undefined || index === undefined || !node.value.includes("==")) {
        return;
      }

      // 拆分出的行内节点列表（普通文本与 mark 节点交替）。
      const segments = splitHighlightMarks(node.value);

      parent.children.splice(index, 1, ...segments);

      // 关键步骤：跳过刚插入的片段（其中的 text 不会再含成对 ==），从其后继续遍历。
      return [SKIP, index + segments.length];
    });
  };
}

/**
 * 拆分 text 字符串，把 ==content== 段落转换成 mark 节点。
 * @param textValue 原始 text 节点的内容。
 * @returns 拆分后的行内节点列表。
 */
function splitHighlightMarks(textValue: string): PhrasingContent[] {
  // 拆分结果。
  const segments: PhrasingContent[] = [];
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
