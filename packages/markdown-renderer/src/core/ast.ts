/**
 * Markdown（mdast）与 HTML（hast）AST 的最小节点结构及通用遍历工具。
 * 仅声明渲染插件真正用到的字段，避免引入完整的 @types/mdast / @types/hast。
 */

/**
 * Markdown AST 节点的最小结构。
 */
interface MarkdownNode {
  type: string;
  value?: string;
  lang?: string;
  depth?: number;
  url?: string;
  alt?: string;
  title?: string | null;
  identifier?: string;
  ordered?: boolean;
  spread?: boolean;
  children?: MarkdownNode[];
  data?: MarkdownNodeData;
  position?: MarkdownNodePosition;
}

/**
 * Markdown AST 节点上的 HTML 转换元数据。
 */
interface MarkdownNodeData {
  hName?: string;
  hProperties?: Record<string, unknown>;
}

/**
 * Markdown AST 节点的源码位置信息。
 */
interface MarkdownNodePosition {
  /** 节点在源码中的起始位置。 */
  start: {
    /** 起始行号（1-based）。 */
    line: number;
  };
}

/**
 * hast 节点的最小结构，覆盖元素 / 文本两类，
 * 仅暴露视频 figure 包装需要的字段，避免引入 @types/hast。
 */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
}

/**
 * 深度优先遍历 Markdown AST。
 * @param node 当前节点。
 * @param visitor 节点访问函数。
 */
function visitMarkdownNode(node: MarkdownNode, visitor: (node: MarkdownNode) => void): void {
  visitor(node);

  if (!node.children) {
    return;
  }

  // 子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    visitMarkdownNode(childNodes[childIndex], visitor);
  }
}

/**
 * 从节点及其子节点中提取可读文本。
 * @param node 当前节点。
 * @returns 当前节点的纯文本内容。
 */
function extractNodeText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value ?? "";
  }

  if (isImageNode(node)) {
    return node.alt ?? "";
  }

  if (!node.children) {
    return "";
  }

  return node.children.map(extractNodeText).join("");
}

/**
 * 判断节点是否为图片或引用式图片。
 * @param node 待判断的 Markdown 节点。
 * @returns 当前节点是否为图片节点。
 */
function isImageNode(node: MarkdownNode): boolean {
  return node.type === "image" || node.type === "imageReference";
}

export type { MarkdownNode, MarkdownNodeData, HastNode };
export { visitMarkdownNode, extractNodeText, isImageNode };
