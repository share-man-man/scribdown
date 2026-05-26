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
/** file:// .md 但未开启「允许访问文件网址」时的 per-tab 徽标文案。 */
const FILE_ACCESS_BADGE_TEXT = "!";
/** file:// .md 但未授权时 hover 标题，引导用户去 popup 开启。 */
const FILE_ACCESS_NEEDED_TITLE = "Scribdown · 需开启「允许访问文件网址」";
/** 匹配本地 markdown 文件 URL 的正则；扩展名后允许查询串或锚点。 */
const LOCAL_MARKDOWN_URL_PATTERN = /^file:\/\/.+\.(?:md|markdown|mdx)(?:$|[?#])/i;

/** 当前已打上 `!` 徽标的 tab id 集合，扩展开关切换时用于批量清理。 */
const fileAccessFlaggedTabIds = new Set<number>();

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

/**
 * 读取 storage 中扩展是否启用。
 * @returns 是否启用，未显式置 false 视为启用。
 */
async function readExtensionEnabled(): Promise<boolean> {
  /** storage 读取结果。 */
  const result = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  return result[EXTENSION_ENABLED_STORAGE_KEY] !== false;
}

/**
 * 清掉某个 tab 上的「需开启文件访问」per-tab 徽标。
 * @param tabId 目标 tab id。
 */
async function clearFileAccessBadgeForTab(tabId: number): Promise<void> {
  if (!fileAccessFlaggedTabIds.has(tabId)) return;
  fileAccessFlaggedTabIds.delete(tabId);
  // 关键步骤：把 text/title 重置为 null（继承全局值），而不是空字符串，
  // 否则就把 OFF 全局徽标在该 tab 上挡掉了。
  try {
    await chrome.action.setBadgeText({ tabId, text: null as unknown as string });
    await chrome.action.setTitle({ tabId, title: null as unknown as string });
  } catch {
    // tab 已关闭等情况忽略。
  }
}

/**
 * 评估某个 tab 是否需要打「需开启文件访问」徽标，并按需更新。
 * @param tab 目标 tab。
 */
async function evaluateTabForFileAccess(
  tab: chrome.tabs.Tab | undefined
): Promise<void> {
  if (!tab || typeof tab.id !== "number") return;
  /** 扩展整体是否启用；关闭时让全局 OFF 兜底，不打 per-tab 徽标。 */
  const extensionEnabled = await readExtensionEnabled();
  if (!extensionEnabled) {
    await clearFileAccessBadgeForTab(tab.id);
    return;
  }
  /** 当前 tab 的 URL，未授权时可能为空字符串。 */
  const url = tab.url ?? "";
  if (!LOCAL_MARKDOWN_URL_PATTERN.test(url)) {
    await clearFileAccessBadgeForTab(tab.id);
    return;
  }
  /** 用户是否已开启「允许访问文件网址」。 */
  const allowed = await chrome.extension.isAllowedFileSchemeAccess();
  if (allowed) {
    await clearFileAccessBadgeForTab(tab.id);
    return;
  }
  // 关键步骤：file:// .md 且未授权 → 打 `!` 徽标 + hover 提示。
  fileAccessFlaggedTabIds.add(tab.id);
  try {
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: FILE_ACCESS_BADGE_TEXT
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: DISABLED_BADGE_BACKGROUND
    });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: FILE_ACCESS_NEEDED_TITLE
    });
  } catch {
    // tab 已关闭等情况忽略。
  }
}

/**
 * 清空所有已被打 per-tab 徽标的 tab。
 * 扩展整体关闭时调用，避免 OFF 全局徽标被 per-tab `!` 挡住。
 */
async function clearAllFileAccessBadges(): Promise<void> {
  /** 拷贝一份以便迭代时安全 delete。 */
  const ids = Array.from(fileAccessFlaggedTabIds);
  await Promise.all(ids.map((id) => clearFileAccessBadgeForTab(id)));
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
  // 关键步骤：扩展关闭时清空所有 per-tab 徽标，让全局 OFF 显示；
  //         开启时重新评估当前活动 tab 是否需要 `!` 徽标。
  if (!enabled) {
    void clearAllFileAccessBadges();
  } else {
    void chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => evaluateTabForFileAccess(tab));
  }
});

// 关键步骤：tab 内 URL 变化或加载完成时，重新评估是否需要 `!` 徽标。
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  void evaluateTabForFileAccess(tab);
});

// 关键步骤：切换到某个 tab 时，重新评估它的徽标状态（chrome.action 标题是 per-tab 的）。
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then(
    (tab) => evaluateTabForFileAccess(tab),
    () => {
      // tab 已不存在等情况忽略。
    }
  );
});

// 关键步骤：tab 关闭时从已标记集合中移除，防止内存泄漏。
chrome.tabs.onRemoved.addListener((tabId) => {
  fileAccessFlaggedTabIds.delete(tabId);
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
