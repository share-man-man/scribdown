import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";
import { renderMarkdownToDocument } from "./render-markdown";

// 仅当当前文档 Content-Type 是这些纯文本/Markdown 变体时才介入。
// GitHub `…/blob/…/*.md` 这类返回 text/html 的页面会落到「不介入」分支，由源站自行展示。
const MARKDOWN_PLAINTEXT_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/x-markdown"
]);

/**
 * 等待 DOM 解析到 body 阶段，便于读取浏览器为纯文本 `.md` 自动包装的 `<pre>` 内容。
 * @returns DOMContentLoaded 触发后 resolve。
 */
function waitForDom(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

/**
 * file:// 场景就地渲染：扩展 viewer 不允许以 file: 作为 src，
 * 因此只能在原页面取 `<pre>` 文本后调用渲染核心。
 */
async function renderFileUrlInPlace(): Promise<void> {
  await waitForDom();

  /** Chrome 打开 file://*.md 时，body 内会有一个 <pre> 节点承载原始文本。 */
  const preElement = document.querySelector<HTMLPreElement>("pre");
  /** 提取出的 Markdown 原文。 */
  const rawMarkdown = preElement?.innerText ?? document.body.innerText;
  if (!rawMarkdown.trim()) return;

  /** 当前文件的展示名，用于页面标题。 */
  const filename = decodeURIComponent(
    window.location.pathname.split("/").pop() ?? "Markdown"
  );

  await renderMarkdownToDocument(rawMarkdown, filename, {
    // file:// origin 下分块加载语言包会触发 CORS 失败，禁用 Shiki 动态高亮。
    enableCodeHighlight: false
  });
}

/**
 * http(s):// 场景将当前页替换为扩展 viewer，由 viewer 在 chrome-extension:// origin 下
 * 重新发起带凭证的 fetch 并渲染，规避源站 CSP / sandbox 等约束。
 */
async function redirectToViewer(): Promise<void> {
  // 关键步骤：先消费一次性 bypass，避免「查看原始链接」回到原 URL 后又被拦回 viewer。
  /** background 维护的 bypass 标记消费结果。 */
  const bypassResult = (await chrome.runtime.sendMessage({
    type: "scribdown:consume-bypass",
    url: location.href
  })) as { bypassed?: boolean } | undefined;
  if (bypassResult?.bypassed) return;

  /** 扩展 viewer 页面的目标 URL，src 参数携带原始资源地址。 */
  const viewerUrl = chrome.runtime.getURL(
    `viewer.html?src=${encodeURIComponent(location.href)}`
  );
  window.location.replace(viewerUrl);
}

(async () => {
  // 关键步骤：尊重 popup 总开关，关闭时让浏览器原样展示，不做任何渲染或重定向。
  /** 从 chrome.storage.local 读到的当前启用状态（未设置视为启用）。 */
  const enabledResult = await chrome.storage.local.get(
    EXTENSION_ENABLED_STORAGE_KEY
  );
  if (enabledResult[EXTENSION_ENABLED_STORAGE_KEY] === false) return;

  // 关键步骤：以实际响应的 Content-Type 为准而非 URL 后缀。
  // 源站若返回 text/html（如 GitHub blob 自渲染页），直接放行，不介入。
  if (!MARKDOWN_PLAINTEXT_MIME_TYPES.has(document.contentType)) return;

  if (location.protocol === "file:") {
    await renderFileUrlInPlace();
    return;
  }

  await redirectToViewer();
})();
