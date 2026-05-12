import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./index";

describe("renderMarkdown", () => {
  it("replaces standalone TOC marker with heading links", async () => {
    // 输入 Markdown 覆盖目录占位符和两级标题。
    const markdownText = ["# 文档标题", "", "[TOC]", "", "## 目录说明", "", "### 子章节"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<h1 id="文档标题"><span class="scribdown-heading-mark">文档标题</span></h1>');
    expect(renderedHtml).toContain('<details class="scribdown-toc"><summary class="scribdown-toc-summary">目录</summary>');
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    expect(renderedHtml).toContain(
      `<details open class="scribdown-toc-branch"><summary class="scribdown-toc-branch-summary">文档标题<a href="#${encodeURIComponent("文档标题")}" aria-label="跳转到文档标题" class="scribdown-toc-branch-link">#</a></summary>`
    );
    expect(renderedHtml).toContain('class="scribdown-toc-item scribdown-toc-item--depth-1 scribdown-toc-item--branch"');
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list scribdown-toc-list--nested">');
    expect(renderedHtml).toContain('data-toc-index="1.1"');
    expect(renderedHtml).toContain('data-toc-index="1.1.1"');
    expect(renderedHtml).toContain(
      `<summary class="scribdown-toc-branch-summary">目录说明<a href="#${encodeURIComponent("目录说明")}" aria-label="跳转到目录说明" class="scribdown-toc-branch-link">#</a></summary>`
    );
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("子章节")}">子章节</a>`);
  });

  it("nests toc heading levels inside collapsible branches", async () => {
    // 输入 Markdown 覆盖多层标题和同级标题。
    const markdownText = ["[TOC]", "", "## 父级", "", "### 子级", "", "#### 孙级", "", "## 同级"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);
    // 可折叠分支数量。
    const tocBranchMatches = renderedHtml.match(/class="scribdown-toc-branch"/gu) ?? [];

    expect(tocBranchMatches).toHaveLength(2);
    expect(renderedHtml).toContain(
      `<details open class="scribdown-toc-branch"><summary class="scribdown-toc-branch-summary">父级<a href="#${encodeURIComponent("父级")}" aria-label="跳转到父级" class="scribdown-toc-branch-link">#</a></summary>`
    );
    expect(renderedHtml).toContain(
      `<details open class="scribdown-toc-branch"><summary class="scribdown-toc-branch-summary">子级<a href="#${encodeURIComponent("子级")}" aria-label="跳转到子级" class="scribdown-toc-branch-link">#</a></summary>`
    );
    expect(renderedHtml).toContain('data-toc-index="1.1.1" class="scribdown-toc-item scribdown-toc-item--depth-4"');
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("同级")}">同级</a>`);
  });

  it("deduplicates heading ids", async () => {
    // 输入 Markdown 覆盖重复标题。
    const markdownText = ["[TOC]", "", "## 重复标题", "", "## 重复标题"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<h2 id="重复标题"><span class="scribdown-heading-mark">重复标题</span></h2>');
    expect(renderedHtml).toContain('<h2 id="重复标题-1"><span class="scribdown-heading-mark">重复标题</span></h2>');
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("重复标题")}">重复标题</a>`);
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("重复标题-1")}">重复标题</a>`);
  });

  it("renders term and colon lines as definition lists", async () => {
    // 输入 Markdown 覆盖定义列表扩展语法。
    const markdownText = ["Markdown", ": 一种轻量级标记语言。", "", "Scribdown", ": 统一 Markdown 渲染体验的项目。"].join(
      "\n"
    );
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain("<dl><dt>Markdown</dt><dd>一种轻量级标记语言。</dd></dl>");
    expect(renderedHtml).toContain("<dl><dt>Scribdown</dt><dd>统一 Markdown 渲染体验的项目。</dd></dl>");
    expect(renderedHtml).not.toContain("Markdown\n: 一种轻量级标记语言。");
  });

  it("keeps toc markup when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖清洗模式下的目录和标题锚点。
    const markdownText = ["[TOC]", "", "## Safe Heading", "", "### Nested Heading"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

    expect(renderedHtml).toContain('<details class="scribdown-toc"><summary class="scribdown-toc-summary">目录</summary>');
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list">');
    expect(renderedHtml).toContain('<details open class="scribdown-toc-branch">');
    expect(renderedHtml).toContain('<summary class="scribdown-toc-branch-summary">');
    expect(renderedHtml).toContain('aria-label="跳转到Safe Heading" class="scribdown-toc-branch-link">#</a>');
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list scribdown-toc-list--nested">');
    expect(renderedHtml).toContain(
      '<li data-toc-index="1" class="scribdown-toc-item scribdown-toc-item--depth-2 scribdown-toc-item--branch">'
    );
    expect(renderedHtml).toContain('<h2 id="safe-heading"><span class="scribdown-heading-mark">Safe Heading</span></h2>');
    expect(renderedHtml).toContain('<h3 id="nested-heading"><span class="scribdown-heading-mark">Nested Heading</span></h3>');
  });

  it("keeps definition list markup when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖清洗模式下的定义列表扩展语法。
    const markdownText = ["Markdown", ": 一种轻量级标记语言。"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

    expect(renderedHtml).toContain("<dl><dt>Markdown</dt><dd>一种轻量级标记语言。</dd></dl>");
  });

  it("wraps standalone images in a styled figure when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖独占图片段落、title caption 与失败态占位内容。
    const markdownText = '![湖边雪山](/mountain.jpg "图片标题")';
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

    expect(renderedHtml).toContain('<figure class="scribdown-image-figure">');
    expect(renderedHtml).toContain('<span class="scribdown-image-frame"><img src="/mountain.jpg" alt="湖边雪山"');
    expect(renderedHtml).toContain('title="图片标题" class="scribdown-image">');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback">');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback-text">湖边雪山</span>');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback-source">/mountain.jpg</span>');
    expect(renderedHtml).toContain('<figcaption class="scribdown-image-caption">图片标题</figcaption>');
  });

  it("wraps reference images in the same figure structure", async () => {
    // 输入 Markdown 覆盖引用式图片定义。
    const markdownText = ["![手绘风格预览][preview]", "", "[preview]: /preview.jpg"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

    expect(renderedHtml).toContain('<figure class="scribdown-image-figure">');
    expect(renderedHtml).toContain('<span class="scribdown-image-frame"><img src="/preview.jpg" alt="手绘风格预览"');
    expect(renderedHtml).toContain('class="scribdown-image"');
    expect(renderedHtml).toContain('<span class="scribdown-image-fallback-source">preview</span>');
  });
});
