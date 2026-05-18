import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";
import { renderMarkdownToDocument } from "./render-markdown";

// 仅当源响应是这些纯文本/Markdown 变体时才进行渲染，避免把任意 HTML 当 Markdown 处理。
const MARKDOWN_PLAINTEXT_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/x-markdown"
]);

// 只允许这些 scheme 作为 src，挡住 `javascript:` / `data:` 等可执行 URL，
// 否则后续设置到 <a href="..."> 上会生成可点击的恶意链接。
const ALLOWED_SRC_SCHEMES = new Set<string>(["http:", "https:"]);

/**
 * 在当前文档中渲染一个简洁的错误页。
 * @param message 错误说明文本。
 * @param sourceUrl 可选的原始资源 URL，提供后会附带「查看原始链接」按钮。
 */
function renderError(message: string, sourceUrl: string | null): void {
  document.head.innerHTML = "";
  /** 字符集元标签。 */
  const charsetMeta = document.createElement("meta");
  charsetMeta.setAttribute("charset", "UTF-8");
  document.head.appendChild(charsetMeta);
  document.title = "Scribdown";

  document.body.innerHTML = "";
  /** 错误页根容器。 */
  const wrap = document.createElement("main");
  wrap.style.cssText =
    "max-width: 640px; margin: 80px auto; padding: 0 24px; font-family: system-ui, -apple-system, sans-serif; color: #2d241f;";

  /** 错误页主标题。 */
  const heading = document.createElement("h1");
  heading.textContent = "Scribdown 无法渲染该文件";
  heading.style.cssText = "font-size: 20px; margin-bottom: 12px;";
  wrap.appendChild(heading);

  /** 错误说明段落。 */
  const detail = document.createElement("p");
  detail.textContent = message;
  detail.style.cssText = "color: #6a5b53; line-height: 1.6;";
  wrap.appendChild(detail);

  if (sourceUrl) {
    /** 跳回原始链接按钮。 */
    const link = document.createElement("a");
    link.href = sourceUrl;
    link.textContent = "查看原始链接";
    link.rel = "noopener noreferrer";
    link.style.cssText =
      "display: inline-block; margin-top: 16px; color: #2b63c6; text-decoration: underline;";
    // 关键步骤：先通知 background 对该 URL 跳过一次重定向，再放行导航，
    // 否则点击后会被 webNavigation 监听器再次拦截回 viewer。
    link.addEventListener("click", (event) => {
      event.preventDefault();
      chrome.runtime
        .sendMessage({ type: "scribdown:bypass-once", url: sourceUrl })
        .finally(() => {
          window.location.href = sourceUrl;
        });
    });
    wrap.appendChild(link);
  }

  document.body.appendChild(wrap);
}

/**
 * 从 URL 路径中提取文件名，失败时回退到固定字面量。
 * @param sourceUrl 完整的源 URL。
 * @returns 解码后的文件名。
 */
function extractFilename(sourceUrl: string): string {
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

(async () => {
  // 关键步骤：拒绝在第三方页面 iframe 中渲染。即使别的网站用
  // `<iframe src="chrome-extension://<id>/viewer.html?src=...">` 嵌入我们，
  // 也不让 fetch 真正发起，避免成为「带凭证内网探测」跳板。
  if (window.top !== window.self) {
    renderError("Scribdown viewer 不允许在 iframe 中加载。", null);
    return;
  }

  /** 从查询串中读取的原始资源 URL。 */
  const sourceUrl = new URLSearchParams(window.location.search).get("src");
  if (!sourceUrl) {
    renderError("缺少 src 参数。", null);
    return;
  }

  // 关键步骤：校验 src 的 scheme，仅放行 http/https。
  // 拦下 `javascript:` / `data:` / `file:` 等，避免在错误页 <a href> 上挂可执行链接。
  try {
    /** 解析 src 得到的 URL 对象。 */
    const parsedSrc = new URL(sourceUrl);
    if (!ALLOWED_SRC_SCHEMES.has(parsedSrc.protocol)) {
      renderError(
        `不支持的协议（${parsedSrc.protocol}），仅允许 http / https。`,
        null
      );
      return;
    }
  } catch {
    renderError("src 参数不是合法的 URL。", null);
    return;
  }

  // 关键步骤：尊重 popup 总开关。用户在 viewer 已加载后关闭开关并刷新（或直接打开
  // viewer URL 时扩展处于关闭态），不再渲染而是把页面替换为原始 URL。
  // background 的 webNavigation 监听器同样会读 storage 决定是否拦截，
  // 因此这里只需 location.replace，无需额外 bypass 协调。
  /** storage 中的当前启用状态（未设置视为启用）。 */
  const enabledResult = await chrome.storage.local.get(
    EXTENSION_ENABLED_STORAGE_KEY
  );
  if (enabledResult[EXTENSION_ENABLED_STORAGE_KEY] === false) {
    window.location.replace(sourceUrl);
    return;
  }

  // 关键步骤：在扩展 origin 下发起 fetch，宿主 CSP 与我们无关；
  // host_permissions 已授予对 .md URL 的跨域访问权限；
  // credentials:"include" 允许携带目标站点的 cookie，支持登录态 markdown 服务。
  let response: Response;
  try {
    response = await fetch(sourceUrl, { credentials: "include" });
  } catch (err) {
    renderError(
      `请求失败：${err instanceof Error ? err.message : String(err)}`,
      sourceUrl
    );
    return;
  }

  if (!response.ok) {
    renderError(`HTTP ${response.status} ${response.statusText}`, sourceUrl);
    return;
  }

  // 关键步骤：仅对纯文本/Markdown 类型响应进行渲染，避免把已渲染 HTML 再做一次 Markdown。
  /** 响应的 MIME 类型主体部分，已去掉 charset 等参数。 */
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!MARKDOWN_PLAINTEXT_MIME_TYPES.has(contentType)) {
    renderError(
      `响应不是 Markdown 类型（Content-Type: ${contentType || "未声明"}）。`,
      sourceUrl
    );
    return;
  }

  /** 拉取到的原始 Markdown 文本。 */
  const rawMarkdown = await response.text();
  if (!rawMarkdown.trim()) {
    renderError("文件内容为空。", sourceUrl);
    return;
  }

  await renderMarkdownToDocument(rawMarkdown, extractFilename(sourceUrl));

  // 关键步骤：恢复原 URL 上的 hash 锚点，让 `…/foo.md#section` 链接落到对应章节。
  // 渲染完成后再设置 location.hash，触发浏览器自带的锚点滚动。
  try {
    /** 原始 URL 中的 fragment 部分，含前导 #。 */
    const fragment = new URL(sourceUrl).hash;
    if (fragment && fragment.length > 1) {
      window.location.hash = fragment;
    }
  } catch {
    // sourceUrl 不合法不会到这里（前面已校验），保守处理。
  }
})();
