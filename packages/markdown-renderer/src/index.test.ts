import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./index";

describe("renderMarkdown", () => {
  it("replaces standalone TOC marker with heading links", async () => {
    // 输入 Markdown 覆盖目录占位符和两级标题。
    const markdownText = ["# 文档标题", "", "[TOC]", "", "## 目录说明", "", "### 子章节"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<h1 id="文档标题">文档标题</h1>');
    expect(renderedHtml).toContain('<details class="scribdown-toc"><summary class="scribdown-toc-summary">目录</summary>');
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    expect(renderedHtml).toContain('data-toc-index="1.1"');
    expect(renderedHtml).toContain('data-toc-index="1.1.1"');
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("目录说明")}">目录说明</a>`);
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("子章节")}">子章节</a>`);
  });

  it("deduplicates heading ids", async () => {
    // 输入 Markdown 覆盖重复标题。
    const markdownText = ["[TOC]", "", "## 重复标题", "", "## 重复标题"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText);

    expect(renderedHtml).toContain('<h2 id="重复标题">重复标题</h2>');
    expect(renderedHtml).toContain('<h2 id="重复标题-1">重复标题</h2>');
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("重复标题")}">重复标题</a>`);
    expect(renderedHtml).toContain(`<a href="#${encodeURIComponent("重复标题-1")}">重复标题</a>`);
  });

  it("keeps toc markup when sanitizeHtml is enabled", async () => {
    // 输入 Markdown 覆盖清洗模式下的目录和标题锚点。
    const markdownText = ["[TOC]", "", "## Safe Heading"].join("\n");
    // 渲染结果。
    const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

    expect(renderedHtml).toContain('<details class="scribdown-toc"><summary class="scribdown-toc-summary">目录</summary>');
    expect(renderedHtml).toContain('<nav aria-label="目录" class="scribdown-toc-nav">');
    expect(renderedHtml).toContain('<ol class="scribdown-toc-list">');
    expect(renderedHtml).toContain('<li data-toc-index="1" class="scribdown-toc-item scribdown-toc-item--depth-2">');
    expect(renderedHtml).toContain('<h2 id="safe-heading">Safe Heading</h2>');
  });
});
