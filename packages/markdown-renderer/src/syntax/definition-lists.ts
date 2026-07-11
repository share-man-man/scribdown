/**
 * remark 插件：把 term + 下一行冒号定义的段落转换为 dl/dt/dd 定义列表。
 */

import { extractNodeText, type MarkdownNode } from "../core/ast";

// 定义列表段落匹配规则：支持 CommonMark 未内建的 term + 下一行冒号定义写法。
const DEFINITION_LIST_PARAGRAPH_PATTERN = /^\s*([^\n:][^\n]*)\n\s*:\s+([^\n]+)\s*$/u;

/**
 * remark 插件：把 term + 下一行冒号定义的段落转换为定义列表。
 * @returns Markdown AST 转换器。
 */
function remarkDefinitionLists(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    transformDefinitionLists(tree);
  };
}

/**
 * 深度优先遍历，把定义列表段落替换为 dl/dt/dd 结构。
 * @param node 当前节点。
 */
function transformDefinitionLists(node: MarkdownNode): void {
  if (!node.children) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];
    // 当前段落转换后的定义列表节点。
    const definitionListNode = createDefinitionListNode(childNode);

    if (definitionListNode) {
      childNodes[childIndex] = definitionListNode;
      continue;
    }

    transformDefinitionLists(childNode);
  }
}

/**
 * 尝试把段落转换为定义列表节点。
 * @param node 待转换的 Markdown 节点。
 * @returns 转换后的定义列表节点，不匹配时返回 undefined。
 */
function createDefinitionListNode(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type !== "paragraph") {
    return undefined;
  }

  // 段落纯文本内容，用于识别定义列表语法。
  const paragraphText = extractNodeText(node);
  // 定义列表匹配结果。
  const definitionMatch = DEFINITION_LIST_PARAGRAPH_PATTERN.exec(paragraphText);

  if (!definitionMatch) {
    return undefined;
  }

  // 定义项名称。
  const definitionTerm = definitionMatch[1].trim();
  // 定义项说明。
  const definitionDescription = definitionMatch[2].trim();

  if (definitionTerm.length === 0 || definitionDescription.length === 0) {
    return undefined;
  }

  return {
    type: "definitionList",
    // 关键步骤：保留原段落源码位置，使 remarkSourceLine 能为 dl 标注 data-source-line。
    position: node.position,
    data: {
      hName: "dl"
    },
    children: [
      {
        type: "definitionTerm",
        data: {
          hName: "dt"
        },
        children: [{ type: "text", value: definitionTerm }]
      },
      {
        type: "definitionDescription",
        data: {
          hName: "dd"
        },
        children: [{ type: "text", value: definitionDescription }]
      }
    ]
  };
}

export { remarkDefinitionLists };
