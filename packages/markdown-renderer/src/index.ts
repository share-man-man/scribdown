import DOMPurify from "dompurify";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighter } from "shiki";
import { unified } from "unified";

/**
 * Markdown 渲染参数。
 */
export interface RenderMarkdownOptions {
  sanitizeHtml?: boolean;
  sanitize?: (unsafeHtml: string) => string;
}

/**
 * Markdown AST 节点的最小结构。
 */
interface MarkdownNode {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  alt?: string;
  ordered?: boolean;
  spread?: boolean;
  children?: MarkdownNode[];
  data?: MarkdownNodeData;
}

/**
 * Markdown AST 节点上的 HTML 转换元数据。
 */
interface MarkdownNodeData {
  hName?: string;
  hProperties?: Record<string, unknown>;
}

/**
 * 目录中的单个标题条目。
 */
interface TocHeading {
  depth: number;
  id: string;
  index: string;
  text: string;
}

// [TOC] 占位符匹配规则：仅处理独占一段的目录标记。
const TOC_MARKER_PATTERN = /^\s*\[toc]\s*$/i;

// 目录容器类名。
const TOC_CLASS_NAME = "scribdown-toc";

// 目录摘要按钮类名。
const TOC_SUMMARY_CLASS_NAME = "scribdown-toc-summary";

// 目录导航区域类名。
const TOC_NAV_CLASS_NAME = "scribdown-toc-nav";

// 目录列表类名。
const TOC_LIST_CLASS_NAME = "scribdown-toc-list";

// 目录条目类名前缀。
const TOC_ITEM_CLASS_PREFIX = "scribdown-toc-item";

// 目录可访问名称。
const TOC_ARIA_LABEL = "目录";

// 目录摘要显示文本。
const TOC_SUMMARY_TEXT = "目录";

// 空标题生成锚点时使用的前缀。
const EMPTY_HEADING_SLUG_PREFIX = "section";

/**
 * 将 Markdown 文本转换为 HTML。
 * @param markdownText 输入的 Markdown 文本。
 * @param options 渲染控制参数。
 * @returns 渲染后的 HTML 文本。
 */
export async function renderMarkdown(markdownText: string, options: RenderMarkdownOptions = {}): Promise<string> {
  // 渲染流水线：先解析 Markdown 与 GFM 行内标记，再转换为 HTML AST。
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkTableOfContents).use(remarkRehype);

  if (options.sanitizeHtml) {
    // 关键步骤：在输出前执行 rehype 结构清洗。
    processor.use(rehypeSanitize, createScribdownSanitizeSchema());
  }

  processor.use(rehypeStringify);

  // 渲染输出 HTML 文本。
  const renderedHtml = String(await processor.process(markdownText));

  if (!options.sanitizeHtml) {
    return renderedHtml;
  }

  if (options.sanitize) {
    return options.sanitize(renderedHtml);
  }

  return sanitizeHtmlWithDomPurify(renderedHtml);
}

/**
 * 将代码片段渲染为高亮 HTML。
 * @param codeText 代码文本。
 * @param language 代码语言。
 * @returns 高亮后的 HTML 字符串。
 */
export async function renderCodeToHtml(codeText: string, language: string): Promise<string> {
  // 创建一次性高亮器用于最小可运行示例。
  const highlighter = await createHighlighter({
    themes: ["github-light"],
    langs: ["typescript", "javascript", "json", "bash", language]
  });

  return highlighter.codeToHtml(codeText, {
    lang: language,
    theme: "github-light"
  });
}

/**
 * 使用 DOMPurify 清洗 HTML。
 * @param unsafeHtml 未清洗的 HTML。
 * @returns 清洗后的 HTML。
 */
