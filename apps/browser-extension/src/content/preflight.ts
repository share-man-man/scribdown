import { applyExtensionLocale } from "../config/locale";
import { MARKDOWN_PLAINTEXT_MIME_TYPES } from "../config/markdown-mime-types";
import { EXTENSION_ENABLED_STORAGE_KEY } from "../config/storage";

/**
 * content script 接管页面前的共享前置检查。
 * file:// 与 http(s):// 两个入口共用，保证判定口径一致。
 *
 * 这里只依赖 storage / i18n 等轻量模块，不引入渲染核心，
 * 使 http(s) 入口能保持为薄壳（MV3 声明式 content script 只能是单文件，
 * 引入渲染核心会让每个 .md 页面都下载并解析整份 bundle）。
 *
 * @returns 是否应当由扩展接管当前页面。
 */
export async function shouldTakeOverPage(): Promise<boolean> {
  // 关键步骤：接管渲染前按宿主语言确定界面文案语言。
  await applyExtensionLocale();

  // 关键步骤：尊重 popup 总开关，关闭时让浏览器原样展示，不做任何渲染或重定向。
  /** 从 chrome.storage.local 读到的当前启用状态（未设置视为启用）。 */
  const enabledResult = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  if (enabledResult[EXTENSION_ENABLED_STORAGE_KEY] === false) return false;

  // 关键步骤：以实际响应的 Content-Type 为准而非 URL 后缀。
  // 源站若返回 text/html（如 GitHub blob 自渲染页），直接放行，不介入。
  return MARKDOWN_PLAINTEXT_MIME_TYPES.has(document.contentType);
}
