import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";
import { renderMarkdownToDocument } from "./render-markdown";

// 仅处理 file:// 场景，http(s) 走 background → viewer 重定向路径。
// 守卫 contentType，避免少数情况下浏览器把 .md 当作 HTML 解析后再被错误重渲。
const MARKDOWN_PLAINTEXT_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/x-markdown"
]);

(async () => {
  // 关键步骤：尊重 popup 的总开关，关闭时跳过自动渲染，让用户看到原始文本。
  /** 从 chrome.storage.local 读到的当前启用状态（未设置视为启用）。 */
  const enabledResult = await chrome.storage.local.get(
    EXTENSION_ENABLED_STORAGE_KEY
  );
  if (enabledResult[EXTENSION_ENABLED_STORAGE_KEY] === false) return;

  if (!MARKDOWN_PLAINTEXT_MIME_TYPES.has(document.contentType)) return;

  // Chrome 打开 file://*.md 时，页面体是一个 <pre> 标签包含原始文本。
  /** 原始 <pre> 节点，承载浏览器自动包装的纯文本内容。 */
  const preElement = document.querySelector<HTMLPreElement>("pre");
  /** 提取出的 Markdown 原文。 */
  const rawMarkdown = preElement?.innerText ?? document.body.innerText;

  if (!rawMarkdown.trim()) return;

  // 从 URL 中提取文件名用于页面标题。
  /** 当前文件的展示名。 */
  const filename = decodeURIComponent(
    window.location.pathname.split("/").pop() ?? "Markdown"
  );

  await renderMarkdownToDocument(rawMarkdown, filename);
})();
