/** 提示块语法：GitHub 引用提示与冒号围栏容器共用标准 Markdown 子树。 */
import {
  CALLOUT_CLASS_NAME,
  CALLOUT_CONTAINER_KINDS,
  CALLOUT_MARKER_PATTERN,
  CALLOUT_META,
  CALLOUT_TITLE_CLASS_NAME,
  CalloutKind,
  CalloutToken,
  DETAILS_CONTAINER_NAME,
  DETAILS_CONTAINER_TITLE,
  FRAME_CLASS_NAME
} from "@scribdown/shared";
import type { Blockquote, Root } from "mdast";
import type {} from "mdast-util-to-hast";
import type { Processor } from "unified";
import { visit } from "unist-util-visit";

import { calloutFromMarkdown, calloutSyntax } from "./callout-container";

/**
 * 为引用节点设置提示块外壳与标题，继续复用块级子节点的渲染和源码行号处理。
 * @param node 作为提示容器的引用节点。
 * @param kind 提示语义类型。
 * @param title 自定义标题；为空时采用类型默认标题。
 */
function decorateCallout(node: Blockquote, kind: CalloutKind, title: string): void {
  node.data = {
    ...node.data,
    hName: "div",
    hProperties: {
      ...node.data?.hProperties,
      className: [CALLOUT_CLASS_NAME, FRAME_CLASS_NAME, CALLOUT_META[kind].className]
    }
  };
  node.children.unshift({
    type: "paragraph",
    data: { hProperties: { className: [CALLOUT_TITLE_CLASS_NAME] } },
    children: [{ type: "text", value: title || CALLOUT_META[kind].title }]
  });
}

/**
 * 识别并转换 GitHub 引用提示，保留正文的行内标记和块级内容。
 * @param tree Markdown 文档树。
 * @param source 原始 Markdown，用于区分转义标记与真正的提示标记。
 */
function transformQuotedCallouts(tree: Root, source: string): void {
  visit(tree, "blockquote", (node) => {
    /** 第一段与第一个文本节点，标记不能藏在强调、链接或代码中。 */
    const paragraph = node.children[0];
    if (paragraph?.type !== "paragraph") return;
    /** 包含提示标记的文本。 */
    const first = paragraph.children[0];
    if (first?.type !== "text") return;
    /** 原文起始偏移，避免把反斜杠转义后的文本误识别。 */
    const offset = first.position?.start.offset;
    if (offset === undefined || !first.value.startsWith("[!")) return;
    /** 从原文读取首行，让自定义标题中的 Markdown 字符作为纯文本保留。 */
    const markerLine = source.slice(offset).split(/\r?\n/u, 1)[0];
    /** 首行提示类型与可选标题。 */
    const match = CALLOUT_MARKER_PATTERN.exec(markerLine);
    if (!match) return;
    /** 标记所在源码行。 */
    const markerLineNumber = first.position?.start.line;
    /** 统一语义类型。 */
    const kind = match[1].toLowerCase() as CalloutKind;
    // 删除整条标记行，保留跨行文本节点中的正文与后续行内节点。
    paragraph.children = paragraph.children.filter((child) => {
      if (child.position?.start.line !== markerLineNumber) return true;
      if (child.type === "text" && child.value.includes("\n")) {
        child.value = child.value.slice(child.value.indexOf("\n") + 1);
        return child.value.length > 0;
      }
      return false;
    });
    if (paragraph.children.length === 0) node.children.shift();
    decorateCallout(node, kind, match[2]?.trim() ?? "");
  });
}

/**
 * remark 插件：注册容器语法解析，再统一转换两种提示块的渲染信息。
 * @param source 完整 Markdown 原文，用于验证引用提示标记。
 * @returns 提示块转换器。
 */
export function remarkCallouts(this: Processor, source: string): (tree: Root) => void {
  /** 解析器扩展由 remark-parse 在首次解析时读取。 */
  const data = this.data();
  (data.micromarkExtensions ??= []).push(calloutSyntax());
  (data.fromMarkdownExtensions ??= []).push(calloutFromMarkdown());

  return (tree) => {
    visit(tree, CalloutToken.Container, (node, index, parent) => {
      if (!parent || index === undefined) return;
      /** 复用现有块级节点的 HTML 转换与源码行号递归。 */
      const container: Blockquote = {
        type: "blockquote",
        children: node.children,
        position: node.position
      };
      if (node.name === DETAILS_CONTAINER_NAME) {
        container.data = { hName: "details" };
        container.children.unshift({
          type: "paragraph",
          data: { hName: "summary" },
          children: [{ type: "text", value: node.title || DETAILS_CONTAINER_TITLE }]
        });
      } else {
        decorateCallout(container, CALLOUT_CONTAINER_KINDS[node.name], node.title);
      }
      parent.children[index] = container;
    });
    transformQuotedCallouts(tree, source);
  };
}
