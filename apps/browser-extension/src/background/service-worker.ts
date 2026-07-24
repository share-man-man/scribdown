// 扩展 service worker：协调一次性「跳过重定向」状态，并把启用开关同步到工具栏图标。
// 实际拦截/重定向由 content script 在页面 document_start 时按 document.contentType 决策，
// 这样无需 webNavigation 权限，也避免 background 做 HEAD 预检带来的双请求开销。

import { t } from "@scribdown/shared";
import { applyExtensionLocale } from "../config/locale";
import { EXTENSION_ENABLED_STORAGE_KEY } from "../config/storage";
import {
  BYPASS_ONCE_MESSAGE,
  CONSUME_BYPASS_MESSAGE,
  FETCH_FILE_MESSAGE,
  REFRESH_BADGE_MESSAGE,
  getRuntimeMessageType,
  getRuntimeMessageUrl
} from "../messages/runtime";

// 关键步骤：后台启动时按宿主语言确定工具栏图标标题等文案语言。
applyExtensionLocale();

/** 用户主动选择「查看原始链接」时跳过一次重定向的 URL 集合。 */
const bypassUrls = new Set<string>();

/** 关闭态下工具栏图标徽标文案，长度受 Chrome 限制，最多 4 个字符。 */
const DISABLED_BADGE_TEXT = "OFF";
/** 关闭态下徽标背景色，使用偏暖的红以区分启用态。 */
const DISABLED_BADGE_BACKGROUND = "#c0392b";
/** 启用态下工具栏标题，沿用扩展名。 */
const ENABLED_TITLE = "Scribdown";
/** 未开启「允许访问文件网址」时的全局徽标文案。 */
const FILE_ACCESS_BADGE_TEXT = "!";

/**
 * 综合扩展启用状态与「允许访问文件网址」状态刷新工具栏图标。
 * 三种状态（从高到低）：
 *  1. 扩展关闭 → `OFF` 徽标，淡化标题；
 *  2. 扩展开着但文件访问关 → `!` 徽标，hover 提示需要开启；
 *  3. 全部正常 → 清空徽标，标题恢复扩展名。
 *
 * 之所以不再用 per-tab 徽标：当「允许访问文件网址」关闭时，Chrome 直接
 * 把 file:// 标签页的 `tab.url` 对扩展隐藏，per-tab URL 匹配根本无从触发；
 * 改用全局徽标后，无论在哪个 tab、Chrome 是否暴露 URL，都能可靠提示。
 */
async function syncBadgeFromState(): Promise<void> {
  /** storage 中的原始启用状态值。 */
  const result = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  /** 是否启用，未显式置 false 视为启用。 */
  const extensionEnabled = result[EXTENSION_ENABLED_STORAGE_KEY] !== false;

  if (!extensionEnabled) {
    // 关键步骤：扩展关闭最高优先级，直接显示 OFF 兜底，跳过文件访问判定。
    void chrome.action.setBadgeText({ text: DISABLED_BADGE_TEXT });
    void chrome.action.setBadgeBackgroundColor({
      color: DISABLED_BADGE_BACKGROUND
    });
    void chrome.action.setTitle({ title: t("browser.disabledTitle") });
    return;
  }

  /** 用户是否已开启「允许访问文件网址」。 */
  const allowed = await chrome.extension.isAllowedFileSchemeAccess();
  if (!allowed) {
    void chrome.action.setBadgeText({ text: FILE_ACCESS_BADGE_TEXT });
    void chrome.action.setBadgeBackgroundColor({
      color: DISABLED_BADGE_BACKGROUND
    });
    void chrome.action.setTitle({ title: t("browser.fileAccessNeededTitle") });
    return;
  }

  // 关键步骤：徽标文案为空字符串即清除显示。
  void chrome.action.setBadgeText({ text: "" });
  void chrome.action.setTitle({ title: ENABLED_TITLE });
}

// 关键步骤：service worker 启动/安装时即同步一次，避免初次安装看到「无状态」图标。
chrome.runtime.onInstalled.addListener(() => {
  void syncBadgeFromState();
});
chrome.runtime.onStartup.addListener(() => {
  void syncBadgeFromState();
});
// service worker 冷启动时同样需要同步一次（onStartup 仅在浏览器启动触发）。
void syncBadgeFromState();

// 监听 storage 变化，popup 切换或其他窗口写入时即时更新图标。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!(EXTENSION_ENABLED_STORAGE_KEY in changes)) return;
  void syncBadgeFromState();
});

// 关键步骤：Chrome 没有提供「允许访问文件网址」状态变化事件；切换 tab 是用户操作里
// 最频繁的事件，借机重查一次文件访问状态以追平徽标。
chrome.tabs.onActivated.addListener(() => {
  void syncBadgeFromState();
});

/** 周期重查文件访问状态的 alarm 名；Chrome 没有现成事件，只能轮询。 */
const FILE_ACCESS_POLL_ALARM = "scribdown:file-access-poll";
/** 兜底轮询周期（分钟）。chrome.alarms 在 SW 休眠时也会唤醒，无须担心被回收。 */
const FILE_ACCESS_POLL_PERIOD_MINUTES = 0.5;

// 关键步骤：注册一次性周期 alarm；存在则替换，不会重复堆积。
void chrome.alarms.create(FILE_ACCESS_POLL_ALARM, {
  periodInMinutes: FILE_ACCESS_POLL_PERIOD_MINUTES
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== FILE_ACCESS_POLL_ALARM) return;
  void syncBadgeFromState();
});

// 关键步骤：从 popup 收到「刷新徽标」请求时立刻重查，缩短用户在扩展详情页改完开关后
// 切回 popup 那一刻徽标与 popup 状态不一致的窗口。
chrome.runtime.onMessage.addListener((message) => {
  if (
    message &&
    typeof message === "object" &&
    getRuntimeMessageType(message) === REFRESH_BADGE_MESSAGE
  ) {
    void syncBadgeFromState();
  }
  // 关键步骤：不阻止其他 onMessage 监听者处理同一条消息。
  return false;
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
  const type = getRuntimeMessageType(message);
  /** 消息携带的 URL 字段，做类型收窄。 */
  const url = getRuntimeMessageUrl(message);

  if (type === BYPASS_ONCE_MESSAGE && typeof url === "string") {
    bypassUrls.add(url);
    sendResponse({ ok: true });
    return false;
  }

  if (type === CONSUME_BYPASS_MESSAGE && typeof url === "string") {
    /** 当前 URL 是否命中并已被消费。 */
    const bypassed = bypassUrls.delete(url);
    sendResponse({ bypassed });
    return false;
  }

  if (type === FETCH_FILE_MESSAGE && typeof url === "string") {
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
