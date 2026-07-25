/**
 * Scribdown 无框架文案取值内核。
 * 纯 TS、零第三方依赖，可在浏览器 popup（React）、纯 DOM 工具栏、VS Code webview 与
 * Node 宿主中一致运行。宿主启动时按语言调一次 {@link setActiveLocale}，其余代码用 {@link t}
 * 取文案；需要多语言并存时用 {@link createTranslator} 取独立实例。
 */

import {
  DEFAULT_LOCALE,
  LOCALE_FALLBACKS,
  LocalePreference,
  LocaleType,
  SUPPORTED_LOCALES,
  normalizeLocale
} from "./locales";
import { MESSAGES } from "./messages";
import type { MessageKey } from "./messages.types";

/**
 * 插值变量映射：把文案中的 `{name}` 占位替换为对应值。
 */
export type MessageVars = Record<string, string | number>;

/**
 * 当前全局生效的界面语言。默认取兜底语言，宿主启动时通过 {@link setActiveLocale} 覆盖。
 */
let activeLocale: LocaleType = DEFAULT_LOCALE;

/**
 * 设置全局生效语言。非受支持语言会被静默回落到 {@link DEFAULT_LOCALE}，避免脏输入。
 * @param locale 目标语言（应为受支持的 {@link LocaleType}）。
 */
export function setActiveLocale(locale: LocaleType): void {
  activeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * 读取当前全局生效语言。
 * @returns 当前语言。
 */
export function getActiveLocale(): LocaleType {
  return activeLocale;
}

/**
 * 按「显式语言偏好优先，系统语言其次」解析当前应使用的语言。
 * @param preference 宿主持久化的语言偏好；省略时视为跟随系统。
 * @param rawHostLocale 宿主原始语言标签（如 `navigator.language`、`vscode.env.language`）。
 * @returns 实际应生效的受支持语言。
 */
export function resolveLocalePreference(
  preference: LocalePreference | undefined,
  rawHostLocale: string | null | undefined
): LocaleType {
  switch (preference) {
    case LocalePreference.English:
      return LocaleType.English;
    case LocalePreference.SimplifiedChinese:
      return LocaleType.SimplifiedChinese;
    case LocalePreference.System:
    default:
      return normalizeLocale(rawHostLocale);
  }
}

/**
 * 根据宿主保存的偏好和系统语言更新全局界面语言。
 * @param preference 宿主持久化的语言偏好；省略时跟随系统。
 * @param rawHostLocale 宿主原始语言标签。
 * @returns 实际生效的语言。
 */
export function setActiveLocaleFromPreference(
  preference: LocalePreference | undefined,
  rawHostLocale: string | null | undefined
): LocaleType {
  /** 以统一优先级规则解析得到的语言。 */
  const resolvedLocale = resolveLocalePreference(preference, rawHostLocale);
  setActiveLocale(resolvedLocale);
  return resolvedLocale;
}

/**
 * 便捷方法：把宿主原始语言标签归一化后设为全局语言。
 * @param rawLocale 宿主原始语言标签（如 `navigator.language`、`vscode.env.language`）。
 * @returns 实际生效的语言。
 */
export function setActiveLocaleFromHost(rawLocale: string | null | undefined): LocaleType {
  return setActiveLocaleFromPreference(LocalePreference.System, rawLocale);
}

/**
 * 在指定语言及其回落链上解析某 key 的原始文案。
 * @param locale 起始语言。
 * @param key 文案 key。
 * @returns 命中的原始文案；全链缺失时返回 key 自身（便于暴露漏配）。
 */
function resolveMessage(locale: LocaleType, key: MessageKey): string {
  // 关键步骤：按「命中语言 → 其回落链」顺序查找首个存在的文案。
  const lookupChain: LocaleType[] = [locale, ...LOCALE_FALLBACKS[locale]];

  for (const chainLocale of lookupChain) {
    /** 该语言目录下对应 key 的文案，可能不存在。 */
    const candidate = MESSAGES[chainLocale]?.[key];
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return key;
}

/**
 * 用插值变量替换文案中的 `{name}` 占位。未提供的占位原样保留。
 * @param template 含占位的文案模板。
 * @param vars 插值变量映射。
 * @returns 替换后的文案。
 */
function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    /** 当前占位对应的变量值。 */
    const value = vars[name];
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * 按当前全局语言取文案。
 * @param key 文案 key。
 * @param vars 可选插值变量。
 * @returns 已解析并插值的文案。
 */
export function t(key: MessageKey, vars?: MessageVars): string {
  return interpolate(resolveMessage(activeLocale, key), vars);
}

/**
 * 翻译函数类型：绑定固定语言的取文案方法。
 */
export type Translator = (key: MessageKey, vars?: MessageVars) => string;

/**
 * 创建绑定固定语言的独立翻译器，不受全局语言影响。
 * 适用于多语言并存、或需要显式指定语言的场景（如静态清单生成）。
 * @param locale 目标语言，接受原始标签或 {@link LocaleType}，会归一化到受支持语言。
 * @returns 绑定该语言的翻译函数。
 */
export function createTranslator(locale: LocaleType | string): Translator {
  /** 归一化后的目标语言。 */
  const resolvedLocale = normalizeLocale(locale);
  return (key, vars) => interpolate(resolveMessage(resolvedLocale, key), vars);
}
