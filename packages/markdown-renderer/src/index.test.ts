import { beforeAll, describe, expect, it } from "vitest";
import { LocaleType, setActiveLocale } from "@scribdown/shared";

import { renderMarkdown } from "./index";

// 固定为简体中文：本文件断言的 UI chrome 文案（目录 / 元数据等）与中文测试内容配套。
beforeAll(() => {
  setActiveLocale(LocaleType.SimplifiedChinese);
});

describe("renderMarkdown", () => {
  it("replaces standalone TOC marker with heading links", async () => {
    // 输入 Markdown 覆盖目录占位符和两级标题。
    const markdownText = ["# 文档标题", "", "[TOC]", "", "## 目录说明", "", "### 子章节"].join(
      "\n"
    );
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);
    // 分支条目的折叠按钮 HTML（叶子无按钮，分支才有；与标题链接分离）。
    const tocToggleHtml =
      '<button type="button" class="scribdown-toc-toggle" aria-expanded="true" aria-label="展开或折叠子目录"></button>';

    expect(renderedHtml).toContain(
      '<h1 id="文档标题" data-source-line="1"><span class="scribdown-heading-mark">文档标题</span></h1>'
    );
    expect(renderedHtml).toContain(
      '<details class="scribdown-toc scribdown-frame" data-source-line="3"><summary class="scribdown-toc-summary">目录</summary>'
    );
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    // 分支条目：li + 折叠按钮 + 与叶子完全相同的标题链接（节点间有换行，分别断言）。
    expect(renderedHtml).toContain(
      '<li data-toc-index="1" class="scribdown-toc-item scribdown-toc-item--depth-1 scribdown-toc-item--branch">'
    );
    expect(renderedHtml).toContain(tocToggleHtml);
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("文档标题")}" class="scribdown-toc-link">文档标题</a>`
    );
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list scribdown-toc-list--nested">');
    expect(renderedHtml).toContain('data-toc-index="1.1"');
    expect(renderedHtml).toContain('data-toc-index="1.1.1"');
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("目录说明")}" class="scribdown-toc-link">目录说明</a>`
    );
    // 叶子条目：仅标题链接，无折叠按钮。
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("子章节")}" class="scribdown-toc-link">子章节</a>`
    );
    // 不再渲染分支右侧的 # 跳转锚点。
    expect(renderedHtml).not.toContain("scribdown-toc-branch-link");
  });

  it("nests toc heading levels inside collapsible branches", async () => {
    // 输入 Markdown 覆盖多层标题和同级标题。
    const markdownText = [
      "[TOC]",
      "",
      "## 父级",
      "",
      "### 子级",
      "",
      "#### 孙级",
      "",
      "## 同级"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);
    // 可折叠分支数量（以分支条目 class 计数）。
    const tocBranchMatches = renderedHtml.match(/scribdown-toc-item--branch/gu) ?? [];
    // 分支条目的折叠按钮 HTML。
    const tocToggleHtml =
      '<button type="button" class="scribdown-toc-toggle" aria-expanded="true" aria-label="展开或折叠子目录"></button>';

    expect(tocBranchMatches).toHaveLength(2);
    expect(renderedHtml).toContain(tocToggleHtml);
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("父级")}" class="scribdown-toc-link">父级</a>`
    );
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("子级")}" class="scribdown-toc-link">子级</a>`
    );
    expect(renderedHtml).toContain(
      'data-toc-index="1.1.1" class="scribdown-toc-item scribdown-toc-item--depth-4"'
    );
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("同级")}" class="scribdown-toc-link">同级</a>`
    );
  });

  it("generates github-style heading slugs without collapsing hyphens", async () => {
    // 输入 Markdown 覆盖「文字 / 分隔符」类标题：GitHub 规则下 " / " 产生两个连续连字符。
    const markdownText = "## 聊天 / 新建对话首页";
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 关键断言：slug 与 GitHub / VS Code 内置预览一致（每个空格各替换为一个 "-"，不合并），
    // 保证外部按 GitHub 惯例书写的 "#聊天--新建对话首页" 锚点可命中。
    expect(renderedHtml).toContain('<h2 id="聊天--新建对话首页"');
  });

  it("deduplicates heading ids", async () => {
    // 输入 Markdown 覆盖重复标题。
    const markdownText = ["[TOC]", "", "## 重复标题", "", "## 重复标题"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain(
      '<h2 id="重复标题" data-source-line="3"><span class="scribdown-heading-mark">重复标题</span></h2>'
    );
    expect(renderedHtml).toContain(
      '<h2 id="重复标题-1" data-source-line="5"><span class="scribdown-heading-mark">重复标题</span></h2>'
    );
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("重复标题")}" class="scribdown-toc-link">重复标题</a>`
    );
    expect(renderedHtml).toContain(
      `<a href="#${encodeURIComponent("重复标题-1")}" class="scribdown-toc-link">重复标题</a>`
    );
  });

  it("renders term and colon lines as definition lists", async () => {
    // 输入 Markdown 覆盖定义列表扩展语法。
    const markdownText = [
      "Markdown",
      ": 一种轻量级标记语言。",
      "",
      "Scribdown",
      ": 统一 Markdown 渲染体验的项目。"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain(
      '<dl data-source-line="1"><dt>Markdown</dt><dd>一种轻量级标记语言。</dd></dl>'
    );
    expect(renderedHtml).toContain(
      '<dl data-source-line="4"><dt>Scribdown</dt><dd>统一 Markdown 渲染体验的项目。</dd></dl>'
    );
    expect(renderedHtml).not.toContain("Markdown\n: 一种轻量级标记语言。");
  });

  it("keeps toc markup when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖清洗模式下的目录和标题锚点。
    const markdownText = ["[TOC]", "", "## Safe Heading", "", "### Nested Heading"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);
    // 分支条目的折叠按钮 HTML（验证 button 及其属性通过白名单清洗）。
    const tocToggleHtml =
      '<button type="button" class="scribdown-toc-toggle" aria-expanded="true" aria-label="展开或折叠子目录"></button>';

    expect(renderedHtml).toContain(
      '<details class="scribdown-toc scribdown-frame" data-source-line="1"><summary class="scribdown-toc-summary">目录</summary>'
    );
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list">');
    // 分支条目：li + 折叠按钮（清洗后保留）+ 标题链接，无 details/summary、无 # 锚点。
    expect(renderedHtml).toContain(
      '<li data-toc-index="1" class="scribdown-toc-item scribdown-toc-item--depth-2 scribdown-toc-item--branch">'
    );
    expect(renderedHtml).toContain(tocToggleHtml);
    expect(renderedHtml).toContain(
      '<a href="#safe-heading" class="scribdown-toc-link">Safe Heading</a>'
    );
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list scribdown-toc-list--nested">');
    expect(renderedHtml).toContain(
      '<a href="#nested-heading" class="scribdown-toc-link">Nested Heading</a>'
    );
    expect(renderedHtml).toContain(
      '<h2 id="safe-heading" data-source-line="3"><span class="scribdown-heading-mark">Safe Heading</span></h2>'
    );
    expect(renderedHtml).toContain(
      '<h3 id="nested-heading" data-source-line="5"><span class="scribdown-heading-mark">Nested Heading</span></h3>'
    );
    // 旧的分支 details/summary/# 锚点结构不再出现。
    expect(renderedHtml).not.toContain("scribdown-toc-branch");
  });

  it("tags user-authored <details> with frame classes and keeps them through sanitize", async () => {
    // 用户在 Markdown 中手写的原生折叠块（区别于目录用 <details>）。
    const markdownText = [
      "<details>",
      "<summary>更多</summary>",
      "",
      "正文内容",
      "",
      "</details>"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 关键断言：内容折叠块被打上 .scribdown-details + .scribdown-frame，且通过白名单清洗。
    expect(renderedHtml).toContain('<details class="scribdown-details scribdown-frame">');
    // 反向断言：目录专用 class 不会落到内容折叠块上。
    expect(renderedHtml).not.toContain("scribdown-toc");
  });

  it("keeps definition list markup when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖清洗模式下的定义列表扩展语法。
    const markdownText = ["Markdown", ": 一种轻量级标记语言。"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain(
      '<dl data-source-line="1"><dt>Markdown</dt><dd>一种轻量级标记语言。</dd></dl>'
    );
  });

  it("keeps code block source line while applying syntax highlighting", async () => {
    // 输入 Markdown 覆盖顶层围栏代码块。
    const markdownText = ["```ts", "const value = 1;", "```"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 代码块保留 remarkSourceLine 注入的源码行锚点。
    expect(renderedHtml).toContain('data-source-line="1"');
    // data-source-line 不破坏 Shiki 匹配，代码块仍被按行高亮。
    expect(renderedHtml).toContain('<span class="line"');
  });

  it("annotates list items with their source line including nested lists", async () => {
    // 输入 Markdown 覆盖含嵌套子列表的无序列表。
    const markdownText = ["- 第一项", "- 第二项", "  - 嵌套项"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 顶层列表项各自保留源码行锚点。
    expect(renderedHtml).toContain('<li data-source-line="1">');
    expect(renderedHtml).toContain('<li data-source-line="2">');
    // 嵌套子列表项同样保留源码行锚点。
    expect(renderedHtml).toContain('<li data-source-line="3">');
  });

  it("annotates nested blocks inside list items and blockquotes", async () => {
    // 输入 Markdown 覆盖列表内代码块与嵌套引用两类嵌套块级结构。
    const markdownText = [
      "- 列表项",
      "  ```ts",
      "  const value = 1;",
      "  ```",
      "",
      "> 外层引用",
      ">",
      "> > 内层引用"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 列表项内的代码块保留源码行锚点。
    expect(renderedHtml).toContain('data-source-line="2"');
    // 内层嵌套引用保留独立源码行锚点。
    expect(renderedHtml).toContain('<blockquote data-source-line="8">');
  });

  it("annotates table rows with their source line", async () => {
    // 输入 Markdown 覆盖表头行、分隔行与两行表体的 GFM 表格。
    const markdownText = [
      "| 名称 | 说明 |",
      "| --- | --- |",
      "| 第一行 | 内容一 |",
      "| 第二行 | 内容二 |"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 表格整体保留源码行锚点。
    expect(renderedHtml).toContain('<table data-source-line="1">');
    // 表头行保留行级源码行锚点。
    expect(renderedHtml).toContain('<tr data-source-line="1">');
    // 表体各行保留各自的行级源码行锚点，支撑光标同步高亮到行。
    expect(renderedHtml).toContain('<tr data-source-line="3">');
    expect(renderedHtml).toContain('<tr data-source-line="4">');
  });

  it("wraps standalone images in a styled figure when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖独占图片段落、title caption 与失败态占位内容。
    const markdownText = '![湖边雪山](/mountain.jpg "图片标题")';
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<figure class="scribdown-image-figure" data-source-line="1">');
    expect(renderedHtml).toContain(
      '<span class="scribdown-image-frame"><img src="/mountain.jpg" alt="湖边雪山"'
    );
    expect(renderedHtml).toContain('title="图片标题" class="scribdown-image">');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback">');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback-text">湖边雪山</span>');
    expect(renderedHtml).toContain(
      '<span class="scribdown-image-fallback-source">/mountain.jpg</span>'
    );
    expect(renderedHtml).toContain(
      '<figcaption class="scribdown-image-caption">图片标题</figcaption>'
    );
  });

  it("renders yaml frontmatter as a metadata card", async () => {
    // 输入 Markdown 覆盖文档头部 frontmatter（含嵌套对象）与正文标题。
    const markdownText = [
      "---",
      "name: weekly-learning-doc",
      "description: 产出每周的 AI 学习成果包文档。",
      "metadata:",
      "  type: user | feedback | project | reference",
      "---",
      "",
      "# 正文标题"
    ].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 卡片容器复用 .scribdown-frame 手绘边框，并保留源码行锚点。
    expect(renderedHtml).toContain(
      '<div class="scribdown-frontmatter scribdown-frame" data-source-line="1">'
    );
    expect(renderedHtml).toContain(
      '<div class="scribdown-frontmatter__chrome"><span class="scribdown-frontmatter__label">元数据</span></div>'
    );
    // 顶层键值对渲染为 dl 列表。
    expect(renderedHtml).toContain('<dl class="scribdown-frontmatter__list">');
    expect(renderedHtml).toContain("<dt>name</dt><dd>weekly-learning-doc</dd>");
    expect(renderedHtml).toContain("<dt>description</dt><dd>产出每周的 AI 学习成果包文档。</dd>");
    // 嵌套对象展开为带修饰类的嵌套 dl。
    expect(renderedHtml).toContain(
      '<dl class="scribdown-frontmatter__list scribdown-frontmatter__list--nested"><dt>type</dt><dd>user | feedback | project | reference</dd></dl>'
    );
    // frontmatter 原文不再以正文形式出现（--- 不产生 hr / 标题误判）。
    expect(renderedHtml).not.toContain("name: weekly-learning-doc</p>");
  });

  it("falls back to a yaml code block when frontmatter fails to parse", async () => {
    // 输入 Markdown 覆盖非法 yaml frontmatter（缩进错误导致解析失败）。
    const markdownText = ["---", "name: [unclosed", "---", "", "正文段落"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    // 解析失败时回退为 yaml 代码块展示原文。
    expect(renderedHtml).toContain('<code class="language-yaml"');
    expect(renderedHtml).not.toContain("scribdown-frontmatter");
  });

  it("does not treat mid-document thematic breaks as frontmatter", async () => {
    // 输入 Markdown 覆盖正文中的分隔线（--- 不在文档起始处）。
    const markdownText = ["正文段落", "", "---", "", "后续段落"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain("<hr");
    expect(renderedHtml).not.toContain("scribdown-frontmatter");
  });

  it("wraps reference images in the same figure structure", async () => {
    // 输入 Markdown 覆盖引用式图片定义。
    const markdownText = ["![手绘风格预览][preview]", "", "[preview]: /preview.jpg"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<figure class="scribdown-image-figure" data-source-line="1">');
    expect(renderedHtml).toContain(
      '<span class="scribdown-image-frame"><img src="/preview.jpg" alt="手绘风格预览"'
    );
    expect(renderedHtml).toContain('class="scribdown-image"');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback-source">preview</span>');
  });
});
