// 只允许这些 scheme 作为 src，挡住 `javascript:` / `data:` 等可执行 URL，
// 否则后续设置到 <a href="..."> 上会生成可点击的恶意链接。
const ALLOWED_SRC_SCHEMES = new Set<string>(["http:", "https:"]);

/**
 * 校验 viewer 的 src 参数是否可被扩展主动拉取。
 * @param sourceUrl 完整的源 URL 字符串。
 * @returns 校验结果；ok=false 时附带可展示给用户的错误文案。
 */
export function validateViewerSourceUrl(
  sourceUrl: string
): { ok: true } | { ok: false; message: string } {
  try {
    /** 解析 src 得到的 URL 对象。 */
    const parsedSrc = new URL(sourceUrl);
    if (!ALLOWED_SRC_SCHEMES.has(parsedSrc.protocol)) {
      return {
        ok: false,
        message: `不支持的协议（${parsedSrc.protocol}），仅允许 http / https。`
      };
    }
  } catch {
    return { ok: false, message: "src 参数不是合法的 URL。" };
  }

  return { ok: true };
}

/**
 * 从 URL 路径中提取文件名，失败时回退到固定字面量。
 * @param sourceUrl 完整的源 URL。
 * @returns 解码后的文件名。
 */
export function extractFilename(sourceUrl: string): string {
  try {
    /** 解析得到的 URL 对象。 */
    const url = new URL(sourceUrl);
    /** 路径末段，可能为空（以 `/` 结尾）。 */
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(lastSegment ?? "Markdown");
  } catch {
    return "Markdown";
  }
}
