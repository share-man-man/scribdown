import DOMPurify from "dompurify";
import rehypeRaw from "rehype-raw";
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

/**
 * 目录树中的单个标题条目。
 */
interface TocTreeItem extends TocHeading {
  children: TocTreeItem[];
}

// [TOC] 占位符匹配规则：仅处理独占一段的目录标记。
const TOC_MARKER_PATTERN = /^\s*\[toc]\s*$/i;

// 目录容器类名。
const TOC_CLASS_NAME = "scribdown-toc";

// 目录分支容器类名。
const TOC_BRANCH_CLASS_NAME = "scribdown-toc-branch";

// 目录分支摘要类名。
const TOC_BRANCH_SUMMARY_CLASS_NAME = "scribdown-toc-branch-summary";

// 目录分支跳转链接类名。
const TOC_BRANCH_LINK_CLASS_NAME = "scribdown-toc-branch-link";

// 目录摘要按钮类名。
const TOC_SUMMARY_CLASS_NAME = "scribdown-toc-summary";

// 目录导航区域类名。
const TOC_NAV_CLASS_NAME = "scribdown-toc-nav";

// 目录列表类名。
const TOC_LIST_CLASS_NAME = "scribdown-toc-list";

// 目录嵌套列表类名。
const TOC_LIST_NESTED_CLASS_NAME = "scribdown-toc-list--nested";

// 目录条目类名前缀。
const TOC_ITEM_CLASS_PREFIX = "scribdown-toc-item";

// 目录分支条目类名。
const TOC_ITEM_BRANCH_CLASS_NAME = "scribdown-toc-item--branch";

// 目录可访问名称。
const TOC_ARIA_LABEL = "目录";

// 目录摘要显示文本。
const TOC_SUMMARY_TEXT = "目录";

// 目录分支跳转链接显示文本。
const TOC_BRANCH_LINK_TEXT = "#";

// 目录分支跳转链接可访问名称前缀。
const TOC_BRANCH_LINK_ARIA_LABEL_PREFIX = "跳转到";

// 空标题生成锚点时使用的前缀。
const EMPTY_HEADING_SLUG_PREFIX = "section";

// 标题文本包裹层类名：用于按行绘制手绘高亮，确保多行标题每行都有底色。
const HEADING_MARK_CLASS_NAME = "scribdown-heading-mark";

// ==text== 高亮匹配：成对的 == 之间不能换行或再次出现 ==。
const HIGHLIGHT_MARKER_PATTERN = /==([^=\n]+?)==/g;

// 定义列表段落匹配规则：支持 CommonMark 未内建的 term + 下一行冒号定义写法。
const DEFINITION_LIST_PARAGRAPH_PATTERN = /^\s*([^\n:][^\n]*)\n\s*:\s+([^\n]+)\s*$/u;

/**
 * 将 Markdown 文本转换为 HTML。
 * @param markdownText 输入的 Markdown 文本。
 * @param options 渲染控制参数。
 * @returns 渲染后的 HTML 文本。
 */
export async function renderMarkdown(markdownText: string, options: RenderMarkdownOptions = {}): Promise<string> {
  // 渲染流水线：先解析 Markdown 与 GFM 行内标记，再转换为 HTML AST。
  // allowDangerousHtml + rehypeRaw 让 fixture 中的 <u> / <sub> / <sup> / <kbd> 等行内 HTML 保留下来。
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHighlightMark)
    .use(remarkDefinitionLists)
    .use(remarkTableOfContents)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);

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
    ["className", /^scribdown-toc(?:-branch)?$/u] as [string, RegExp]
  ];
  // summary 元素的属性白名单。
  const summaryAttributes = [
    ...(defaultAttributes.summary ?? []),
    ["className", /^scribdown-toc(?:-branch)?-summary$/u] as [string, RegExp]
  ];
  // nav 元素的属性白名单。
  const navAttributes = ["ariaLabel", ["className", /^scribdown-toc-nav$/u] as [string, RegExp]];
  // a 元素的属性白名单。
  const linkAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    "dataFootnoteBackref",
    "dataFootnoteRef",
    ["className", "data-footnote-backref", TOC_BRANCH_LINK_CLASS_NAME] as [string, string, string],
    "href"
  ];
  // ol 元素的属性白名单。
  const orderedListAttributes = [
    "ariaDescribedBy",
    "ariaLabel",
    "ariaLabelledBy",
    ["className", "contains-task-list", /^scribdown-toc-list(?:--nested)?$/u] as [string, string, RegExp]
  ];
  // span 元素的属性白名单：放行标题行内包裹层的 class。
  const spanAttributes = [
    ...(defaultAttributes.span ?? []),
    ["className", HEADING_MARK_CLASS_NAME] as [string, string]
  ];
  // abbr 元素的属性白名单：保留 title 以展示完整释义。
  const abbrAttributes = ["title"];
  // li 元素的属性白名单。
  const listItemAttributes = [
    "dataTocIndex",
    ["className", "task-list-item", /^scribdown-toc-item(?:--(?:branch|depth-[1-6]))?$/u] as [
      string,
      string,
      RegExp
    ]
  ];

  return {
    ...defaultSchema,
    clobberPrefix: "",
    tagNames: Array.from(
      new Set([
        ...defaultTagNames,
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
        "dd"
      ])
    ),
    attributes: {
      ...defaultAttributes,
      details: detailsAttributes,
      summary: summaryAttributes,
      nav: navAttributes,
      a: linkAttributes,
      ol: orderedListAttributes,
      li: listItemAttributes,
      span: spanAttributes,
      abbr: abbrAttributes
    }
  };
}

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

    if (childNode.type === "text" && typeof childNode.value === "string" && childNode.value.includes("==")) {
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

    // 关键步骤：把标题行内内容包进一个 inline 元素，
    // 让样式可以借助 box-decoration-break 在多行间复制高亮背景。
    node.children = [
      {
        type: "headingMark",
        data: {
          hName: "span",
          hProperties: {
            className: [HEADING_MARK_CLASS_NAME]
          }
        },
        children: node.children ?? []
      }
    ];

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
  // 层级化后的目录条目，用于生成可折叠分支。
  const tocTree = createTocTree(tocHeadings);

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
        children: [createTocListNode(tocTree, false)]
      }
    ]
  };
}

