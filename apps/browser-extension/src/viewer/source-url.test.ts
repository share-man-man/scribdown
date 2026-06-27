import { describe, expect, it } from "vitest";

import { extractFilename, validateViewerSourceUrl } from "./source-url";

describe("source-url", () => {
  it("accepts only http and https source URLs", () => {
    /** 合法的 HTTPS 校验结果。 */
    const httpsResult = validateViewerSourceUrl("https://example.com/readme.md");
    /** 合法的 HTTP 校验结果。 */
    const httpResult = validateViewerSourceUrl("http://example.com/readme.md");
    /** 本地文件协议校验结果。 */
    const fileResult = validateViewerSourceUrl("file:///tmp/readme.md");
    /** 可执行协议校验结果。 */
    const javascriptResult = validateViewerSourceUrl("javascript:alert(1)");
    /** 非 URL 字符串校验结果。 */
    const invalidResult = validateViewerSourceUrl("not a url");

    expect(httpsResult.ok).toBe(true);
    expect(httpResult.ok).toBe(true);
    expect(fileResult).toEqual({
      ok: false,
      message: "不支持的协议（file:），仅允许 http / https。"
    });
    expect(javascriptResult).toEqual({
      ok: false,
      message: "不支持的协议（javascript:），仅允许 http / https。"
    });
    expect(invalidResult).toEqual({
      ok: false,
      message: "src 参数不是合法的 URL。"
    });
  });

  it("extracts decoded filenames from source URLs", () => {
    /** 普通路径文件名。 */
    const plainFilename = extractFilename("https://example.com/docs/readme.md");
    /** URL 编码后的中文文件名。 */
    const decodedFilename = extractFilename("https://example.com/docs/%E8%AF%B4%E6%98%8E.md");
    /** 目录 URL 的兜底文件名。 */
    const directoryFallback = extractFilename("https://example.com/docs/");
    /** 非法 URL 的兜底文件名。 */
    const invalidFallback = extractFilename("not a url");

    expect(plainFilename).toBe("readme.md");
    expect(decodedFilename).toBe("说明.md");
    expect(directoryFallback).toBe("docs");
    expect(invalidFallback).toBe("Markdown");
  });
});
