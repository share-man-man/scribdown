/**
 * HTML 安全清洗：rehype-sanitize 的 Scribdown 白名单扩展
 * 与 DOMPurify 字符串级二次清洗。
 */

import {
  DETAILS_CLASS_NAME,
  FRAME_CLASS_NAME,
  FRONTMATTER_CHROME_CLASS_NAME,
  FRONTMATTER_CLASS_NAME,
  FRONTMATTER_LABEL_CLASS_NAME,
  FRONTMATTER_LIST_CLASS_NAME,
  FRONTMATTER_LIST_NESTED_CLASS_NAME,
  HEADING_MARK_CLASS_NAME,
  IMAGE_CAPTION_CLASS_NAME,
  IMAGE_ELEMENT_CLASS_NAME,
  IMAGE_FALLBACK_CLASS_NAME,
  IMAGE_FALLBACK_ICON_CLASS_NAME,
  IMAGE_FALLBACK_SOURCE_CLASS_NAME,
  IMAGE_FALLBACK_TEXT_CLASS_NAME,
  IMAGE_FIGURE_CLASS_NAME,
  IMAGE_FRAME_CLASS_NAME,
  TOC_CLASS_NAME,
  TOC_ITEM_CLASS_PREFIX,
  TOC_LINK_CLASS_NAME,
  TOC_LIST_CLASS_NAME,
  TOC_LIST_NESTED_CLASS_NAME,
  TOC_NAV_CLASS_NAME,
  TOC_SUMMARY_CLASS_NAME,
  TOC_TOGGLE_CLASS_NAME,
  VIDEO_ELEMENT_CLASS_NAME,
  VIDEO_FALLBACK_CLASS_NAME,
  VIDEO_FALLBACK_ICON_CLASS_NAME,
  VIDEO_FALLBACK_SOURCE_CLASS_NAME,
  VIDEO_FALLBACK_TEXT_CLASS_NAME,
  VIDEO_FIGURE_CLASS_NAME,
  VIDEO_FRAME_CLASS_NAME
} from "@scribdown/shared";

import DOMPurify from "dompurify";
import { defaultSchema } from "rehype-sanitize";

import { SOURCE_LINE_HAST_PROPERTY } from "./core/source-line";

/**
 * 使用 DOMPurify 清洗 HTML。
 * @param unsafeHtml 未清洗的 HTML。
 * @returns 清洗后的 HTML。
 */
function sanitizeHtmlWithDomPurify(unsafeHtml: string): string {
  // DOMPurify 在 Node 环境下没有绑定 window 时会以工厂形态存在。
  const domPurify = DOMPurify as { sanitize?: (unsafeHtml: string) => string };

  if (typeof domPurify.sanitize !== "function") {
    return unsafeHtml;
  }

  return domPurify.sanitize(unsafeHtml);
}

/**
 * 为 Scribdown 扩展默认 HTML 清洗规则。
 * @returns 支持目录节点 class / nav 的清洗规则。
 */
