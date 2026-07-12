/**
 * mdast 官方类型的项目级扩展：用 declaration merging（@types/mdast 的官方扩展机制）
 * 注册各渲染插件生成的自定义节点，并提供跨插件共享的少量节点工具。
 * 遍历统一用 unist-util-visit，文本提取统一用 mdast-util-to-string。
 */

import type {
  BlockContent,
  DefinitionContent,
  Image,
  ImageReference,
  Link,
  Node,
  Parent,
  PhrasingContent,
  Text
} from "mdast";
// 关键步骤：加载 mdast-util-to-hast 的类型副作用，为 mdast Data 合入 hName / hProperties 官方增强。
import type {} from "mdast-util-to-hast";
import { toString as mdastToString } from "mdast-util-to-string";

// ── 标题（toc.ts）──────────────────────────────────────────────

/** 标题行内内容的包裹节点，供多行高亮背景样式使用（hName: span）。 */
interface HeadingMark extends Parent {
  type: "headingMark";
  children: PhrasingContent[];
}

/** 目录根节点（hName: details）。 */
interface Toc extends Parent {
  type: "toc";
  children: (TocSummary | TocNav)[];
}

/** 目录摘要节点（hName: summary）。 */
interface TocSummary extends Parent {
  type: "tocSummary";
  children: PhrasingContent[];
}

/** 目录导航容器节点（hName: nav）。 */
interface TocNav extends Parent {
  type: "tocNav";
  children: TocList[];
}

/** 目录列表节点（hName: ol）。 */
interface TocList extends Parent {
  type: "tocList";
  children: TocItem[];
}

/** 目录列表项节点（hName: li）。 */
interface TocItem extends Parent {
  type: "tocItem";
  children: (TocToggle | Link | TocList)[];
}

/** 目录分支折叠按钮节点（hName: button）。 */
interface TocToggle extends Parent {
  type: "tocToggle";
  children: never[];
}

// ── 行内高亮（highlight-mark.ts）───────────────────────────────

/** ==text== 行内高亮节点（hName: mark）。 */
interface HighlightMark extends Parent {
  type: "highlightMark";
  children: PhrasingContent[];
}

// ── 定义列表（definition-lists.ts）─────────────────────────────

/** 定义列表节点（hName: dl）。 */
interface DefinitionList extends Parent {
  type: "definitionList";
  children: (DefinitionTerm | DefinitionDescription)[];
}

/** 定义项名称节点（hName: dt）。 */
interface DefinitionTerm extends Parent {
  type: "definitionTerm";
  children: PhrasingContent[];
}

/** 定义项说明节点（hName: dd）。 */
interface DefinitionDescription extends Parent {
  type: "definitionDescription";
  children: PhrasingContent[];
}

// ── Frontmatter 元数据卡片（frontmatter.ts）────────────────────

/** frontmatter 元数据卡片根节点（hName: div）。 */
interface FrontmatterMetadata extends Parent {
  type: "frontmatterMetadata";
  children: (FrontmatterChrome | FrontmatterList)[];
}

/** 卡片头部装饰条节点（hName: div）。 */
interface FrontmatterChrome extends Parent {
  type: "frontmatterChrome";
  children: FrontmatterLabel[];
}

/** 卡片标签节点（hName: span）。 */
interface FrontmatterLabel extends Parent {
  type: "frontmatterLabel";
  children: PhrasingContent[];
}

/** 键值列表节点（hName: dl）。 */
interface FrontmatterList extends Parent {
  type: "frontmatterList";
  children: (FrontmatterTerm | FrontmatterDescription)[];
}

/** 键名节点（hName: dt）。 */
interface FrontmatterTerm extends Parent {
  type: "frontmatterTerm";
  children: PhrasingContent[];
}

/** 键值节点（hName: dd），对象值递归嵌套键值列表。 */
interface FrontmatterDescription extends Parent {
  type: "frontmatterDescription";
  children: (Text | FrontmatterList)[];
}

// ── 图片 figure（media/images.ts）──────────────────────────────

/** 独占段落图片的 figure 包装节点（hName: figure）。 */
interface ImageFigure extends Parent {
  type: "imageFigure";
  children: (ImageFrame | ImageCaption)[];
}

/** 图片边框容器节点（hName: span）。 */
interface ImageFrame extends Parent {
  type: "imageFrame";
  children: (Image | ImageReference | ImageFallback)[];
}

