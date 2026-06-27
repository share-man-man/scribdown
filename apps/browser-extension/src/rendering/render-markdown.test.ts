import { describe, expect, it } from "vitest";

import { shouldRewriteRelativeUrl } from "./render-markdown";

describe("shouldRewriteRelativeUrl", () => {
  it("rewrites only document-relative URLs", () => {
    /** 普通相对路径是否需要重写。 */
    const relativePath = shouldRewriteRelativeUrl("./image.png");
    /** 根相对路径是否需要重写。 */
    const rootRelativePath = shouldRewriteRelativeUrl("/assets/image.png");
    /** 带冒号的相对文件名是否需要重写。 */
    const relativePathWithColon = shouldRewriteRelativeUrl("./note:2026.md");
    /** 页面内锚点是否需要重写。 */
    const hashLink = shouldRewriteRelativeUrl("#section");
    /** 协议相对 URL 是否需要重写。 */
    const protocolRelativeUrl = shouldRewriteRelativeUrl("//cdn.example.com/image.png");
    /** HTTPS 绝对 URL 是否需要重写。 */
    const absoluteHttpsUrl = shouldRewriteRelativeUrl("https://example.com/image.png");
    /** 可执行协议 URL 是否需要重写。 */
    const javascriptUrl = shouldRewriteRelativeUrl("javascript:alert(1)");

    expect(relativePath).toBe(true);
    expect(rootRelativePath).toBe(true);
    expect(relativePathWithColon).toBe(true);
    expect(hashLink).toBe(false);
    expect(protocolRelativeUrl).toBe(false);
    expect(absoluteHttpsUrl).toBe(false);
    expect(javascriptUrl).toBe(false);
  });
});
