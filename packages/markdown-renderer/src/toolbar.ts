/**
 * 浮动页面工具栏：目录侧栏、「更多」菜单（回到顶部 / 页面宽度 / 关于）
 * 与当前章节 scrollspy 指示器。
 */

import {
  CONTENT_WIDTH_STORAGE_KEY,
  PROJECT_HOMEPAGE_URL,
  SCRIBDOWN_CONTENT_AREA_CLASS_NAME,
  SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_THIN_SCROLLBAR_CLASS_NAME,
  SCRIBDOWN_TOC_HOST_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_CURRENT_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_CURRENT_TEXT_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_GROUP_CHOICES_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_GROUP_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SELECT_CHEVRON_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SELECT_LABEL_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SELECT_VALUE_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_LABEL_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_MARK_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_TOC_PANEL_CLOSE_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_TOC_PANEL_EMPTY_CLASS_NAME,
  SCRIBDOWN_TOOLBAR_TOC_PANEL_TITLE_CLASS_NAME,
  TOC_LINK_ACTIVE_CLASS_NAME,
  TOC_LINK_CLASS_NAME
} from "@scribdown/shared";

import {
  collectTocHeadingsFromDom,
  createTocNavElement,
  createTocTree,
  hydrateToc
} from "./syntax/toc";

// ─── Page Toolbar ────────────────────────────────────────────────────────────

// 页面宽度预设列表（label 用于按钮徽章，value 为 CSS max-width 值）。
const TOOLBAR_WIDTH_PRESETS: Array<{ label: string; value: string }> = [
  { label: "680", value: "680px" },
  { label: "840", value: "840px" },
  { label: "1080", value: "1080px" },
  { label: "100%", value: "100%" }
];

// 默认内容宽度。
const TOOLBAR_DEFAULT_WIDTH = "840px";

/**
 * 从 localStorage 读取已保存的内容宽度，不可用时返回默认值。
 * @returns 宽度 CSS 值字符串。
 */
function loadContentWidth(): string {
  try {
    return localStorage.getItem(CONTENT_WIDTH_STORAGE_KEY) ?? TOOLBAR_DEFAULT_WIDTH;
  } catch {
    return TOOLBAR_DEFAULT_WIDTH;
  }
}

/**
 * 将内容宽度写入 localStorage。
 * @param value 宽度 CSS 值字符串。
 */
function saveContentWidth(value: string): void {
  try {
    localStorage.setItem(CONTENT_WIDTH_STORAGE_KEY, value);
  } catch {
    // localStorage 不可用时静默跳过。
  }
}

/**
 * 把内容宽度应用到文档根节点的 CSS 自定义属性。
 * @param ownerDocument 目标 document。
 * @param value 宽度 CSS 值字符串。
 */
function applyContentWidth(ownerDocument: Document, value: string): void {
  ownerDocument.documentElement.style.setProperty("--scribdown-content-width", value);
}

/**
 * 创建一个工具栏按钮。
 * @param ownerDocument 目标 document。
 * @param ariaLabel 可访问名称（同时用作 tooltip）。
 * @param svgContent 按钮内嵌 SVG 字符串。
 * @returns 按钮元素。
 */
function createPageToolbarBtn(
  ownerDocument: Document,
  ariaLabel: string,
  svgContent: string
): HTMLButtonElement {
  const btn = ownerDocument.createElement("button");
  btn.type = "button";
  btn.className = SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME;
  btn.setAttribute("aria-label", ariaLabel);
  btn.innerHTML = svgContent;
  return btn;
}

/**
 * 工具栏目录按钮的内嵌 SVG 字符串。
 */
const TOOLBAR_TOC_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<line x1="3" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<line x1="3" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  "</svg>";

/**
 * 工具栏「更多」按钮的内嵌 SVG 字符串（三个横向点）。
 */
const TOOLBAR_MORE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<circle cx="4" cy="9" r="1.4" fill="currentColor"/>' +
  '<circle cx="9" cy="9" r="1.4" fill="currentColor"/>' +
  '<circle cx="14" cy="9" r="1.4" fill="currentColor"/>' +
  "</svg>";

/**
 * 「回到顶部」菜单项的内嵌 SVG 字符串。
 */
