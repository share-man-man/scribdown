import {
  LocalePreference,
  normalizeLocalePreference,
  setActiveLocaleFromPreference
} from "@scribdown/shared";
import type { LocaleType } from "@scribdown/shared";
import { EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY } from "./storage";

/** 当前浏览器扩展上下文已加载的全局语言偏好。 */
let activeExtensionLocalePreference: LocalePreference = LocalePreference.System;

/**
 * 读取浏览器扩展宿主语言。
 * @returns 宿主上报的原始语言标签。
 */
export function getExtensionHostLocale(): string | undefined {
  return (
    // 关键步骤：优先使用网页上下文的 navigator.language，使 file:// 内容页、扩展 viewer
    // 与本地 fixture 的自动语言解析一致；chrome.i18n 仅作非浏览器 DOM 上下文的兜底。
    (typeof navigator !== "undefined" ? navigator.language : undefined) ??
    (typeof chrome !== "undefined" ? chrome.i18n?.getUILanguage?.() : undefined)
  );
}

/**
 * 读取浏览器扩展的全局语言偏好并设为当前界面语言。
 * `chrome.storage.local` 由扩展 origin 统一管理，不受内容页、viewer 与 popup 的存储隔离影响。
 * @returns 实际生效的界面语言。
 */
export async function applyExtensionLocale(): Promise<LocaleType> {
  /** chrome.storage.local 中持久化的原始偏好值。 */
  const storageResult = await chrome.storage.local.get(EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY);
  /** 经过校验的全局语言偏好。 */
  const preference = normalizeLocalePreference(
    storageResult[EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY]
  );
  activeExtensionLocalePreference = preference;
  return setActiveLocaleFromPreference(preference, getExtensionHostLocale());
}

/**
 * 读取当前扩展上下文已经加载的全局语言偏好。
 * @returns 已校验的语言偏好。
 */
export function getExtensionLocalePreference(): LocalePreference {
  return activeExtensionLocalePreference;
}

/**
 * 保存用户通过工具栏选择的语言偏好，并立即同步当前运行时文案。
 * @param preference 用户在工具栏选中的语言偏好。
 * @returns 持久化完成后的 Promise。
 */
export async function saveExtensionLocalePreference(preference: LocalePreference): Promise<void> {
  activeExtensionLocalePreference = preference;
  setActiveLocaleFromPreference(preference, getExtensionHostLocale());
  await chrome.storage.local.set({ [EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY]: preference });
}
