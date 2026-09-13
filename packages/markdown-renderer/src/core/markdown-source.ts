/** 在 HTML 转换前保存表格与代码块源码，避免从可见文本反推丢失格式。 */
import { MARKDOWN_SOURCE_HAST_PROPERTY } from "@scribdown/shared";
import type { Root } from "mdast";
import type {} from "mdast-util-to-hast";
import { visit } from "unist-util-visit";

/**
 * 保存可复制块的 Markdown 原文。
 * @param markdownText 完整 Markdown 输入。
 * @returns 注入源码属性的 AST 转换器。
 */
export function remarkMarkdownSource(markdownText: string): (tree: Root) => void {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== "table" && !(node.type === "code" && node.lang === "mermaid")) {
        return;
      }
      /** 节点在原文中的起止位置。 */
      const position = node.position;
      if (position?.start.offset === undefined || position.end.offset === undefined) {
        return;
      }
      // 保留首行容器前缀，使克隆后的引用或列表代码块仍可正确解析。
      const startOffset =
        node.type === "code"
          ? position.start.offset - (position.start.column - 1)
          : position.start.offset;
      node.data ??= {};
      node.data.hProperties ??= {};
      // URI 编码避免图表箭头等内容被 HTML 安全清洗当成标记片段移除。
      node.data.hProperties[MARKDOWN_SOURCE_HAST_PROPERTY] = encodeURIComponent(
        markdownText.slice(startOffset, position.end.offset)
      );
    });
  };
}
