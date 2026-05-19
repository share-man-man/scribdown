// 扩展 service worker：仅承担一次性「跳过重定向」状态的协调。
// 实际拦截/重定向由 content script 在页面 document_start 时按 document.contentType 决策，
// 这样无需 webNavigation 权限，也避免 background 做 HEAD 预检带来的双请求开销。

/** 用户主动选择「查看原始链接」时跳过一次重定向的 URL 集合。 */
const bypassUrls = new Set<string>();

/**
 * 监听运行时消息，协调一次性 bypass：
 * - `scribdown:bypass-once`：viewer 错误页准备跳回原 URL 前注册一次性放行。
 * - `scribdown:consume-bypass`：content script 在跳 viewer 前查询并消费该标记。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  /** 消息类型字段，做类型收窄。 */
  const type = (message as { type?: unknown }).type;
  /** 消息携带的 URL 字段，做类型收窄。 */
  const url = (message as { url?: unknown }).url;

  if (type === "scribdown:bypass-once" && typeof url === "string") {
    bypassUrls.add(url);
    sendResponse({ ok: true });
    return false;
  }

  if (type === "scribdown:consume-bypass" && typeof url === "string") {
    /** 当前 URL 是否命中并已被消费。 */
    const bypassed = bypassUrls.delete(url);
    sendResponse({ bypassed });
    return false;
  }

  return false;
});
