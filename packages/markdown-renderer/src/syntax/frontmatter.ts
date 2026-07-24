/**
 * remark 插件：把文档头部的 YAML frontmatter 渲染为元数据卡片。
 */

import {
  FRAME_CLASS_NAME,
  FRONTMATTER_CHROME_CLASS_NAME,
  FRONTMATTER_CLASS_NAME,
  FRONTMATTER_LABEL_CLASS_NAME,
  FRONTMATTER_LIST_CLASS_NAME,
  FRONTMATTER_LIST_NESTED_CLASS_NAME,
  t
} from "@scribdown/shared";

import type { Code, Root, Yaml } from "mdast";
import { parse as parseYamlSource } from "yaml";

import type {
  FrontmatterDescription,
  FrontmatterList,
  FrontmatterMetadata,
  FrontmatterTerm
} from "../core/ast";

// Frontmatter 数组值中各标量项的拼接分隔符。
const FRONTMATTER_ARRAY_SEPARATOR = ", ";

// Frontmatter 解析失败时回退代码块使用的语言标识。
const FRONTMATTER_FALLBACK_LANGUAGE_ID = "yaml";

/**
 * remark 插件：把文档头部的 YAML frontmatter 渲染为元数据卡片。
 * remark-frontmatter 仅负责把 `---` 包裹的头部解析为 yaml 节点，
 * 本插件再把 yaml 节点转换为键值列表结构；解析失败时回退为 yaml 代码块展示原文。
 * @returns Markdown AST 转换器。
 */
function remarkFrontmatterMetadata(): (tree: Root) => void {
  return (tree: Root) => {
    // 顶层块级节点列表。
    const childNodes = tree.children;
    // frontmatter 只可能出现在文档首个节点（remark-frontmatter 仅识别文档起始处的 ---）。
    const yamlNode = childNodes[0];

    if (!yamlNode || yamlNode.type !== "yaml") {
      return;
    }

    childNodes[0] = createFrontmatterNode(yamlNode);
  };
}

/**
 * 把 yaml frontmatter 节点转换为元数据卡片节点。
 * @param yamlNode remark-frontmatter 解析出的 yaml 节点。
 * @returns 元数据卡片节点；yaml 解析失败或非键值对象时返回 yaml 代码块节点。
 */
function createFrontmatterNode(yamlNode: Yaml): FrontmatterMetadata | Code {
  // yaml 原文文本。
  const yamlSource = yamlNode.value;
  // yaml 解析结果，解析失败时保持 undefined。
  let parsedValue: unknown;

  try {
    parsedValue = parseYamlSource(yamlSource);
  } catch {
    parsedValue = undefined;
  }

  // 关键步骤：仅键值对象按卡片渲染；解析失败或非对象时回退为 yaml 代码块展示原文。
  if (!isPlainRecord(parsedValue)) {
    return {
      type: "code",
      lang: FRONTMATTER_FALLBACK_LANGUAGE_ID,
      position: yamlNode.position,
      value: yamlSource
    };
  }

  return {
    type: "frontmatterMetadata",
    // 关键步骤：保留原节点源码位置，使 remarkSourceLine 能标注 data-source-line。
    position: yamlNode.position,
    data: {
      hName: "div",
      hProperties: { className: [FRONTMATTER_CLASS_NAME, FRAME_CLASS_NAME] }
    },
    children: [
      {
        type: "frontmatterChrome",
        data: {
          hName: "div",
          hProperties: { className: [FRONTMATTER_CHROME_CLASS_NAME] }
        },
        children: [
          {
            type: "frontmatterLabel",
            data: {
              hName: "span",
              hProperties: { className: [FRONTMATTER_LABEL_CLASS_NAME] }
            },
            children: [{ type: "text", value: t("frontmatter.label") }]
          }
        ]
      },
      createFrontmatterListNode(parsedValue, false)
    ]
  };
}

/**
 * 判断值是否为纯键值对象（排除 null 与数组）。
 * @param value 待判断的值。
 * @returns 是否为纯键值对象。
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 把键值对象转换为 dl 键值列表节点，对象类型的值递归展开为嵌套列表。
 * @param record frontmatter 中的键值对象。
 * @param nested 是否为嵌套层（嵌套层追加修饰类）。
 * @returns dl 键值列表节点。
 */
function createFrontmatterListNode(
  record: Record<string, unknown>,
  nested: boolean
): FrontmatterList {
  // dl 的 className 列表：嵌套层追加修饰类。
  const listClassNames = nested
    ? [FRONTMATTER_LIST_CLASS_NAME, FRONTMATTER_LIST_NESTED_CLASS_NAME]
    : [FRONTMATTER_LIST_CLASS_NAME];
  // dt / dd 交替排列的子节点列表。
  const listChildren: (FrontmatterTerm | FrontmatterDescription)[] = [];

  Object.entries(record).forEach(([entryKey, entryValue]) => {
    listChildren.push({
      type: "frontmatterTerm",
      data: { hName: "dt" },
      children: [{ type: "text", value: entryKey }]
    });
    listChildren.push({
      type: "frontmatterDescription",
      data: { hName: "dd" },
      children: createFrontmatterValueNodes(entryValue)
    });
  });

  return {
    type: "frontmatterList",
    data: {
      hName: "dl",
      hProperties: { className: listClassNames }
    },
    children: listChildren
  };
}

/**
 * 把 frontmatter 中的单个值转换为 dd 内容节点列表。
 * @param value frontmatter 中的任意值。
 * @returns dd 的子节点列表。
 */
function createFrontmatterValueNodes(value: unknown): FrontmatterDescription["children"] {
  // 对象值向下展开为嵌套键值列表。
  if (isPlainRecord(value)) {
    return [createFrontmatterListNode(value, true)];
  }

  // 数组值逐项格式化后拼接为一行文本。
  if (Array.isArray(value)) {
    return [
      {
        type: "text",
        value: value.map(formatFrontmatterScalar).join(FRONTMATTER_ARRAY_SEPARATOR)
      }
    ];
  }

  return [{ type: "text", value: formatFrontmatterScalar(value) }];
}

/**
 * 把 frontmatter 标量值格式化为展示文本。
 * @param value frontmatter 中的标量值。
 * @returns 展示文本；null / undefined 展示为空串。
 */
function formatFrontmatterScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  // 数组内的嵌套对象极少见，退化为 JSON 文本展示。
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export { remarkFrontmatterMetadata };