export function sanitizeHtmlWithDomPurify(unsafeHtml: string): string {
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
  // details 元素的属性白名单。
  const detailsAttributes = [
    "open",
    ["className", /^scribdown-toc$/u] as [string, RegExp]
  ];
  // summary 元素的属性白名单。
  const summaryAttributes = [
    ...(defaultAttributes.summary ?? []),
    ["className", /^scribdown-toc-summary$/u] as [string, RegExp]
  ];
  // nav 元素的属性白名单。
  const navAttributes = ["ariaLabel", ["className", /^scribdown-toc-nav$/u] as [string, RegExp]];
  // ol 元素的属性白名单。
  const orderedListAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    ["className", "contains-task-list", TOC_LIST_CLASS_NAME] as [string, string, string]
  ];
  // li 元素的属性白名单。
  const listItemAttributes = [
    "dataTocIndex",
    ["className", "task-list-item", /^scribdown-toc-item(?:--depth-[1-6])?$/u] as [string, string, RegExp]
  ];

  return {
    ...defaultSchema,
    clobberPrefix: "",
    tagNames: Array.from(new Set([...defaultTagNames, "details", "nav", "summary"])),
    attributes: {
      ...defaultAttributes,
      details: detailsAttributes,
      summary: summaryAttributes,
      nav: navAttributes,
      ol: orderedListAttributes,
      li: listItemAttributes
    }
  };
}

/**
 * remark 插件：收集标题、生成标题锚点，并把独占一段的 [TOC] 替换为目录。
 * @returns Markdown AST 转换器。
 */
function remarkTableOfContents(): (tree: MarkdownNode) => void {
  return (tree: MarkdownNode) => {
    // 标题条目，同时会在收集时写入 heading id。
    const tocHeadings = collectTocHeadings(tree);

    // 关键步骤：用目录节点替换所有独占一段的 [TOC]。
    replaceTocMarkers(tree, tocHeadings);
  };
}

/**
 * 收集文档标题并给标题节点写入稳定 id。
 * @param tree Markdown 根节点。
 * @returns 可用于渲染目录的标题列表。
 */
function collectTocHeadings(tree: MarkdownNode): TocHeading[] {
  // 标题 slug 使用次数，用于处理重复标题。
  const headingSlugCounts = new Map<string, number>();
  // 收集到的目录标题条目。
  const tocHeadings: TocHeading[] = [];
  // 各标题层级的计数器，用于生成 1 / 1.1 / 1.1.1 这类目录序号。
  const headingIndexCounts = Array.from({ length: 7 }, () => 0);
  // 文档内最浅标题层级，用作目录序号的根层级。
  let rootHeadingDepth: number | undefined;

  visitMarkdownNode(tree, (node: MarkdownNode) => {
    if (node.type !== "heading") {
      return;
    }

    // 标题层级默认回退到二级标题。
    const headingDepth = node.depth ?? 2;
    // 从标题行内节点提取纯文本。
    const headingText = extractNodeText(node).trim();
    // 为标题生成去重后的锚点。
    const headingId = createUniqueSlug(headingText, headingSlugCounts, tocHeadings.length + 1);
    // 根据标题层级生成目录编号。
    const headingIndex = createHeadingIndex(headingDepth, headingIndexCounts, rootHeadingDepth ?? headingDepth);

    rootHeadingDepth = rootHeadingDepth ?? headingDepth;

    node.data = {
      ...node.data,
      hProperties: {
        ...node.data?.hProperties,
        id: headingId
      }
    };

    tocHeadings.push({
      depth: headingDepth,
      id: headingId,
      index: headingIndex,
      text: headingText || headingId
    });
  });

  return tocHeadings;
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
 * 将 [TOC] 段落替换为目录节点。
 * @param node 当前节点。
 * @param tocHeadings 目录标题条目。
 */
function replaceTocMarkers(node: MarkdownNode, tocHeadings: TocHeading[]): void {
  if (!node.children) {
    return;
  }

  // 当前节点的子节点数组。
  const childNodes = node.children;
  // 子节点索引。
  for (let childIndex = 0; childIndex < childNodes.length; childIndex += 1) {
    // 当前子节点。
    const childNode = childNodes[childIndex];

    if (isTocMarkerParagraph(childNode)) {
      childNodes[childIndex] = createTocNode(tocHeadings);
      continue;
    }

    replaceTocMarkers(childNode, tocHeadings);
  }
}

/**
 * 判断段落是否是独占的 [TOC] 标记。
 * @param node 待判断节点。
 * @returns 当前节点是否为目录占位段落。
 */
function isTocMarkerParagraph(node: MarkdownNode): boolean {
  if (node.type !== "paragraph" || !node.children || node.children.length !== 1) {
    return false;
  }

  // 段落内唯一的行内节点。
  const onlyChild = node.children[0];

  return onlyChild.type === "text" && TOC_MARKER_PATTERN.test(onlyChild.value ?? "");
}

/**
 * 创建目录容器节点。
 * @param tocHeadings 目录标题条目。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocNode(tocHeadings: TocHeading[]): MarkdownNode {
  return {
    type: "toc",
    data: {
      hName: "details",
      hProperties: {
        className: [TOC_CLASS_NAME]
      }
    },
    children: [
      {
        type: "tocSummary",
        data: {
          hName: "summary",
          hProperties: {
            className: [TOC_SUMMARY_CLASS_NAME]
          }
        },
        children: [
          {
            type: "text",
            value: TOC_SUMMARY_TEXT
          }
        ]
      },
      {
        type: "tocNav",
        data: {
          hName: "nav",
          hProperties: {
            ariaLabel: TOC_ARIA_LABEL,
            className: [TOC_NAV_CLASS_NAME]
          }
        },
        children: [
          {
            type: "list",
            ordered: true,
            spread: false,
            data: {
              hProperties: {
                className: [TOC_LIST_CLASS_NAME]
              }
            },
            children: tocHeadings.map(createTocListItem)
          }
        ]
      }
    ]
  };
}

/**
 * 创建目录列表项。
 * @param tocHeading 目录标题条目。
 * @returns Markdown 列表项节点。
 */
function createTocListItem(tocHeading: TocHeading): MarkdownNode {
  return {
    type: "listItem",
    spread: false,
    data: {
      hProperties: {
        dataTocIndex: tocHeading.index,
        className: [TOC_ITEM_CLASS_PREFIX, `${TOC_ITEM_CLASS_PREFIX}--depth-${tocHeading.depth}`]
      }
    },
    children: [
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            url: `#${tocHeading.id}`,
            children: [
              {
                type: "text",
                value: tocHeading.text
              }
            ]
          }
        ]
      }
    ]
  };
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

  if (node.type === "image") {
    return node.alt ?? "";
  }

  if (!node.children) {
    return "";
  }

  return node.children.map(extractNodeText).join("");
}