const TOOLBAR_BACK_TOP_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M9 14V5M9 5L5 9M9 5l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<line x1="4" y1="3.5" x2="14" y2="3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  "</svg>";

/**
 * 「切换页面宽度」菜单项的内嵌 SVG 字符串。
 */
const TOOLBAR_WIDTH_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M3 6v6M15 6v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<path d="M5.5 9H3l2.5-2.5M3 9l2.5 2.5M12.5 9H15l-2.5-2.5M15 9l-2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

/**
 * 「关于」菜单项的内嵌 SVG 字符串（信息图标）。
 */
const TOOLBAR_ABOUT_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6"/>' +
  '<path d="M9 8v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="9" cy="5.6" r="0.9" fill="currentColor"/>' +
  "</svg>";

/**
 * 每个 container 上当前工具栏实例的清理函数。
 * 重复挂载前先调用，断开上一轮注册在 document / window 上的监听
 * （「更多」菜单的点外部收起、scrollspy 的 scroll/resize），避免监听堆积与对已卸载 DOM 的写入。
 */
const pageToolbarTeardowns = new WeakMap<Element, () => void>();

/**
 * 在指定容器内构造并挂载浮动工具栏：横向「目录」+「更多」两个入口。
 * 「更多」下拉菜单承载回到顶部、切换页面宽度等次要功能。
 * 重复调用时先清理 container 内的旧实例，保证每次 hydrate 只有一个工具栏。
 * 浏览器环境检查由对外的 {@link mountMarkdownToolbar} 完成。
 * @param ownerDocument 目标 document。
 * @param container 工具栏与目录抽屉的物理挂载点，同时作为目录采集作用域。
 * @param scrollToHeading 目录跳转到目标标题的滚动实现（由宿主注入）。
 */