function createScribdownSanitizeSchema(): typeof defaultSchema {
  // 默认标签白名单。
  const defaultTagNames = defaultSchema.tagNames ?? [];
  // 默认属性白名单。
  const defaultAttributes = defaultSchema.attributes ?? {};
  // details 元素的属性白名单（目录根 + 用户手写折叠块；分支已改用 button，不再用 details）。
  const detailsAttributes = [
    "open",
    ["className", DETAILS_CLASS_NAME, FRAME_CLASS_NAME, TOC_CLASS_NAME] as [
      string,
      string,
      string,
      string
    ]
  ];
  // summary 元素的属性白名单（仅目录根 summary）。
  const summaryAttributes = [
    ...(defaultAttributes.summary ?? []),
    ["className", TOC_SUMMARY_CLASS_NAME] as [string, string]
  ];
  // nav 元素的属性白名单。
  const navAttributes = ["ariaLabel", ["className", TOC_NAV_CLASS_NAME] as [string, string]];
  // a 元素的属性白名单。
  const linkAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    "dataFootnoteBackref",
    "dataFootnoteRef",
    ["className", "data-footnote-backref", TOC_LINK_CLASS_NAME] as [string, string, string],
    "href"
  ];
  // button 元素的属性白名单：仅放行目录分支折叠按钮所需属性，禁止任何事件处理属性。
  const buttonAttributes = [
    "type",
    "ariaExpanded",
    "ariaLabel",
    ["className", TOC_TOGGLE_CLASS_NAME] as [string, string]
  ];
  // ol 元素的属性白名单。
  const orderedListAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    ["className", "contains-task-list", TOC_LIST_CLASS_NAME, TOC_LIST_NESTED_CLASS_NAME] as [
      string,
      ...string[]
    ]
  ];
  // div 元素的属性白名单：放行 frontmatter 元数据卡片容器与 chrome 的 class。
  const divAttributes = [
    ...(defaultAttributes.div ?? []),
    ["className", FRONTMATTER_CLASS_NAME, FRAME_CLASS_NAME, FRONTMATTER_CHROME_CLASS_NAME] as [
      string,
      ...string[]
    ]
  ];
  // dl 元素的属性白名单：放行 frontmatter 键值列表（含嵌套修饰类）的 class。
  const definitionListAttributes = [
    ["className", FRONTMATTER_LIST_CLASS_NAME, FRONTMATTER_LIST_NESTED_CLASS_NAME] as [
      string,
      string,
      string
    ]
  ];
  // span 元素的属性白名单：放行标题行内包裹层与图片 / 视频 frame / fallback 的 class。
  const spanAttributes = [
    ...(defaultAttributes.span ?? []),
    [
      "className",
      HEADING_MARK_CLASS_NAME,
      FRONTMATTER_LABEL_CLASS_NAME,
      IMAGE_FRAME_CLASS_NAME,
      IMAGE_FALLBACK_CLASS_NAME,
      IMAGE_FALLBACK_ICON_CLASS_NAME,
      IMAGE_FALLBACK_TEXT_CLASS_NAME,
      IMAGE_FALLBACK_SOURCE_CLASS_NAME,
      VIDEO_FRAME_CLASS_NAME,
      VIDEO_FALLBACK_CLASS_NAME,
      VIDEO_FALLBACK_ICON_CLASS_NAME,
      VIDEO_FALLBACK_TEXT_CLASS_NAME,
      VIDEO_FALLBACK_SOURCE_CLASS_NAME
    ] as [string, ...string[]]
  ];
  // figure 元素的属性白名单：放行图片 figure 与视频 figure 的 class。
  const figureAttributes = [
    ["className", IMAGE_FIGURE_CLASS_NAME, VIDEO_FIGURE_CLASS_NAME] as [string, string, string]
  ];
  // figcaption 元素的属性白名单。
  const figcaptionAttributes = [["className", IMAGE_CAPTION_CLASS_NAME] as [string, string]];
  // img 元素的属性白名单。
  const imageAttributes = [
    ...(defaultAttributes.img ?? []),
    ["className", IMAGE_ELEMENT_CLASS_NAME] as [string, string]
  ];
  // video 元素的属性白名单：放行常用播放控制属性与统一类名。
  // 禁止任何事件处理属性（默认 schema 不在白名单的属性会被剥除）。
  const videoAttributes = [
    "src",
    "controls",
    "controlsList",
    "width",
    "height",
    "poster",
    "preload",
    "playsInline",
    "muted",
    "loop",
    "autoPlay",
    "crossOrigin",
    ["className", VIDEO_ELEMENT_CLASS_NAME] as [string, string]
  ];
  // source 元素的属性白名单（<video> 多源回退用）。
  const sourceAttributes = ["src", "type", "media"];
  // abbr 元素的属性白名单：保留 title 以展示完整释义。
  const abbrAttributes = ["title"];
  // li 元素的属性白名单。目录条目 class 由统一前缀拼出正则，避免与 shared 常量漂移。
  const listItemAttributes = [
    "dataTocIndex",
    [
      "className",
      "task-list-item",
      new RegExp(`^${TOC_ITEM_CLASS_PREFIX}(?:--(?:branch|depth-[1-6]))?$`, "u")
    ] as [string, string, RegExp]
  ];
  // 通配元素属性白名单：额外放行滚动对齐用的 data-source-line。
  const wildcardAttributes = [...(defaultAttributes["*"] ?? []), SOURCE_LINE_HAST_PROPERTY];

  return {
    ...defaultSchema,
    clobberPrefix: "",
    tagNames: Array.from(
      new Set([
        ...defaultTagNames,
        "button",
        "details",
        "nav",
        "summary",
        "u",
        "mark",
        "sub",
        "sup",
        "kbd",
        "abbr",
        "small",
        "dl",
        "dt",
        "dd",
        "figure",
        "figcaption",
        "video",
        "source"
      ])
    ),
    attributes: {
      ...defaultAttributes,
      "*": wildcardAttributes,
      button: buttonAttributes,
      details: detailsAttributes,
      summary: summaryAttributes,
      nav: navAttributes,
      a: linkAttributes,
      ol: orderedListAttributes,
      li: listItemAttributes,
      div: divAttributes,
      dl: definitionListAttributes,
      span: spanAttributes,
      abbr: abbrAttributes,
      figure: figureAttributes,
      figcaption: figcaptionAttributes,
      img: imageAttributes,
      video: videoAttributes,
      source: sourceAttributes
    }
  };
}

export { sanitizeHtmlWithDomPurify, createScribdownSanitizeSchema };
