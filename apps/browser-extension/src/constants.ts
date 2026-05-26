/**
 * 浏览器插件「是否启用」状态在 chrome.storage.local 中的键名。
 * 关闭时：file:// content script 跳过渲染，background 不再拦截 http(s) `.md` 导航。
 * 未设置视为启用（默认开）。
 */
export const EXTENSION_ENABLED_STORAGE_KEY = "scribdown:enabled";

/**
 * 「自动刷新开关」状态在 chrome.storage.local 中的键名。
 * 仅作用于 file:// 场景，控制是否周期性回拉本地文件并静默重渲染。
 * 未设置视为启用（默认开）。
 */
export const REFRESH_ENABLED_STORAGE_KEY = "scribdown:refreshEnabled";

/**
 * 「源文件内容刷新间隔（秒）」配置在 chrome.storage.local 中的键名。
 * 仅在 REFRESH_ENABLED_STORAGE_KEY 为开时生效。
 */
export const REFRESH_INTERVAL_STORAGE_KEY = "scribdown:refreshIntervalSec";

/**
 * 默认刷新间隔（秒）。未配置时回退到该值。
 */
export const DEFAULT_REFRESH_INTERVAL_SEC = 2;

/**
 * 刷新间隔下限（秒）。开关已独立承担「关闭」语义，间隔本身不允许 0。
 */
export const MIN_REFRESH_INTERVAL_SEC = 1;

/**
 * 刷新间隔上限（秒）。防止误输入超大值导致体验异常。
 */
export const MAX_REFRESH_INTERVAL_SEC = 60;
