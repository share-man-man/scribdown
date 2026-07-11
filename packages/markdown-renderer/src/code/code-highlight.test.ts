import { describe, expect, it, vi } from "vitest";

import { highlightMarkdownCodeBlocks } from "./code-highlight";

/**
 * 受控的懒加载 grammar loader：首次调用拒绝（模拟网络抖动），之后返回真实 lua grammar。
 * 用 vi.hoisted 保证在 vi.mock 工厂内可引用。
 */
const { luaLoader } = vi.hoisted(() => ({
  luaLoader: vi
    .fn<() => Promise<unknown>>()
    .mockRejectedValueOnce(new Error("simulated network failure"))
    .mockImplementation(() => import("@shikijs/langs/lua"))
}));

vi.mock("./code-highlighter-langs", () => ({
  CODE_HIGHLIGHTER_EAGER_LOADERS: [],
  CODE_HIGHLIGHTER_LAZY_LANGS: { lua: luaLoader }
}));

describe("highlightMarkdownCodeBlocks lazy language retry", () => {
  it("retries a failed grammar load on the next render instead of caching the failure", async () => {
    // 待高亮的渲染产物片段（lua 命中懒加载注册表）。
    const html = '<pre><code class="language-lua">print(1)</code></pre>';

    // 第一次：loader 拒绝，退回纯文本渲染但不抛错，结构保留。
    const firstPass = await highlightMarkdownCodeBlocks(html);
    expect(luaLoader).toHaveBeenCalledTimes(1);
    expect(firstPass).toContain('class="language-lua"');

    // 第二次：失败不驻留缓存，loader 被重新调用并成功注册 grammar。
    const secondPass = await highlightMarkdownCodeBlocks(html);
    expect(luaLoader).toHaveBeenCalledTimes(2);
    expect(secondPass).toContain('class="language-lua"');
    expect(secondPass).toContain('<span class="line"');
  });
});
