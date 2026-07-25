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
  SimplifiedChinese = "zh-CN",
  /** 繁体中文。 */
  TraditionalChinese = "zh-TW",
  /** 日语。 */
  Japanese = "ja",
  /** 韩语。 */
  Korean = "ko",
  /** 西班牙语。 */
  Spanish = "es",
  /** 法语。 */
  French = "fr",
  /** 德语。 */
  German = "de",
  /** 巴西葡萄牙语。 */
  BrazilianPortuguese = "pt-BR",
  /** 俄语。 */
  Russian = "ru"
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
  SimplifiedChinese = LocaleType.SimplifiedChinese,
  /** 始终使用繁体中文。 */
  TraditionalChinese = LocaleType.TraditionalChinese,
  /** 始终使用日语。 */
  Japanese = LocaleType.Japanese,
  /** 始终使用韩语。 */
  Korean = LocaleType.Korean,
  /** 始终使用西班牙语。 */
  Spanish = LocaleType.Spanish,
  /** 始终使用法语。 */
  French = LocaleType.French,
  /** 始终使用德语。 */
  German = LocaleType.German,
  /** 始终使用巴西葡萄牙语。 */
  BrazilianPortuguese = LocaleType.BrazilianPortuguese,
  /** 始终使用俄语。 */
  Russian = LocaleType.Russian
}

/**
 * 当前支持的全部语言列表（用于校验入参、遍历生成静态文件）。
 */
export const SUPPORTED_LOCALES: LocaleType[] = [
  LocaleType.English,
  LocaleType.SimplifiedChinese,
  LocaleType.TraditionalChinese,
  LocaleType.Japanese,
  LocaleType.Korean,
  LocaleType.Spanish,
  LocaleType.French,
  LocaleType.German,
  LocaleType.BrazilianPortuguese,
  LocaleType.Russian
];

/** 工具栏与宿主配置共用的可选语言定义。 */
export interface LocalePreferenceOption {
  /** 持久化到宿主配置的显式语言偏好。 */
  preference: Exclude<LocalePreference, LocalePreference.System>;
  /** 此偏好对应的实际界面语言。 */
  locale: LocaleType;
  /** 语言的原生自称，跨界面语言保持一致，便于识别和切换。 */
  nativeLabel: string;
}

/** 语言选择器按稳定顺序展示的全部显式语言选项；跟随应用语言是未设置偏好的默认行为。 */
export const LOCALE_PREFERENCE_OPTIONS: readonly LocalePreferenceOption[] = [
  { preference: LocalePreference.English, locale: LocaleType.English, nativeLabel: "English" },
  {
    preference: LocalePreference.SimplifiedChinese,
    locale: LocaleType.SimplifiedChinese,
    nativeLabel: "简体中文"
  },
  {
    preference: LocalePreference.TraditionalChinese,
    locale: LocaleType.TraditionalChinese,
    nativeLabel: "繁體中文"
  },
  { preference: LocalePreference.Japanese, locale: LocaleType.Japanese, nativeLabel: "日本語" },
  { preference: LocalePreference.Korean, locale: LocaleType.Korean, nativeLabel: "한국어" },
  { preference: LocalePreference.Spanish, locale: LocaleType.Spanish, nativeLabel: "Español" },
  { preference: LocalePreference.French, locale: LocaleType.French, nativeLabel: "Français" },
  { preference: LocalePreference.German, locale: LocaleType.German, nativeLabel: "Deutsch" },
  {
    preference: LocalePreference.BrazilianPortuguese,
    locale: LocaleType.BrazilianPortuguese,
    nativeLabel: "Português (Brasil)"
  },
  { preference: LocalePreference.Russian, locale: LocaleType.Russian, nativeLabel: "Русский" }
];

/**
 * 各语言的回落链：命中语言缺失某 key 时，按顺序回落到链上语言，最终止于 {@link DEFAULT_LOCALE}。
 * 默认语言自身链为空。
 */
export const LOCALE_FALLBACKS: Record<LocaleType, LocaleType[]> = {
  [LocaleType.English]: [],
  [LocaleType.SimplifiedChinese]: [LocaleType.English],
  [LocaleType.TraditionalChinese]: [LocaleType.English],
  [LocaleType.Japanese]: [LocaleType.English],
  [LocaleType.Korean]: [LocaleType.English],
  [LocaleType.Spanish]: [LocaleType.English],
  [LocaleType.French]: [LocaleType.English],
  [LocaleType.German]: [LocaleType.English],
  [LocaleType.BrazilianPortuguese]: [LocaleType.English],
  [LocaleType.Russian]: [LocaleType.English]
};

/**
 * 语言 → Chrome 扩展 `_locales/<dir>/messages.json` 目录名映射。
 * Chrome 约定 locale 目录名用下划线（如 `zh_CN`）。
 */
export const CHROME_LOCALE_DIRECTORY: Record<LocaleType, string> = {
  [LocaleType.English]: "en",
  [LocaleType.SimplifiedChinese]: "zh_CN",
  [LocaleType.TraditionalChinese]: "zh_TW",
  [LocaleType.Japanese]: "ja",
  [LocaleType.Korean]: "ko",
  [LocaleType.Spanish]: "es",
  [LocaleType.French]: "fr",
  [LocaleType.German]: "de",
  [LocaleType.BrazilianPortuguese]: "pt_BR",
  [LocaleType.Russian]: "ru"
};

/**
 * 语言 → VS Code `package.nls[.<suffix>].json` 文件名后缀映射。
 * VS Code 约定后缀用小写连字符（如 `zh-cn`）；默认语言写入无后缀的 `package.nls.json`。
 */
export const VSCODE_NLS_SUFFIX: Record<LocaleType, string> = {
  [LocaleType.English]: "",
  [LocaleType.SimplifiedChinese]: "zh-cn",
  [LocaleType.TraditionalChinese]: "zh-tw",
  [LocaleType.Japanese]: "ja",
  [LocaleType.Korean]: "ko",
  [LocaleType.Spanish]: "es",
  [LocaleType.French]: "fr",
  [LocaleType.German]: "de",
  [LocaleType.BrazilianPortuguese]: "pt-br",
  [LocaleType.Russian]: "ru"
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

  // 关键步骤：中文同时支持简体与繁体，需在主语言回落前依据 script / region 区分。
  if (normalizedTag.startsWith("zh-")) {
    /** 指示繁体中文的 BCP-47 script 或常见地区子标签。 */
    const traditionalChineseSubtags = ["hant", "tw", "hk", "mo"];
    /** 分隔后的中文语言子标签。 */
    const chineseSubtags = normalizedTag.split("-").slice(1);
    if (chineseSubtags.some((subtag) => traditionalChineseSubtags.includes(subtag))) {
      return LocaleType.TraditionalChinese;
    }
    return LocaleType.SimplifiedChinese;
  }

  /** 原始标签的主语言子标签（如 `ja-jp` → `ja`）。 */
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
    case LocalePreference.TraditionalChinese:
    case LocalePreference.Japanese:
    case LocalePreference.Korean:
    case LocalePreference.Spanish:
    case LocalePreference.French:
    case LocalePreference.German:
    case LocalePreference.BrazilianPortuguese:
    case LocalePreference.Russian:
    case LocalePreference.System:
      return true;
    default:
      return false;
  }
}
