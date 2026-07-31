// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getActiveLocale, LocalePreference, LocaleType, setActiveLocale } from "@scribdown/shared";

import { hydrateMarkdown, mountMarkdownToolbar, renderMarkdown } from "./index";
import { serializeMarkdownTableAsTsv } from "./syntax/tables";

// 固定为简体中文：本文件断言的复制按钮 / 图片查看器等 UI 文案与中文测试内容配套。
beforeAll(() => {
  setActiveLocale(LocaleType.SimplifiedChinese);
});

// 统一清理挂到 body 的容器：断言失败时也不残留 DOM，避免污染后续用例。
afterEach(() => {
  document.body.innerHTML = "";
  setActiveLocale(LocaleType.SimplifiedChinese);
});

/**
 * 渲染 Markdown 并在 detached 容器上执行交互 hydration。
 * @param markdownText 输入的 Markdown 文本。
 * @param scrollToHeading 可选的目录跳转滚动实现（缺省注入 no-op，避免 jsdom 缺失平滑滚动实现）。
 * @returns 已完成 hydration 的容器元素。
 */
async function renderAndHydrate(
  markdownText: string,
  scrollToHeading: (targetElement: HTMLElement) => void = () => {}
): Promise<HTMLDivElement> {
  // 承载渲染结果的容器（保持 detached，mermaid 等依赖 live DOM 的渲染不会真正启动）。
  const container = document.createElement("div");
  container.innerHTML = await renderMarkdown(markdownText);
  hydrateMarkdown(container, { scrollToHeading });
  return container;
}

