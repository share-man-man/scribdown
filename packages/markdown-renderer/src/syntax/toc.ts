/**
 * 目录（TOC）：remark 插件收集标题、生成锚点并把独占段落的 [TOC] 替换为目录；
 * 同时提供从 DOM 收集标题、构建目录 nav 元素（toolbar 侧栏复用）与运行时折叠/跳转绑定。
 */

import {
  FRAME_CLASS_NAME,
  HEADING_MARK_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  TOC_CLASS_NAME,
  TOC_ITEM_BRANCH_CLASS_NAME,
  TOC_ITEM_CLASS_PREFIX,
  TOC_ITEM_COLLAPSED_CLASS_NAME,
  TOC_LINK_CLASS_NAME,
  TOC_LIST_CLASS_NAME,
  TOC_LIST_NESTED_CLASS_NAME,
  TOC_NAV_CLASS_NAME,
  TOC_SUMMARY_CLASS_NAME,
  TOC_TOGGLE_CLASS_NAME
} from "@scribdown/shared";

import { extractNodeText, visitMarkdownNode, type MarkdownNode } from "../core/ast";

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

// 目录分支折叠按钮可访问名称。
const TOC_TOGGLE_ARIA_LABEL = "展开或折叠子目录";

// 目录折叠按钮已绑定交互的标记 dataset 键，保证 hydrate 幂等。
const TOC_TOGGLE_HYDRATED_DATA_KEY = "scribdownTocToggleHydrated";

// 目录标题链接已绑定平滑滚动的标记 dataset 键，保证 hydrate 幂等。
const TOC_LINK_HYDRATED_DATA_KEY = "scribdownTocLinkHydrated";

// 目录可访问名称。
const TOC_ARIA_LABEL = "目录";

// 目录摘要显示文本。
const TOC_SUMMARY_TEXT = "目录";

// 空标题生成锚点时使用的前缀。
const EMPTY_HEADING_SLUG_PREFIX = "section";

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
    const headingIndex = createHeadingIndex(
      headingDepth,
      headingIndexCounts,
      rootHeadingDepth ?? headingDepth
    );

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
      childNodes[childIndex] = createTocNode(tocHeadings, childNode);
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
 * @param markerNode [TOC] 标记段落节点，用于保留源码位置。
 * @returns 可被 remark-rehype 转换为 details 的 Markdown 节点。
 */
