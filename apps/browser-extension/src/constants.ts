/**
 * 浏览器插件「是否启用」状态在 chrome.storage.local 中的键名。
 * 关闭时：file:// content script 跳过渲染，background 不再拦截 http(s) `.md` 导航。
 * 未设置视为启用（默认开）。
 */
export const EXTENSION_ENABLED_STORAGE_KEY = "scribdown:enabled";