describe("hydrateMarkdown", () => {
  it("wraps code blocks with chrome, gutter and copy button", async () => {
    // 输入 Markdown 覆盖带语言标识的三行代码块。
    const container = await renderAndHydrate(
      ["```ts", "const a = 1;", "", "const b = 2;", "```"].join("\n")
    );

    // 代码块被包进 figure chrome，语言标签展示映射后的可读名。
    const figureElement = container.querySelector("figure.scribdown-code-block");
    expect(figureElement).not.toBeNull();
    expect(figureElement?.querySelector(".scribdown-code-block__lang")?.textContent).toBe(
      "TypeScript"
    );

    // 行号列与 Shiki 行 span 数一致：3 行源码 + Shiki 输出的尾部空行（现状如此，纯文本
    // 降级路径会去掉尾部空行，两条路径的表现差异见 rewriteCodeBlockLines）。
    const gutterLines = figureElement?.querySelectorAll(".scribdown-code-block__gutter-line");
    expect(gutterLines).toHaveLength(4);

    // 复制按钮携带原始代码文本与可访问名称。
    const copyButton = figureElement?.querySelector<HTMLButtonElement>(
      "button.scribdown-code-block__copy"
    );
    expect(copyButton?.getAttribute("aria-label")).toBe("复制代码");
    expect(copyButton?.dataset.scribdownCodeSource).toContain("const a = 1;");
  });

  it("is idempotent when called twice on the same root", async () => {
    // 输入 Markdown 覆盖代码块与图片两类会被包装的结构。
    const container = await renderAndHydrate(
      ["```ts", "const a = 1;", "```", "", "![图](/a.png)"].join("\n")
    );

    hydrateMarkdown(container, { scrollToHeading: () => {} });

    // 重复 hydrate 不产生嵌套/重复的 chrome 结构。
    expect(container.querySelectorAll("figure.scribdown-code-block")).toHaveLength(1);
    expect(container.querySelectorAll(".scribdown-code-block__chrome")).toHaveLength(1);
  });

  it("replaces mermaid code blocks with a loading figure carrying the source", async () => {
    // 输入 Markdown 覆盖 mermaid 代码块。
    const mermaidSource = "graph TD\n  A-->B";
    const container = await renderAndHydrate(["```mermaid", mermaidSource, "```"].join("\n"));

    // pre>code 被替换为 mermaid figure，源码寄存在 dataset 供 live DOM 阶段渲染。
    const figureElement = container.querySelector<HTMLElement>("figure.scribdown-mermaid");
    expect(figureElement).not.toBeNull();
    expect(figureElement?.classList.contains("scribdown-mermaid--loading")).toBe(true);
    expect(figureElement?.dataset.scribdownMermaidSourceText).toBe(mermaidSource);
    // detached 容器上不启动真实渲染（等待进入 live DOM 后再触发）。
    expect(figureElement?.dataset.scribdownMermaidRenderStarted).toBeUndefined();
    expect(container.querySelector("pre > code.language-mermaid")).toBeNull();

    // 非全屏工具组包含模式、缩放、复制与全屏入口；加载阶段仅源码复制可用。
    const controlsElement = figureElement?.querySelector(".scribdown-mermaid__controls");
    expect(controlsElement).not.toBeNull();
    expect(
      controlsElement
        ?.querySelector("button[aria-label='切换为拖拽模式']")
        ?.hasAttribute("disabled")
    ).toBe(true);
    // 缩小、比例和放大应组成一个具备语义的连体按钮组。
    const zoomGroupElement = controlsElement?.querySelector(
      "[role='group'].scribdown-mermaid__zoom-group"
    );
    expect(zoomGroupElement).not.toBeNull();
    expect(controlsElement?.querySelector("button[aria-label='缩小图表']")).not.toBeNull();
    expect(zoomGroupElement?.querySelector(".scribdown-mermaid__zoom-value")?.textContent).toBe(
      "100%"
    );
    expect(zoomGroupElement?.querySelector("button[aria-label='放大图表']")).not.toBeNull();
    expect(controlsElement?.querySelector("button[aria-label='重置缩放'] svg")).not.toBeNull();
    expect(controlsElement?.querySelector("button[aria-label='复制内容']")).not.toBeNull();
    expect(controlsElement?.querySelector("button[aria-label='全屏查看图表']")).not.toBeNull();
  });

  it("wraps tables with a copy button and serializes cell text as TSV", async () => {
    // 输入 Markdown 覆盖表头与两行数据。
    const container = await renderAndHydrate(
      ["| 名称 | 状态 |", "| --- | --- |", "| Mermaid | ready |", "| Table | stable |"].join("\n")
    );

    // 表格被包进交互壳层，并提供本地化复制入口。
    const wrapperElement = container.querySelector(".scribdown-table");
    const tableElement = wrapperElement?.querySelector<HTMLTableElement>(":scope > table");
    const copyButtonElement = wrapperElement?.querySelector<HTMLButtonElement>(
      "button.scribdown-table__copy"
    );
    expect(wrapperElement).not.toBeNull();
    expect(copyButtonElement?.getAttribute("aria-label")).toBe("复制表格");
    expect(tableElement ? serializeMarkdownTableAsTsv(tableElement) : "").toBe(
      ["名称\t状态", "Mermaid\tready", "Table\tstable"].join("\n")
    );

    // 重复 hydrate 不产生嵌套壳层或重复按钮。
    hydrateMarkdown(container, { scrollToHeading: () => {} });
    expect(container.querySelectorAll(".scribdown-table")).toHaveLength(1);
    expect(container.querySelectorAll("button.scribdown-table__copy")).toHaveLength(1);
  });

  it("binds toc toggle collapse and injected heading scroll", async () => {
    // 注入的目录跳转滚动实现（记录目标标题）。
    const scrollToHeading = vi.fn();
    // 输入 Markdown 覆盖 [TOC] 与两级标题（产生分支 + 叶子条目）。
    const container = await renderAndHydrate(
      ["[TOC]", "", "## 父级", "", "### 子级"].join("\n"),
      scrollToHeading
    );

    // 分支折叠按钮：点击后条目进入折叠态且 aria-expanded 同步。
    const toggleElement = container.querySelector<HTMLButtonElement>("button.scribdown-toc-toggle");
    expect(toggleElement).not.toBeNull();
    toggleElement?.click();
    const branchItem = toggleElement?.closest("li");
    expect(branchItem?.classList.contains("scribdown-toc-item--collapsed")).toBe(true);
    expect(toggleElement?.getAttribute("aria-expanded")).toBe("false");

    // 标题链接：点击被拦截并调用注入的滚动实现，目标为对应标题元素。
    const linkElement = container.querySelector<HTMLAnchorElement>("a.scribdown-toc-link");
    expect(linkElement).not.toBeNull();
    // jsdom 下 detached 容器无 document 关联查询，先挂到 body 让 getElementById 命中。
    document.body.append(container);
    linkElement?.click();
    expect(scrollToHeading).toHaveBeenCalledTimes(1);
    expect((scrollToHeading.mock.calls[0][0] as HTMLElement).tagName).toBe("H2");
  });

  it("exposes images as keyboard-accessible viewer triggers", async () => {
    // 输入 Markdown 覆盖独占段落图片。
    const container = await renderAndHydrate('![湖边雪山](/mountain.jpg "标题")');

    // 图片被标记为可聚焦按钮并带可访问名称（真实打开行为依赖图片加载完成，jsdom 不加载资源）。
    const imageElement = container.querySelector<HTMLImageElement>("img.scribdown-image");
    expect(imageElement?.getAttribute("role")).toBe("button");
    expect(imageElement?.getAttribute("tabindex")).toBe("0");
    expect(imageElement?.getAttribute("aria-label")).toBe("查看全图：湖边雪山");
  });
});