function mountPageToolbar(
  ownerDocument: Document,
  container: Element,
  scrollToHeading: (targetElement: HTMLElement) => void
): void {
  // 关键步骤：重挂载前先执行上一轮实例的清理，断开 document / window 监听，避免重复绑定。
  pageToolbarTeardowns.get(container)?.();
  pageToolbarTeardowns.delete(container);

  /** 本轮实例的清理回调集合，挂载过程中注册的全局监听都在此登记，重挂载前统一断开。 */
  const teardownCallbacks: Array<() => void> = [];

  // 移除 container 作用域内的旧实例，避免重渲染后重复挂载。
  container.querySelector(`:scope > .${SCRIBDOWN_TOOLBAR_CLASS_NAME}`)?.remove();
  container.querySelector(`:scope > .${SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME}`)?.remove();

  // 关键步骤：把 container 已有内容包进 .scribdown-content-area > .scribdown-content-scroll，
  // 形成统一布局：container 是 flex 容器（TOC + 正文横向并列），content-area flex:1 占满剩余宽度，
  // 其内部的 content-scroll 以 absolute+inset:0 铺满并承载横向 / 纵向滚动（外层不滚动）。
  // 幂等：复用已存在的 wrapper / 滚动层，避免重复包装。
  container.classList.add(SCRIBDOWN_TOC_HOST_CLASS_NAME);

  /** 正文列容器（flex item，占满 TOC 之外的剩余宽度，作为滚动层的定位上下文）。 */
  let contentArea = container.querySelector(
    `:scope > .${SCRIBDOWN_CONTENT_AREA_CLASS_NAME}`
  ) as HTMLElement | null;
  if (!contentArea) {
    contentArea = ownerDocument.createElement("div");
    contentArea.className = SCRIBDOWN_CONTENT_AREA_CLASS_NAME;
    container.appendChild(contentArea);
  }

  /** 正文内部滚动层（absolute+inset:0 铺满 content-area，正文实际在此滚动）。 */
  let contentScroll = contentArea.querySelector(
    `:scope > .${SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME}`
  ) as HTMLElement | null;
  if (!contentScroll) {
    contentScroll = ownerDocument.createElement("div");
    // 关键步骤：正文滚动层与目录侧栏共用同一套细滚动条样式，显式 opt-in 引入。
    contentScroll.className = `${SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME} ${SCRIBDOWN_THIN_SCROLLBAR_CLASS_NAME}`;
    contentArea.appendChild(contentScroll);
  }

  // 关键步骤：把散落在 container / content-area 下的「裸正文内容」（剔除工具栏 / 侧栏 / 两层 wrapper 自身）
  // 全部归集进滚动层；首次挂载时正文原本直接挂在 container 下，需移入，幂等情况下已在层内不会重复搬动。
  const contentScrollElement = contentScroll;
  const contentAreaElement = contentArea;
  [...Array.from(container.children), ...Array.from(contentArea.children)].forEach((child) => {
    if (
      child === contentAreaElement ||
      child === contentScrollElement ||
      child.classList.contains(SCRIBDOWN_TOOLBAR_CLASS_NAME) ||
      child.classList.contains(SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME)
    ) {
      return;
    }
    contentScrollElement.appendChild(child);
  });

  const ownerWindow = ownerDocument.defaultView;

  /** 工具栏容器（横向布局，仅承载「目录」「更多」两个入口）。 */
  const toolbar = ownerDocument.createElement("div");
  toolbar.className = SCRIBDOWN_TOOLBAR_CLASS_NAME;

  // ── 目录抽屉（按钮回调需要引用，先建好）──
  /** 目录浮动面板。 */
  const tocPanel = ownerDocument.createElement("div");
  // 关键步骤：目录侧栏与正文滚动层共用同一套细滚动条样式，显式 opt-in 引入。
  tocPanel.className = `${SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME} ${SCRIBDOWN_THIN_SCROLLBAR_CLASS_NAME}`;

  const tocTitle = ownerDocument.createElement("div");
  tocTitle.className = SCRIBDOWN_TOOLBAR_TOC_PANEL_TITLE_CLASS_NAME;

  /** 抽屉顶部标题文本节点。 */
  const tocTitleText = ownerDocument.createElement("span");
  tocTitleText.textContent = "目录";
  tocTitle.appendChild(tocTitleText);

  /** 抽屉关闭按钮（右上角 ×）。 */
  const tocCloseBtn = ownerDocument.createElement("button");
  tocCloseBtn.type = "button";
  tocCloseBtn.className = SCRIBDOWN_TOOLBAR_TOC_PANEL_CLOSE_CLASS_NAME;
  tocCloseBtn.setAttribute("aria-label", "关闭目录");
  tocCloseBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>";
  /**
   * 切换目录侧栏的展开态：margin-left 由 CSS 配合 `.is-open` 在 flex 流中切换收起/展开。
   * @param open 是否打开侧栏。
   */
  const setTocOpen = (open: boolean): void => {
    tocPanel.classList.toggle("is-open", open);
  };

  tocCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTocOpen(false);
  });
  tocTitle.appendChild(tocCloseBtn);

  tocPanel.appendChild(tocTitle);

  // 关键步骤：与 inline [TOC] 共用层级数据 + DOM 结构，确保两处目录的层级渲染逻辑一致。
  const tocHeadings = collectTocHeadingsFromDom(container);
  if (tocHeadings.length === 0) {
    const emptyElement = ownerDocument.createElement("p");
    emptyElement.className = SCRIBDOWN_TOOLBAR_TOC_PANEL_EMPTY_CLASS_NAME;
    emptyElement.textContent = "暂无标题";
    tocPanel.appendChild(emptyElement);
  } else {
    const tocTree = createTocTree(tocHeadings);
    // 关键步骤：与 inline [TOC] 共用同一个 createTocNavElement —— 叶子/分支同元素、同跳转。
    // 标题为原生 <a href="#id">；折叠按钮与标题跳转随后由 hydrateToc 绑定，滚动用注入实现。
    const tocNavElement = createTocNavElement(ownerDocument, tocTree);
    tocPanel.appendChild(tocNavElement);
    hydrateToc(tocNavElement, scrollToHeading);
  }

  // ── 目录按钮（工具栏第 1 个入口） ──
  /** 目录切换按钮。 */
  const tocBtn = createPageToolbarBtn(ownerDocument, "目录", TOOLBAR_TOC_ICON_SVG);

  // ── 更多按钮（工具栏第 2 个入口） ──
  /** 「更多」按钮，点击展开下拉菜单。 */
  const moreBtn = createPageToolbarBtn(ownerDocument, "更多", TOOLBAR_MORE_ICON_SVG);
  moreBtn.classList.add(`${SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME}--more`);
  moreBtn.setAttribute("aria-haspopup", "menu");
  moreBtn.setAttribute("aria-expanded", "false");

  // ── 更多下拉菜单 ──
  /** 「更多」下拉菜单容器。 */
  const menu = ownerDocument.createElement("div");
  menu.className = SCRIBDOWN_TOOLBAR_MENU_CLASS_NAME;
  menu.setAttribute("role", "menu");

  // 菜单项：切换页面宽度（下拉选择）
  // 关键步骤：宽度初始 index 取自 localStorage，兜底到默认宽度档位。
  let widthIndex = TOOLBAR_WIDTH_PRESETS.findIndex((p) => p.value === loadContentWidth());
  if (widthIndex === -1) {
    widthIndex = TOOLBAR_WIDTH_PRESETS.findIndex((p) => p.value === TOOLBAR_DEFAULT_WIDTH);
  }

  /** 宽度切换分组容器（包裹触发行与可折叠的档位列表）。 */
  const widthGroup = ownerDocument.createElement("div");
  widthGroup.className = SCRIBDOWN_TOOLBAR_MENU_GROUP_CLASS_NAME;

  /** 宽度下拉触发行：左侧 icon + 文字、右侧当前档位值 + chevron。 */
  const widthTrigger = ownerDocument.createElement("button");
  widthTrigger.type = "button";
  widthTrigger.className = `${SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME} ${SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME}--select`;
  widthTrigger.setAttribute("role", "menuitem");
  widthTrigger.setAttribute("aria-haspopup", "listbox");
  widthTrigger.setAttribute("aria-expanded", "false");

  /** 触发行内当前档位值展示节点，切换档位时同步更新文本。 */
  const widthValueElement = ownerDocument.createElement("span");
  widthValueElement.className = SCRIBDOWN_TOOLBAR_MENU_SELECT_VALUE_CLASS_NAME;
  widthValueElement.textContent = TOOLBAR_WIDTH_PRESETS[widthIndex].label;

  widthTrigger.innerHTML = `${TOOLBAR_WIDTH_ICON_SVG}<span class="${SCRIBDOWN_TOOLBAR_MENU_SELECT_LABEL_CLASS_NAME}">页面宽度</span>`;
  widthTrigger.appendChild(widthValueElement);
  widthTrigger.insertAdjacentHTML(
    "beforeend",
    `<svg class="${SCRIBDOWN_TOOLBAR_MENU_SELECT_CHEVRON_CLASS_NAME}" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">` +
      '<path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
  );

  widthGroup.appendChild(widthTrigger);

  /** 宽度档位列表（垂直 listbox，默认折叠，is-open 时展开）。 */
  const widthChoices = ownerDocument.createElement("div");
  widthChoices.className = SCRIBDOWN_TOOLBAR_MENU_GROUP_CHOICES_CLASS_NAME;
  widthChoices.setAttribute("role", "listbox");

  /** 已渲染的宽度子项 DOM 列表，用于切换 aria-selected。 */
  const widthSubItems: HTMLButtonElement[] = [];
  TOOLBAR_WIDTH_PRESETS.forEach((preset, idx) => {
    /** 单个宽度档位选项按钮。 */
    const subItem = ownerDocument.createElement("button");
    subItem.type = "button";
    subItem.className = SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_CLASS_NAME;
    subItem.setAttribute("role", "option");
    subItem.setAttribute("aria-selected", String(idx === widthIndex));
    // 关键步骤：左侧勾选位预留固定宽度的占位，未选中时不可见，避免标签左右抖动。
    subItem.innerHTML =
      `<span class="${SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_MARK_CLASS_NAME}" aria-hidden="true">` +
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none">' +
      '<path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>" +
      `</span><span class="${SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_LABEL_CLASS_NAME}">${preset.label}</span>`;
    subItem.addEventListener("click", () => {
      widthIndex = idx;
      applyContentWidth(ownerDocument, preset.value);
      saveContentWidth(preset.value);
      widthValueElement.textContent = preset.label;
      widthSubItems.forEach((item, i) => {
        item.setAttribute("aria-selected", String(i === idx));
      });
      // 选完后收起下拉，更多菜单整体保持开启便于继续操作其他项。
      closeWidthSelect();
    });
    widthChoices.appendChild(subItem);
    widthSubItems.push(subItem);
  });
  widthGroup.appendChild(widthChoices);

  /** 关闭宽度下拉并同步 aria 状态。 */
  const closeWidthSelect = (): void => {
    widthGroup.classList.remove("is-open");
    widthTrigger.setAttribute("aria-expanded", "false");
  };

  widthTrigger.addEventListener("click", () => {
    const opened = widthGroup.classList.toggle("is-open");
    widthTrigger.setAttribute("aria-expanded", String(opened));
  });

  /** 关闭「更多」菜单并同步 aria 状态，同时重置嵌套的宽度下拉。 */
  const closeMoreMenu = (): void => {
    menu.classList.remove("is-open");
    moreBtn.setAttribute("aria-expanded", "false");
    closeWidthSelect();
  };

  // 菜单项：回到顶部（声明顺序晚于 closeMoreMenu，便于在点击回调里关闭整个菜单）。
  /** 「回到顶部」菜单项。 */
  const backTopItem = ownerDocument.createElement("button");
  backTopItem.type = "button";
  backTopItem.className = SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME;
  backTopItem.setAttribute("role", "menuitem");
  backTopItem.innerHTML = `${TOOLBAR_BACK_TOP_ICON_SVG}<span>回到顶部</span>`;
  backTopItem.addEventListener("click", () => {
    // 关键步骤：正文滚动容器是 .scribdown-content-scroll，优先滚动它回到顶部；
    // 同时兜底滚动 window，兼容仍以整页滚动的宿主（无害的空操作）。
    contentScroll?.scrollTo({ top: 0, behavior: "smooth" });
    ownerWindow?.scrollTo({ top: 0, behavior: "smooth" });
    closeMoreMenu();
  });

  // 菜单项：关于（点击在新标签页打开项目 GitHub Pages 主页）。
  // 关键步骤：用原生 <a> 而非 button + window.open —— VS Code Webview 沙箱禁用 window.open，
  // 但 <a> 点击会被 Webview 侧的链接拦截器捕获并转交扩展进程 openExternal；
  // 浏览器宿主则直接走原生新标签页行为，两端共用同一实现。
  /** 「关于」菜单项。 */
  const aboutItem = ownerDocument.createElement("a");
  aboutItem.href = PROJECT_HOMEPAGE_URL;
  aboutItem.target = "_blank";
  // noopener/noreferrer 阻断被打开页对本页的引用。
  aboutItem.rel = "noopener noreferrer";
  aboutItem.className = SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME;
  aboutItem.setAttribute("role", "menuitem");
  aboutItem.innerHTML = `${TOOLBAR_ABOUT_ICON_SVG}<span>关于</span>`;
  aboutItem.addEventListener("click", () => {
    closeMoreMenu();
  });

  // 关键步骤：菜单项按可见顺序追加 —— 回到顶部 → 切换页面宽度（下拉）→ 关于。
  menu.appendChild(backTopItem);
  menu.appendChild(widthGroup);
  menu.appendChild(aboutItem);

  tocBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    /** 切换前 tocPanel 是否打开。 */
    const wasOpen = tocPanel.classList.contains("is-open");
    setTocOpen(!wasOpen);
    // 打开目录侧栏时同时收起更多菜单，避免视觉重叠。
    if (!wasOpen) {
      closeMoreMenu();
    }
  });

  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opened = menu.classList.toggle("is-open");
    moreBtn.setAttribute("aria-expanded", String(opened));
  });

  // 点击「更多」菜单外部时收起菜单；目录侧栏不参与外部点击关闭，
  // 仅由目录按钮再次点击或侧栏顶部 × 主动关闭，避免阅读时误触收起。
  /** document 级点外部收起监听，随实例清理移除，避免重挂载后监听堆积。 */
  const handleDocumentClick = (e: MouseEvent): void => {
    const target = e.target as Node;
    if (!menu.contains(target) && target !== moreBtn) {
      closeMoreMenu();
    }
  };
  ownerDocument.addEventListener("click", handleDocumentClick);
  teardownCallbacks.push(() => {
    ownerDocument.removeEventListener("click", handleDocumentClick);
  });

  // ── 当前章节指示器（工具栏最左侧）──
  // 关键步骤：收集正文标题做 scrollspy，随滚动展示「当前可视区」所属标题；
  // 窄条最宽 30px、超出省略号，hover 时由 ::after 读取 aria-label 显示全文。
  /** 正文 Markdown 容器，作为标题采集作用域。 */
  const markdownContainer = container.matches(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`)
    ? (container as HTMLElement)
    : container.querySelector<HTMLElement>(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`);
  /** 正文内全部带 id 的标题元素，按文档顺序排列，用于判定当前章节。 */
  const headingElements = markdownContainer
    ? Array.from(
        markdownContainer.querySelectorAll<HTMLHeadingElement>(
          "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"
        )
      )
    : [];

  if (headingElements.length > 0) {
    /** 判定线：标题 top 越过工具栏下沿（距视口顶 48px）即视为已进入当前章节。 */
    const ACTIVE_HEADING_OFFSET = 48;

    /** 指示器容器（position:relative 承载 hover tip），点击跳转到当前章节标题。 */
    const currentHeading = ownerDocument.createElement("div");
    currentHeading.className = SCRIBDOWN_TOOLBAR_CURRENT_CLASS_NAME;
    // 关键步骤：作为可点击元素暴露给辅助技术，并支持键盘聚焦 / 触发。
    currentHeading.setAttribute("role", "button");
    currentHeading.tabIndex = 0;

    /** 指示器可见文本节点（max-width 30px，超出省略号）。 */
    const currentHeadingText = ownerDocument.createElement("span");
    currentHeadingText.className = SCRIBDOWN_TOOLBAR_CURRENT_TEXT_CLASS_NAME;
    currentHeading.appendChild(currentHeadingText);

    /** 上一次写入的标题文本，相同则跳过 DOM 写入。 */
    let lastHeadingText = "";
    /** 当前命中的标题元素，供点击跳转使用。 */
    let activeHeadingElement: HTMLHeadingElement = headingElements[0];

    // ── 目录侧栏「当前章节」高亮（复用同一份 scrollspy 结果）──
    // 关键步骤：建立「正文标题元素 → 目录链接」映射，使 scrollspy 命中标题后可反查并高亮对应目录项。
    // 链接目标 id 解析与 hydrateToc 一致：优先原文匹配，失败再解码兜底（兼容被编码的中文 id）。
    /** 正文标题元素 → 目录侧栏对应跳转链接的映射。 */
    const tocLinkByHeading = new Map<HTMLHeadingElement, HTMLAnchorElement>();
    tocPanel
      .querySelectorAll<HTMLAnchorElement>(`a.${TOC_LINK_CLASS_NAME}`)
      .forEach((linkElement) => {
        /** 链接目标标题 id（去掉前导 #）。 */
        const rawTargetId = (linkElement.getAttribute("href") ?? "").slice(1);
        if (!rawTargetId) {
          return;
        }
        /** 链接指向的标题元素，按原文匹配失败时解码兜底。 */
        let targetHeading = ownerDocument.getElementById(rawTargetId);
        if (!targetHeading) {
          try {
            targetHeading = ownerDocument.getElementById(decodeURIComponent(rawTargetId));
          } catch {
            targetHeading = null;
          }
        }
        if (targetHeading instanceof HTMLHeadingElement) {
          tocLinkByHeading.set(targetHeading, linkElement);
        }
      });

    /** 当前高亮的目录链接；undefined 表示尚未高亮任何项。 */
    let activeTocLink: HTMLAnchorElement | undefined;

    /**
     * 把目录侧栏「当前章节」高亮切换到指定标题对应的链接上。
     * 按链接元素去重，未变化时直接返回，避免每帧重复读写 DOM。
     * @param headingElement 当前命中的正文标题元素。
     */
    const setActiveTocLink = (headingElement: HTMLHeadingElement): void => {
      /** 命中标题对应的目录链接，无对应项时为 undefined。 */
      const nextLink = tocLinkByHeading.get(headingElement);
      if (nextLink === activeTocLink) {
        return;
      }
      if (activeTocLink) {
        activeTocLink.classList.remove(TOC_LINK_ACTIVE_CLASS_NAME);
        activeTocLink.removeAttribute("aria-current");
      }
      if (nextLink) {
        nextLink.classList.add(TOC_LINK_ACTIVE_CLASS_NAME);
        // 关键步骤：aria-current 把「当前所在位置」语义同步给读屏，与高亮类保持一致。
        nextLink.setAttribute("aria-current", "location");
      }
      activeTocLink = nextLink;
    };

    /**
     * 计算当前可视区所属标题并刷新指示器文本 + tip。
     * 取文档顺序中最后一个 top ≤ 判定线的标题；都未越线时回退到首个标题。
     */
    const updateCurrentHeading = (): void => {
      /** 命中的当前标题元素，默认首个标题。 */
      let activeElement: HTMLHeadingElement = headingElements[0];
      for (const headingElement of headingElements) {
        if (headingElement.getBoundingClientRect().top <= ACTIVE_HEADING_OFFSET) {
          activeElement = headingElement;
        } else {
          break;
        }
      }
      // 关键步骤：始终同步当前标题引用（即便文本未变），保证点击跳转目标准确。
      activeHeadingElement = activeElement;
      // 关键步骤：同步目录侧栏高亮到当前章节；按元素去重，独立于下方的文本去重短路。
      setActiveTocLink(activeElement);
      /** 当前标题可见文本。 */
      const headingText = activeElement.textContent?.trim() ?? "";
      if (headingText === lastHeadingText) {
        return;
      }
      lastHeadingText = headingText;
      currentHeadingText.textContent = headingText;
      // 关键步骤：全文写入 aria-label，hover 时由 ::after 读取展示完整标题。
      currentHeading.setAttribute("aria-label", headingText);
    };

    /** 点击 / 回车：平滑滚动到当前章节标题，与「回到顶部」一致采用 smooth 行为。 */
    const jumpToActiveHeading = (): void => {
      activeHeadingElement.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    currentHeading.addEventListener("click", jumpToActiveHeading);
    currentHeading.addEventListener("keydown", (event) => {
      // 关键步骤：role=button 需自行处理 Enter / Space 触发。
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        jumpToActiveHeading();
      }
    });

    /** rAF 节流句柄，避免滚动时每个事件都同步读取 rect。 */
    let scrollRafId = 0;
    /** 滚动/缩放回调：在一帧内合并一次计算。 */
    const onScrollOrResize = (): void => {
      if (scrollRafId) {
        return;
      }
      scrollRafId =
        ownerWindow?.requestAnimationFrame(() => {
          scrollRafId = 0;
          updateCurrentHeading();
        }) ?? 0;
    };

    // 关键步骤：正文已改为在 .scribdown-content-area 内部滚动（整页 window 不再滚动），
    // scroll 事件不冒泡，故用「捕获阶段」在 window 上监听，可同时捕获到内部滚动容器派发的 scroll。
    ownerWindow?.addEventListener("scroll", onScrollOrResize, {
      passive: true,
      capture: true
    });
    ownerWindow?.addEventListener("resize", onScrollOrResize, { passive: true });
    // 首次同步一次当前章节。
    updateCurrentHeading();

    // 关键步骤：登记清理回调，下次重挂载工具栏前断开窗口监听（capture 标志需与注册时一致）。
    teardownCallbacks.push(() => {
      if (scrollRafId) {
        ownerWindow?.cancelAnimationFrame(scrollRafId);
      }
      ownerWindow?.removeEventListener("scroll", onScrollOrResize, { capture: true });
      ownerWindow?.removeEventListener("resize", onScrollOrResize);
    });

    // 指示器置于工具栏最左侧（目录按钮之前）。
    toolbar.appendChild(currentHeading);
  }

  toolbar.appendChild(tocBtn);
  toolbar.appendChild(moreBtn);
  // 关键步骤：菜单挂在工具栏内部，便于以工具栏为锚点做绝对定位。
  toolbar.appendChild(menu);

  // 关键步骤：toolbar 仍为 fixed 浮动元素，append 到 container 末尾；
  // tocPanel 是 flex item，必须插在 contentArea 之前才能视觉上位于正文左侧。
  container.appendChild(toolbar);
  container.insertBefore(tocPanel, contentArea);

  // 关键步骤：登记本轮实例的统一清理函数，供下次重挂载前断开全部全局监听。
  pageToolbarTeardowns.set(container, () => {
    teardownCallbacks.forEach((teardownCallback) => {
      teardownCallback();
    });
  });
}

export { mountPageToolbar, loadContentWidth, applyContentWidth };