function createTocNode(tocHeadings: TocHeading[], markerNode: MarkdownNode): MarkdownNode {
  // 层级化后的目录条目，用于生成可折叠分支。
  const tocTree = createTocTree(tocHeadings);

  return {
    type: "toc",
    // 关键步骤：保留 [TOC] 标记段落的源码位置，使 remarkSourceLine 能为目录标注 data-source-line。
    position: markerNode.position,
    data: {
      hName: "details",
      hProperties: {
        // 关键步骤：目录根 opt-in 手绘边框，再由 toc.css 叠加目录自身样式。
        className: [TOC_CLASS_NAME, FRAME_CLASS_NAME]
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
  const tocListClassNames = isNested
    ? [TOC_LIST_CLASS_NAME, TOC_LIST_NESTED_CLASS_NAME]
    : [TOC_LIST_CLASS_NAME];

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
  const tocItemClassNames = createTocItemClassNames(tocItem.depth, hasChildren);

  // 关键步骤：叶子与分支的标题都用同一个 <a href="#id">（createTocLinkNode）、共用同一套跳转；
  // 分支只是额外在标题前放一个「独立的折叠按钮」、标题后放嵌套子列表。
  // 折叠按钮与标题链接分离，从结构上消除「点标题既跳转又折叠」的冲突。
  const itemChildren: MarkdownNode[] = hasChildren
    ? [createTocToggleNode(), createTocLinkNode(tocItem), createTocListNode(tocItem.children, true)]
    : [createTocLinkNode(tocItem)];

  return {
    type: "listItem",
    spread: false,
    data: {
      hProperties: {
        dataTocIndex: tocItem.index,
        className: tocItemClassNames
      }
    },
    children: itemChildren
  };
}

/**
 * 生成目录条目所需的 class 列表，inline TOC 与 toolbar 抽屉共用。
 * @param depth 标题原始层级。
 * @param hasChildren 是否拥有可折叠子层级。
 * @returns class 列表。
 */
function createTocItemClassNames(depth: number, hasChildren: boolean): string[] {
  return [
    TOC_ITEM_CLASS_PREFIX,
    `${TOC_ITEM_CLASS_PREFIX}--depth-${depth}`,
    ...(hasChildren ? [TOC_ITEM_BRANCH_CLASS_NAME] : [])
  ];
}

/**
 * 创建目录分支的折叠按钮节点（与标题链接分离，专职展开/折叠）。
 * 默认 aria-expanded="true"（展开），运行时由 {@link hydrateToc} 绑定点击切换。
 * @returns 可被 remark-rehype 转换为 button 的 Markdown 节点。
 */
function createTocToggleNode(): MarkdownNode {
  return {
    type: "tocToggle",
    data: {
      hName: "button",
      hProperties: {
        type: "button",
        className: [TOC_TOGGLE_CLASS_NAME],
        ariaExpanded: "true",
        ariaLabel: TOC_TOGGLE_ARIA_LABEL
      }
    },
    children: []
  };
}

/**
 * 创建目录条目的标题跳转链接（叶子与分支共用）。
 * 仅产出原生 <a href="#id">，由宿主锚点处理（webview 拦截器 / 浏览器原生 hash）统一滚动，
 * 渲染器不再附加点击监听，避免与宿主重复触发滚动。
 * @param tocItem 目录树条目。
 * @returns Markdown 链接节点。
 */
function createTocLinkNode(tocItem: TocTreeItem): MarkdownNode {
  return {
    type: "link",
    url: `#${tocItem.id}`,
    data: {
      hProperties: {
        className: [TOC_LINK_CLASS_NAME]
      }
    },
    children: [
      {
        type: "text",
        value: tocItem.text
      }
    ]
  };
}

/**
 * 生成去重后的标题 slug。
 * @param headingText 标题文本。
 * @param slugCounts 已使用 slug 计数。
 * @param fallbackIndex 空标题回退序号。
 * @returns 唯一标题锚点。
 */
function createUniqueSlug(
  headingText: string,
  slugCounts: Map<string, number>,
  fallbackIndex: number
): string {
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
function createHeadingIndex(
  headingDepth: number,
  headingIndexCounts: number[],
  rootHeadingDepth: number
): string {
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

/**
 * 从已渲染的 DOM 中收集带 id 的标题，转换为目录条目。
 * 与 inline TOC 共用 {@link createHeadingIndex} 生成层级编号，使 toolbar 抽屉与文档内目录的层级逻辑一致。
 * @param rootElement 含 Markdown 渲染结果的根节点。
 * @returns 扁平目录标题条目。
 */
function collectTocHeadingsFromDom(rootElement: ParentNode): TocHeading[] {
  /** Markdown 渲染容器；rootElement 自身或其后代命中 .scribdown-markdown 时即视为容器，否则视为未渲染。 */
  const markdownContainer =
    rootElement instanceof Element && rootElement.matches(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`)
      ? rootElement
      : rootElement.querySelector<HTMLElement>(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`);
  if (!markdownContainer) {
    return [];
  }

  /** 渲染区域内所有带 id 的标题元素。 */
  const headingElements = Array.from(
    markdownContainer.querySelectorAll<HTMLHeadingElement>(
      "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"
    )
  );

  /** 收集结果。 */
  const tocHeadings: TocHeading[] = [];
  /** 各标题层级的计数器。 */
  const headingIndexCounts = Array.from({ length: 7 }, () => 0);
  /** 文档内首个标题的层级，作为目录序号根层级。 */
  let rootHeadingDepth: number | undefined;

  for (const headingElement of headingElements) {
    // 从标签名解析当前标题层级（h1..h6）。
    const headingDepth = parseInt(headingElement.tagName.slice(1), 10);
    if (!Number.isFinite(headingDepth)) {
      continue;
    }

    // 标题可见文本。
    const headingText = headingElement.textContent?.trim() ?? "";
    // 标题锚点 id，由 inline TOC 渲染时写入。
    const headingId = headingElement.id;
    // 与 inline TOC 共用的层级编号生成逻辑。
    const headingIndex = createHeadingIndex(
      headingDepth,
      headingIndexCounts,
      rootHeadingDepth ?? headingDepth
    );
    rootHeadingDepth = rootHeadingDepth ?? headingDepth;

    tocHeadings.push({
      depth: headingDepth,
      id: headingId,
      index: headingIndex,
      text: headingText || headingId
    });
  }

  return tocHeadings;
}

/**
 * 用与 inline TOC 完全一致的结构构建目录 nav 节点（toolbar 侧栏复用）。
 * 标题统一为原生 <a href="#id">（跳转交给宿主锚点处理），分支额外带独立折叠按钮 + 嵌套列表；
 * 折叠交互由挂载后调用的 {@link hydrateToc} 统一绑定。
 * @param ownerDocument 目标 document。
 * @param tocTreeItems 目录树根节点集合。
 * @returns 含完整目录列表的 nav 元素。
 */
function createTocNavElement(ownerDocument: Document, tocTreeItems: TocTreeItem[]): HTMLElement {
  const navElement = ownerDocument.createElement("nav");
  navElement.setAttribute("aria-label", TOC_ARIA_LABEL);
  navElement.className = TOC_NAV_CLASS_NAME;
  navElement.appendChild(createTocListElement(ownerDocument, tocTreeItems, false));
  return navElement;
}

/**
 * 构造目录列表元素，与 inline TOC 的 ol 结构保持一致。
 * @param ownerDocument 目标 document。
 * @param tocItems 当前层级的目录条目。
 * @param isNested 是否为嵌套列表。
 * @param options 共享构造选项。
 * @returns ol 列表元素。
 */
function createTocListElement(
  ownerDocument: Document,
  tocItems: TocTreeItem[],
  isNested: boolean
): HTMLOListElement {
  const listElement = ownerDocument.createElement("ol");
  listElement.className = isNested
    ? `${TOC_LIST_CLASS_NAME} ${TOC_LIST_NESTED_CLASS_NAME}`
    : TOC_LIST_CLASS_NAME;

  for (const tocItem of tocItems) {
    listElement.appendChild(createTocListItemElement(ownerDocument, tocItem));
  }

  return listElement;
}

/**
 * 构造目录列表项（li）：叶子与分支共用同一个标题链接 <a href="#id">。
 * 分支额外在标题前插入「独立折叠按钮」、标题后插入嵌套子列表；不再用 <details>/<summary>，
 * 从结构上消除「点标题既跳转又折叠」的冲突与 offsetX 像素 hack。
 * 跳转交给宿主锚点处理（不挂渲染器点击监听，避免与宿主重复触发滚动）；
 * 折叠交互由 {@link hydrateToc} 在挂载后统一绑定。
 * @param ownerDocument 目标 document。
 * @param tocItem 当前目录条目。
 * @returns li 元素。
 */
function createTocListItemElement(ownerDocument: Document, tocItem: TocTreeItem): HTMLLIElement {
  /** 当前条目是否拥有可折叠的子层级。 */
  const hasChildren = tocItem.children.length > 0;

  const itemElement = ownerDocument.createElement("li");
  itemElement.className = createTocItemClassNames(tocItem.depth, hasChildren).join(" ");
  itemElement.dataset.tocIndex = tocItem.index;

  // 分支：标题前插入独立折叠按钮（与 inline TOC 同构，hydrate 时绑定展开/折叠）。
  if (hasChildren) {
    const toggleElement = ownerDocument.createElement("button");
    toggleElement.type = "button";
    toggleElement.className = TOC_TOGGLE_CLASS_NAME;
    toggleElement.setAttribute("aria-expanded", "true");
    toggleElement.setAttribute("aria-label", TOC_TOGGLE_ARIA_LABEL);
    itemElement.appendChild(toggleElement);
  }

  // 标题链接：叶子与分支完全相同，仅产出原生 <a href="#id">，跳转交给宿主锚点处理。
  const linkElement = ownerDocument.createElement("a");
  linkElement.className = TOC_LINK_CLASS_NAME;
  linkElement.href = `#${tocItem.id}`;
  linkElement.textContent = tocItem.text;
  itemElement.appendChild(linkElement);

  // 分支：标题后插入嵌套子列表。
  if (hasChildren) {
    itemElement.appendChild(createTocListElement(ownerDocument, tocItem.children, true));
  }

  return itemElement;
}

/**
 * 为目录绑定运行时交互（inline TOC 与 toolbar 侧栏共用）：
 * 1. 分支折叠按钮的展开/折叠；
 * 2. 标题链接的跳转 —— 在冒泡阶段拦截原生 hash 跳转，改用注入的 scrollToHeading 滚动到标题
 *    （webview 宿主拦截器对 .scribdown-toc-link 放行，跳转滚动完全交给这里）。
 * 滚动实现由宿主注入（缺省原生平滑），渲染器只负责调用——平台差异落在 apps/* 各宿主。
 * 幂等：已绑定过的元素（带 hydrate 标记）跳过，可安全在每次 hydrate / 挂载时重复调用。
 * @param rootElement 含目录结构的根节点。
 * @param scrollToHeading 跳转到目标标题的滚动实现（由宿主注入）。
 */
function hydrateToc(
  rootElement: ParentNode,
  scrollToHeading: (targetElement: HTMLElement) => void
): void {
  // 根节点内所有目录折叠按钮。
  const toggleElements = rootElement.querySelectorAll<HTMLButtonElement>(
    `button.${TOC_TOGGLE_CLASS_NAME}`
  );

  toggleElements.forEach((toggleElement) => {
    if (toggleElement.dataset[TOC_TOGGLE_HYDRATED_DATA_KEY] === "true") {
      return;
    }
    toggleElement.dataset[TOC_TOGGLE_HYDRATED_DATA_KEY] = "true";

    toggleElement.addEventListener("click", () => {
      // 按钮所属的目录条目（承载折叠态 class，并包含待显隐的嵌套列表）。
      const itemElement = toggleElement.closest<HTMLLIElement>(`.${TOC_ITEM_CLASS_PREFIX}`);
      if (!itemElement) {
        return;
      }
      // 切换后是否处于折叠态。
      const nextCollapsed = !itemElement.classList.contains(TOC_ITEM_COLLAPSED_CLASS_NAME);
      itemElement.classList.toggle(TOC_ITEM_COLLAPSED_CLASS_NAME, nextCollapsed);
      // 关键步骤：aria-expanded 与折叠态保持同步，供无障碍读屏与 CSS 箭头朝向使用。
      toggleElement.setAttribute("aria-expanded", String(!nextCollapsed));
    });
  });

  // 根节点内所有目录标题跳转链接。
  const linkElements = rootElement.querySelectorAll<HTMLAnchorElement>(
    `a.${TOC_LINK_CLASS_NAME}`
  );

  linkElements.forEach((linkElement) => {
    if (linkElement.dataset[TOC_LINK_HYDRATED_DATA_KEY] === "true") {
      return;
    }
    linkElement.dataset[TOC_LINK_HYDRATED_DATA_KEY] = "true";

    linkElement.addEventListener("click", (event) => {
      // 关键步骤：拦截原生 hash 跳转（webview 下会触发被 CSP 拦截的 iframe 导航），
      // 改由宿主注入的 scrollToHeading 滚动定位。
      event.preventDefault();
      // 链接所属 document。
      const ownerDocument = linkElement.ownerDocument;
      // 目标标题 id（去掉前导 #）。
      const rawTargetId = (linkElement.getAttribute("href") ?? "").slice(1);
      if (!rawTargetId) {
        return;
      }
      // 目标标题元素：优先按原文匹配，失败再尝试解码兜底（兼容被编码的中文 id）。
      let targetElement = ownerDocument.getElementById(rawTargetId);
      if (!targetElement) {
        try {
          targetElement = ownerDocument.getElementById(decodeURIComponent(rawTargetId));
        } catch {
          targetElement = null;
        }
      }
      if (targetElement) {
        scrollToHeading(targetElement);
      }
    });
  });
}

export type { TocHeading, TocTreeItem };
export {
  remarkTableOfContents,
  hydrateToc,
  collectTocHeadingsFromDom,
  createTocTree,
  createTocNavElement
};
