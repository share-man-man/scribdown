import { setActiveLocaleFromHost, type LocaleType } from "@scribdown/shared";

/**
 * 读取浏览器扩展宿主语言并设为全局界面语言。
 * 优先用 `chrome.i18n.getUILanguage()`（跟随用户在 Chrome 中设置的界面语言），
 * 不可用时回落到 `navigator.language`；均不可用时由内核回落到默认语言。
 * 在各入口（popup / viewer / content / background）渲染或读取文案前调用一次即可。
 * @returns 实际生效的界面语言。
 */
export function applyExtensionLocale(): LocaleType {
  /** 宿主上报的原始语言标签。 */
  const rawLocale =
    (typeof chrome !== "undefined" ? chrome.i18n?.getUILanguage?.() : undefined) ??
    (typeof navigator !== "undefined" ? navigator.language : undefined);

  return setActiveLocaleFromHost(rawLocale);
}
