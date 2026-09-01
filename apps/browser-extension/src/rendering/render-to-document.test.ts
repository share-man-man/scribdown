// @vitest-environment jsdom
import {
  SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME
} from "@scribdown/shared";
import { describe, expect, it } from "vitest";

import { renderMarkdownToDocument } from "./render-markdown";

/** 测试用的源文件 URL，用于相对链接解析。 */
const SOURCE_URL = "file:///tmp/doc.md";

describe("renderMarkdownToDocument 增量更新", () => {
  it("内容更新时原地合并正文，不销毁滚动容器与 body 上的既有节点", async () => {
    await renderMarkdownToDocument("# 标题\n\n第一段。\n", "doc.md", SOURCE_URL);

    /** 首次渲染建立的正文滚动容器，用于验证重渲染后仍是同一个节点实例。 */
    const scrollerBefore = document.querySelector(`.${SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME}`);
    /** 首次渲染产出的标题节点，内容未变时应被 morphdom 原地保留。 */
    const headingBefore = document.querySelector("h1");
    // 模拟 mermaid / 图片全屏查看器：它们由渲染器按 document 缓存单例并挂在 body 上，
    // 一旦重渲染把 body 抹掉，缓存就会命中已 detached 的 dialog，导致全屏失效。
    /** 挂在 body 上的伪查看器节点。 */
    const viewerDialog = document.createElement("dialog");
    document.body.appendChild(viewerDialog);

    await renderMarkdownToDocument("# 标题\n\n第一段。\n\n第二段。\n", "doc.md", SOURCE_URL);

    /** 重渲染后的正文滚动容器。 */
    const scrollerAfter = document.querySelector(`.${SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME}`);
    /** 重渲染后的标题节点。 */
    const headingAfter = document.querySelector("h1");

    // 滚动容器是同一个节点实例：scrollTop 不会被重置，阅读位置自然保留。
    expect(scrollerAfter).toBe(scrollerBefore);
    // 未变化的标题节点原地保留，未被销毁重建。
    expect(headingAfter).toBe(headingBefore);
    // body 上的查看器 dialog 仍在文档中，showModal 不会因 detached 而抛错。
    expect(viewerDialog.isConnected).toBe(true);
    // 新增内容已合并进正文。
    expect(document.querySelector(`.${SCRIBDOWN_MARKDOWN_CLASS_NAME}`)?.textContent).toContain(
      "第二段。"
    );
  });

  it("重渲染不重建 <head>，样式表 link 保持同一实例", async () => {
    await renderMarkdownToDocument("# A\n", "a.md", SOURCE_URL);
    /** 首次渲染注入的样式 link。 */
    const stylesheetBefore = document.querySelector("link[rel='stylesheet']");

    await renderMarkdownToDocument("# B\n", "b.md", SOURCE_URL);
    /** 重渲染后的样式 link。 */
    const stylesheetAfter = document.querySelector("link[rel='stylesheet']");

    expect(stylesheetAfter).toBe(stylesheetBefore);
    expect(document.title).toBe("b.md");
  });
});