/** 图片标题节点（hName: figcaption）。 */
interface ImageCaption extends Parent {
  type: "imageCaption";
  children: PhrasingContent[];
}

/** 图片失败态占位节点（hName: span）。 */
interface ImageFallback extends Parent {
  type: "imageFallback";
  children: (ImageFallbackIcon | ImageFallbackText | ImageFallbackSource)[];
}

/** 失败态图标节点（hName: span，无子节点）。 */
interface ImageFallbackIcon extends Node {
  type: "imageFallbackIcon";
}

/** 失败态文案节点（hName: span）。 */
interface ImageFallbackText extends Parent {
  type: "imageFallbackText";
  children: PhrasingContent[];
}

/** 失败态来源路径节点（hName: span）。 */
interface ImageFallbackSource extends Parent {
  type: "imageFallbackSource";
  children: PhrasingContent[];
}

// ── declaration merging：把自定义节点注册进 mdast 内容分类 ──────

declare module "mdast" {
  /** 所有自定义节点都可出现在文档树中，注册进 RootContentMap 使其成为 Nodes 联合的一部分。 */
  interface RootContentMap {
    scribdownHeadingMark: HeadingMark;
    scribdownToc: Toc;
    scribdownTocSummary: TocSummary;
    scribdownTocNav: TocNav;
    scribdownTocList: TocList;
    scribdownTocItem: TocItem;
    scribdownTocToggle: TocToggle;
    scribdownHighlightMark: HighlightMark;
    scribdownDefinitionList: DefinitionList;
    scribdownDefinitionTerm: DefinitionTerm;
    scribdownDefinitionDescription: DefinitionDescription;
    scribdownFrontmatterMetadata: FrontmatterMetadata;
    scribdownFrontmatterChrome: FrontmatterChrome;
    scribdownFrontmatterLabel: FrontmatterLabel;
    scribdownFrontmatterList: FrontmatterList;
    scribdownFrontmatterTerm: FrontmatterTerm;
    scribdownFrontmatterDescription: FrontmatterDescription;
    scribdownImageFigure: ImageFigure;
    scribdownImageFrame: ImageFrame;
    scribdownImageCaption: ImageCaption;
    scribdownImageFallback: ImageFallback;
    scribdownImageFallbackIcon: ImageFallbackIcon;
    scribdownImageFallbackText: ImageFallbackText;
    scribdownImageFallbackSource: ImageFallbackSource;
  }

  /** 可替换段落等块级位置的自定义节点，注册进 BlockContentMap。 */
  interface BlockContentMap {
    scribdownToc: Toc;
    scribdownDefinitionList: DefinitionList;
    scribdownFrontmatterMetadata: FrontmatterMetadata;
    scribdownImageFigure: ImageFigure;
  }

  /** 可出现在行内位置的自定义节点，注册进 PhrasingContentMap。 */
  interface PhrasingContentMap {
    scribdownHeadingMark: HeadingMark;
    scribdownHighlightMark: HighlightMark;
  }
}

/**
 * 从节点及其子节点中提取可读文本。
 * 委托给 remark 官方的 mdast-util-to-string；关闭 includeHtml 以维持
 * 「标题内的行内 HTML 不参与锚点与目录文本」的既有行为。
 * @param node 当前节点。
 * @returns 当前节点的纯文本内容。
 */
function extractNodeText(node: Node): string {
  return mdastToString(node, { includeHtml: false });
}

/**
 * 判断节点是否为图片或引用式图片。
 * @param node 待判断的 Markdown 节点。
 * @returns 当前节点是否为图片节点。
 */
function isImageNode(node: Node): node is Image | ImageReference {
  return node.type === "image" || node.type === "imageReference";
}

export type {
  BlockContent,
  DefinitionContent,
  DefinitionDescription,
  DefinitionList,
  DefinitionTerm,
  FrontmatterChrome,
  FrontmatterDescription,
  FrontmatterLabel,
  FrontmatterList,
  FrontmatterMetadata,
  FrontmatterTerm,
  HeadingMark,
  HighlightMark,
  ImageCaption,
  ImageFallback,
  ImageFallbackIcon,
  ImageFallbackSource,
  ImageFallbackText,
  ImageFigure,
  ImageFrame,
  Toc,
  TocItem,
  TocList,
  TocNav,
  TocSummary,
  TocToggle
};
export { extractNodeText, isImageNode };