describe("mountMarkdownToolbar", () => {
  it("mounts toolbar with toc panel and wraps content into scroll layers", async () => {
    // 输入 Markdown 覆盖两级标题，供目录侧栏采集。
    const container = document.createElement("div");
    container.className = "scribdown-markdown";
    container.innerHTML = await renderMarkdown(["## 章节一", "", "## 章节二"].join("\n"));
    document.body.append(container);
    hydrateMarkdown(container, { scrollToHeading: () => {} });

    mountMarkdownToolbar(container, { scrollToHeading: () => {} });

    // 工具栏与目录侧栏挂载到 container 内，正文被收进 content-area > content-scroll。
    expect(container.querySelector(":scope > .scribdown-toolbar")).not.toBeNull();
    const tocPanel = container.querySelector(":scope > .scribdown-toolbar-toc-panel");
    expect(tocPanel?.querySelectorAll("a.scribdown-toc-link")).toHaveLength(2);
    const contentScroll = container.querySelector(
      ".scribdown-content-area > .scribdown-content-scroll"
    );
    expect(contentScroll?.querySelector("h2")).not.toBeNull();

    // 重复挂载不产生第二个工具栏实例，且旧实例的 document 级监听被清理
    //（点外部收起监听随 teardown 移除，不随重挂载次数累积）。
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    mountMarkdownToolbar(container, { scrollToHeading: () => {} });
    expect(container.querySelectorAll(":scope > .scribdown-toolbar")).toHaveLength(1);
    expect(
      removeListenerSpy.mock.calls.filter(([eventName]) => eventName === "click")
    ).toHaveLength(1);
    removeListenerSpy.mockRestore();
  });

  it("switches the toolbar language from the menu item above About", async () => {
    // 输入一个标题以完整挂载包含更多菜单的工具栏。
    const container = document.createElement("div");
    container.className = "scribdown-markdown";
    container.innerHTML = await renderMarkdown("## 章节一");
    document.body.append(container);

    /** 语言切换通知回调，用于验证渲染器把持久化职责交给宿主。 */
    const onLocaleChange = vi.fn();
    mountMarkdownToolbar(container, { scrollToHeading: () => {}, onLocaleChange });

    /** 「更多」按钮，展开后才能操作语言切换器。 */
    const moreButton = container.querySelector<HTMLButtonElement>(".scribdown-toolbar-btn--more");
    moreButton?.click();

    /** 语言下拉触发行，在两个 select 类型菜单项中按可见文案定位。 */
    const languageTrigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".scribdown-toolbar-menu-item--select")
    ).find((element) => element.textContent?.includes("语言"));
    languageTrigger?.click();

    /** 语言下拉自身包含的选项，排除同一菜单内页面宽度的四个选项。 */
    const languageOptions = languageTrigger?.parentElement?.querySelectorAll<HTMLButtonElement>(
      ".scribdown-toolbar-menu-sub-item[role=option]"
    );
    expect(
      languageTrigger?.parentElement?.classList.contains("scribdown-toolbar-menu-group--language")
    ).toBe(true);
    expect(languageOptions).toHaveLength(10);
    expect(Array.from(languageOptions ?? []).map((option) => option.textContent?.trim())).toEqual([
      "English",
      "简体中文",
      "繁體中文",
      "日本語",
      "한국어",
      "Español",
      "Français",
      "Deutsch",
      "Português (Brasil)",
      "Русский"
    ]);

    /** 英文语言选项。 */
    const englishOption = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".scribdown-toolbar-menu-sub-item[role=option]")
    ).find((element) => element.textContent?.includes("English"));
    englishOption?.click();

    expect(getActiveLocale()).toBe(LocaleType.English);
    expect(onLocaleChange).toHaveBeenCalledWith(LocalePreference.English);
    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(".scribdown-toolbar-menu-item--select")
      ).some((element) => element.textContent?.includes("Language"))
    ).toBe(true);
    expect(container.querySelector("a[role=menuitem]")?.textContent).toContain("About");
  });
});