/**
 * 将扁平标题列表转换为目录树。
 * @param tocHeadings 扁平目录标题条目。
 * @returns 可生成嵌套目录的树形条目。
 */
function createTocTree(tocHeadings: TocHeading[]): TocTreeItem[] {
  // 目录根节点集合。
  const rootItems: TocTreeItem[] = [];
  // 当前遍历路径上的分支栈。
  const itemStack: TocTreeItem[] = [];

  // 目录标题索引。
  for (let headingIndex = 0; headingIndex < tocHeadings.length; headingIndex += 1) {
    // 当前遍历到的标题条目。
    const tocHeading = tocHeadings[headingIndex];
    // 当前标题转换后的树节点。
    const tocTreeItem: TocTreeItem = {
      ...tocHeading,
      children: []
    };

    // 关键步骤：回退到比当前标题更浅的父级。
    while (itemStack.length > 0 && itemStack[itemStack.length - 1].depth >= tocTreeItem.depth) {
      itemStack.pop();
    }

    if (itemStack.length === 0) {
      rootItems.push(tocTreeItem);
    } else {
      itemStack[itemStack.length - 1].children.push(tocTreeItem);
    }

    itemStack.push(tocTreeItem);
  }

  return rootItems;
}

/**
 * 创建目录列表节点。
 * @param tocItems 当前层级的目录条目。
 * @param isNested 是否为嵌套列表。
 * @returns Markdown 列表节点。
 */
function createTocListNode(tocItems: TocTreeItem[], isNested: boolean): MarkdownNode {
  // 当前目录列表需要输出的类名。
  const tocListClassNames = isNested ? [TOC_LIST_CLASS_NAME, TOC_LIST_NESTED_CLASS_NAME] : [TOC_LIST_CLASS_NAME];

  return {
    type: "list",
    ordered: true,
    spread: false,
    data: {
      hProperties: {
        className: tocListClassNames
      }
    },
    children: tocItems.map(createTocListItem)
  };
}

/**
 * 创建目录列表项。
 * @param tocItem 目录树条目。
 * @returns Markdown 列表项节点。
 */
function createTocListItem(tocItem: TocTreeItem): MarkdownNode {
  // 当前条目是否拥有可折叠的子层级。
  const hasChildren = tocItem.children.length > 0;
  // 当前目录条目的 class 列表。
  const tocItemClassNames = [
    TOC_ITEM_CLASS_PREFIX,
    `${TOC_ITEM_CLASS_PREFIX}--depth-${tocItem.depth}`,
    ...(hasChildren ? [TOC_ITEM_BRANCH_CLASS_NAME] : [])
  ];

  return {
    type: "listItem",
    spread: false,
    data: {
      hProperties: {
        dataTocIndex: tocItem.index,
        className: tocItemClassNames
      }
    },
    children: hasChildren ? [createTocBranchNode(tocItem)] : [createTocLinkParagraphNode(tocItem)]
  };
}

/**
 * 创建可折叠的目录分支节点。
 * @param tocItem 拥有子层级的目录条目。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocBranchNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "tocBranch",
    data: {
      hName: "details",
      hProperties: {
        open: true,
        className: [TOC_BRANCH_CLASS_NAME]
      }
    },
    children: [
      {
        type: "tocBranchSummary",
        data: {
          hName: "summary",
          hProperties: {
            className: [TOC_BRANCH_SUMMARY_CLASS_NAME]
          }
        },
        children: [
          {
            type: "text",
            value: tocItem.text
          },
          createTocBranchLinkNode(tocItem)
        ]
      },
      createTocListNode(tocItem.children, true)
    ]
  };
}

/**
 * 创建目录叶子条目的链接段落。
 * @param tocItem 目录树条目。
 * @returns 包含锚点链接的段落节点。
 */
function createTocLinkParagraphNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "paragraph",
    children: [createTocLinkNode(tocItem)]
  };
}

/**
 * 创建目录标题链接。
 * @param tocItem 目录树条目。
 * @returns Markdown 链接节点。
 */
function createTocLinkNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "link",
    url: `#${tocItem.id}`,
    children: [
      {
        type: "text",
        value: tocItem.text
      }
    ]
  };
}

/**
 * 创建目录分支标题旁的跳转链接。
 * @param tocItem 目录树条目。
 * @returns Markdown 链接节点。
 */
function createTocBranchLinkNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "link",
    url: `#${tocItem.id}`,
    data: {
      hProperties: {
        ariaLabel: `${TOC_BRANCH_LINK_ARIA_LABEL_PREFIX}${tocItem.text}`,
        className: [TOC_BRANCH_LINK_CLASS_NAME]
      }
    },
    children: [
      {
        type: "text",
        value: TOC_BRANCH_LINK_TEXT
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
