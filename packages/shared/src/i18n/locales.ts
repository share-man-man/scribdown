/**
 * Scribdown 国际化「语言」契约。
 * 统一收敛支持的 locale、默认兜底、回落链，以及各宿主静态文件（Chrome _locales、
 * VS Code package.nls）的目录/后缀命名映射，禁止在其他包重新定义或硬编码。
 */

/**
 * 支持的界面语言枚举（BCP-47 规范写法）。
 * 新增语言时在此追加，并在 {@link SUPPORTED_LOCALES}、{@link LOCALE_FALLBACKS}、
 * messages 目录三处补齐即可，无需改动接线逻辑。
 */
export enum LocaleType {
  /** 英语（默认兜底语言）。 */
  English = "en",
  /** 简体中文。 */
  SimplifiedChinese = "zh-CN"
}

/**
 * 默认兜底语言：无法识别宿主语言、或某语言缺失文案时最终回落到此。
 */
export const DEFAULT_LOCALE: LocaleType = LocaleType.English;

/**
 * 界面语言偏好。`System` 表示未显式选择语言，跟随浏览器或编辑器的系统界面语言。
 * 宿主负责将该值持久化到自己的全局配置；共享层只负责解析，避免耦合 Web Storage。
 */
export enum LocalePreference {
  /** 跟随宿主系统界面语言。 */
  System = "system",
  /** 始终使用英语。 */
  English = LocaleType.English,
  /** 始终使用简体中文。 */
  SimplifiedChinese = LocaleType.SimplifiedChinese
}

/**
 * 当前支持的全部语言列表（用于校验入参、遍历生成静态文件）。
 */
export const SUPPORTED_LOCALES: LocaleType[] = [LocaleType.English, LocaleType.SimplifiedChinese];

/**
 * 各语言的回落链：命中语言缺失某 key 时，按顺序回落到链上语言，最终止于 {@link DEFAULT_LOCALE}。
 * 默认语言自身链为空。
 */
export const LOCALE_FALLBACKS: Record<LocaleType, LocaleType[]> = {
  [LocaleType.English]: [],
  [LocaleType.SimplifiedChinese]: [LocaleType.English]
};

/**
 * 语言 → Chrome 扩展 `_locales/<dir>/messages.json` 目录名映射。
 * Chrome 约定 locale 目录名用下划线（如 `zh_CN`）。
 */
export const CHROME_LOCALE_DIRECTORY: Record<LocaleType, string> = {
  [LocaleType.English]: "en",
  [LocaleType.SimplifiedChinese]: "zh_CN"
};

/**
 * 语言 → VS Code `package.nls[.<suffix>].json` 文件名后缀映射。
 * VS Code 约定后缀用小写连字符（如 `zh-cn`）；默认语言写入无后缀的 `package.nls.json`。
 */
export const VSCODE_NLS_SUFFIX: Record<LocaleType, string> = {
  [LocaleType.English]: "",
  [LocaleType.SimplifiedChinese]: "zh-cn"
};

/**
 * 把宿主上报的原始语言标签归一化成受支持的 {@link LocaleType}。
 * 逐级降级匹配：先精确命中，再按主语言子标签匹配（如 `zh-Hans-CN` → `zh-CN`），
 * 全不命中回落到 {@link DEFAULT_LOCALE}。
 * @param rawLocale 宿主原始语言标签（如 `navigator.language`、`vscode.env.language`），大小写与分隔符不限。
 * @returns 归一化后的受支持语言。
 */
export function normalizeLocale(rawLocale: string | null | undefined): LocaleType {
  if (!rawLocale) {
    return DEFAULT_LOCALE;
  }

  /** 统一成小写、连字符分隔的标签，兼容下划线写法（如 `zh_CN`）。 */
  const normalizedTag = rawLocale.toLowerCase().replace(/_/g, "-");

  // 关键步骤：精确命中受支持语言（大小写无关）。
  const exactMatch = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalizedTag);
  if (exactMatch) {
    return exactMatch;
  }

  /** 原始标签的主语言子标签（如 `zh-hans-cn` → `zh`）。 */
  const primarySubtag = normalizedTag.split("-")[0];

  // 关键步骤：按主语言子标签匹配，命中同语族的首个受支持语言（如各种 zh-* → zh-CN）。
  const primaryMatch = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase().split("-")[0] === primarySubtag
  );
  if (primaryMatch) {
    return primaryMatch;
  }

  return DEFAULT_LOCALE;
}

/**
 * 解析宿主保存的语言偏好。非法值安全回落到 {@link LocalePreference.System}。
 * @param rawPreference 宿主配置或存储中读到的原始值。
 * @returns 合法的语言偏好。
 */
export function normalizeLocalePreference(rawPreference: unknown): LocalePreference {
  return isLocalePreference(rawPreference) ? rawPreference : LocalePreference.System;
}

/**
 * 判断值是否为受支持的语言偏好。
 * @param value 待校验的原始值。
 * @returns 值为合法 {@link LocalePreference} 时返回 true。
 */
export function isLocalePreference(value: unknown): value is LocalePreference {
  switch (value) {
    case LocalePreference.English:
    case LocalePreference.SimplifiedChinese:
    case LocalePreference.System:
      return true;
    default:
      return false;
  }
}
