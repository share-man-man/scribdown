// 扩展 service worker：协调一次性「跳过重定向」状态，并把启用开关同步到工具栏图标。
// 实际拦截/重定向由 content script 在页面 document_start 时按 document.contentType 决策，
// 这样无需 webNavigation 权限，也避免 background 做 HEAD 预检带来的双请求开销。

import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";

/** 用户主动选择「查看原始链接」时跳过一次重定向的 URL 集合。 */
const bypassUrls = new Set<string>();

/** 关闭态下工具栏图标徽标文案，长度受 Chrome 限制，最多 4 个字符。 */
const DISABLED_BADGE_TEXT = "OFF";
/** 关闭态下徽标背景色，使用偏暖的红以区分启用态。 */
const DISABLED_BADGE_BACKGROUND = "#c0392b";
/** 启用态下工具栏标题，沿用扩展名。 */
const ENABLED_TITLE = "Scribdown";
/** 关闭态下工具栏标题，明确告知用户当前不接管 .md。 */
const DISABLED_TITLE = "Scribdown（已关闭）";

/**
 * 根据启用状态刷新工具栏图标的徽标与标题。
 * 关闭时显示 `OFF` 徽标 + 灰化标题；启用时清空徽标。
 * @param enabled 当前是否启用扩展。
 */
function applyActionState(enabled: boolean): void {
  // 关键步骤：徽标文案为空字符串即清除显示。
  void chrome.action.setBadgeText({ text: enabled ? "" : DISABLED_BADGE_TEXT });
  void chrome.action.setBadgeBackgroundColor({ color: DISABLED_BADGE_BACKGROUND });
  void chrome.action.setTitle({ title: enabled ? ENABLED_TITLE : DISABLED_TITLE });
}

/**
 * 从 chrome.storage.local 读取启用状态并同步到工具栏图标。
 * 未设置时默认启用，与 popup 行为保持一致。
 */
async function syncActionFromStorage(): Promise<void> {
  /** storage 中的原始启用状态值。 */
  const result = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  /** 是否启用，未显式置 false 视为启用。 */
  const enabled = result[EXTENSION_ENABLED_STORAGE_KEY] !== false;
  applyActionState(enabled);
}

// 关键步骤：service worker 启动/安装时即同步一次，避免初次安装看到「无状态」图标。
chrome.runtime.onInstalled.addListener(() => {
  void syncActionFromStorage();
});
chrome.runtime.onStartup.addListener(() => {
  void syncActionFromStorage();
});
// service worker 冷启动时同样需要同步一次（onStartup 仅在浏览器启动触发）。
void syncActionFromStorage();

// 监听 storage 变化，popup 切换或其他窗口写入时即时更新图标。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!(EXTENSION_ENABLED_STORAGE_KEY in changes)) return;
  /** 切换后的启用状态。 */
  const enabled = changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false;
  applyActionState(enabled);
});

/**
 * 监听运行时消息，协调一次性 bypass 与 file:// 代理拉取：
 * - `scribdown:bypass-once`：viewer 错误页准备跳回原 URL 前注册一次性放行。
 * - `scribdown:consume-bypass`：content script 在跳 viewer 前查询并消费该标记。
 * - `scribdown:fetch-file`：file:// 页面 content script 的 origin 为 null，无法直接
 *   fetch 本地文件；改由 service worker 在 `chrome-extension://` origin 下代办，
 *   依赖 manifest 中的 `file:///*` host permission 与用户在扩展详情页打开的
 *   「允许访问文件网址」开关。
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

  if (type === "scribdown:fetch-file" && typeof url === "string") {
    // 关键步骤：仅允许代理 file:// 协议，避免被滥用为任意来源的 fetch 跳板。
    if (!url.startsWith("file://")) {
      sendResponse({ ok: false, error: "unsupported scheme" });
      return false;
    }
    void (async () => {
      try {
        /** service worker 在扩展 origin 下发起的文件回拉请求。 */
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          sendResponse({ ok: false, error: `HTTP ${response.status}` });
          return;
        }
        /** 拉取到的文件文本内容。 */
        const text = await response.text();
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    })();
    // 关键步骤：返回 true 表示稍后异步调用 sendResponse，保持消息通道打开。
    return true;
  }

  return false;
});
