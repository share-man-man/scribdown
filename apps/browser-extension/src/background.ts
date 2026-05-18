// 扩展 service worker：监听对 http(s) `.md` 文件的导航，
// 将其转发到扩展自身的 viewer 页面，让渲染在 chrome-extension:// origin 下完成，
// 从而完全规避宿主页面 CSP / sandbox / cookie 等安全约束。

import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";

/** 用户主动选择「查看原始链接」时跳过一次重定向的 URL 集合。 */
const bypassUrls = new Set<string>();

/**
 * 监听运行时消息，处理 viewer 页面发起的「跳过一次重定向」请求。
 * 该机制让 viewer 在响应不是 Markdown 时可以引导用户回到原始 URL。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === "scribdown:bypass-once" &&
    typeof (message as { url?: unknown }).url === "string"
  ) {
    bypassUrls.add((message as { url: string }).url);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    // 仅处理主框架导航，子 iframe 不接管。
    if (details.frameId !== 0) return;

    // 命中一次性 bypass：消费后放行。
    if (bypassUrls.has(details.url)) {
      bypassUrls.delete(details.url);
      return;
    }

    // 关键步骤：尊重 popup 的总开关。每次回调都从 storage 现取最新值，
    // 避免 SW 冷启动时内存缓存还未被 storage.onChanged 同步导致误拦截
    // （表现为「关掉开关后第一次刷新还会被弹回 viewer，第二次才放行」）。
    /** 启用状态读取结果。未设置视为启用。 */
    const enabledResult = await chrome.storage.local.get(
      EXTENSION_ENABLED_STORAGE_KEY
    );
    if (enabledResult[EXTENSION_ENABLED_STORAGE_KEY] === false) return;

    /** 重定向到扩展 viewer 页面的目标 URL，src 参数携带原始资源地址。 */
    const viewerUrl = chrome.runtime.getURL(
      `viewer.html?src=${encodeURIComponent(details.url)}`
    );
    chrome.tabs.update(details.tabId, { url: viewerUrl });
  },
  {
    url: [
      { schemes: ["http", "https"], pathSuffix: ".md" }
    ]
  }
);