/**
 * 生成去重后的标题 slug。
 * @param headingText 标题文本。
 * @param slugCounts 已使用 slug 计数。
 * @param fallbackIndex 空标题回退序号。
 * @returns 唯一标题锚点。
 */
function createUniqueSlug(headingText: string, slugCounts: Map<string, number>, fallbackIndex: number): string {
  // 标准化后的基础 slug。
  const normalizedSlug = normalizeSlugText(headingText);
  // 空标题的回退 slug。
  const fallbackSlug = `${EMPTY_HEADING_SLUG_PREFIX}-${fallbackIndex}`;
  // 本次使用的基础 slug。
  const baseSlug = normalizedSlug || fallbackSlug;
  // 当前 slug 已出现次数。
  const usedCount = slugCounts.get(baseSlug) ?? 0;

  slugCounts.set(baseSlug, usedCount + 1);

  if (usedCount === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${usedCount}`;
}

/**
 * 根据标题层级生成目录编号。
 * @param headingDepth 当前标题层级。
 * @param headingIndexCounts 各标题层级已出现次数。
 * @param rootHeadingDepth 目录根标题层级。
 * @returns 层级化目录编号。
 */
function createHeadingIndex(headingDepth: number, headingIndexCounts: number[], rootHeadingDepth: number): string {
  // 起始层级不能超过当前标题层级。
  const startDepth = Math.min(rootHeadingDepth, headingDepth);

  headingIndexCounts[headingDepth] += 1;

  // 关键步骤：当前层级之后的子层级计数失效。
  for (let depthIndex = headingDepth + 1; depthIndex < headingIndexCounts.length; depthIndex += 1) {
    headingIndexCounts[depthIndex] = 0;
  }

  // 补齐被跳过的父级，避免出现 1.0.1 这种编号。
  for (let depthIndex = startDepth; depthIndex < headingDepth; depthIndex += 1) {
    if (headingIndexCounts[depthIndex] === 0) {
      headingIndexCounts[depthIndex] = 1;
    }
  }

  return headingIndexCounts.slice(startDepth, headingDepth + 1).join(".");
}

/**
 * 将标题文本标准化为 URL 片段。
 * @param headingText 标题文本。
 * @returns 标准化后的 slug。
 */
function normalizeSlugText(headingText: string): string {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
