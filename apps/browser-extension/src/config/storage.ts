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

/**
 * 将任意输入值 clamp 到允许的刷新间隔范围内。
 * 非法值（NaN / 非数字）回落到默认值。
 * @param value 原始输入值。
 * @returns 合法范围内的整数秒数。
 */
export function clampRefreshIntervalSec(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REFRESH_INTERVAL_SEC;
  /** 向下取整后的秒数，避免小数引入显示歧义。 */
  const integer = Math.floor(value);
  return Math.min(
    MAX_REFRESH_INTERVAL_SEC,
    Math.max(MIN_REFRESH_INTERVAL_SEC, integer)
  );
}

/**
 * 解析 chrome.storage 中的刷新间隔值。
 * @param rawInterval chrome.storage.local 中读到的原始值。
 * @returns 合法范围内的刷新间隔秒数。
 */
export function parseRefreshIntervalSec(rawInterval: unknown): number {
  return typeof rawInterval === "number"
    ? clampRefreshIntervalSec(rawInterval)
    : DEFAULT_REFRESH_INTERVAL_SEC;
}
