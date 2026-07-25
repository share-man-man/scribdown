import { describe, expect, it } from "vitest";
import { LocalePreference, LocaleType, normalizeLocale, resolveLocalePreference } from "./index";

/**
 * 界面语言优先级解析测试。
 */
describe("resolveLocalePreference", () => {
  /**
   * 显式用户选择必须覆盖系统语言。
   */
  it("prefers an explicit language over the host language", () => {
    expect(resolveLocalePreference(LocalePreference.English, "zh-CN")).toBe(LocaleType.English);
  });

  /**
   * 跟随系统时应归一化宿主提供的语言。
   */
  it("uses the host language when the preference follows the system", () => {
    expect(resolveLocalePreference(LocalePreference.System, "zh-Hans-CN")).toBe(
      LocaleType.SimplifiedChinese
    );
  });

  /** 中文 script / region 子标签应正确映射为繁体中文。 */
  it("uses Traditional Chinese for Traditional Chinese host variants", () => {
    expect(resolveLocalePreference(LocalePreference.System, "zh-Hant-HK")).toBe(
      LocaleType.TraditionalChinese
    );
  });

  /** 新增语言的显式偏好必须覆盖宿主语言。 */
  it("uses an explicit Japanese preference", () => {
    expect(resolveLocalePreference(LocalePreference.Japanese, "es-MX")).toBe(LocaleType.Japanese);
  });

  /** 各新增语言的区域变体应匹配到对应的基础语言。 */
  it("normalizes the new host language variants", () => {
    expect(normalizeLocale("ja-JP")).toBe(LocaleType.Japanese);
    expect(normalizeLocale("ko-KR")).toBe(LocaleType.Korean);
    expect(normalizeLocale("es-MX")).toBe(LocaleType.Spanish);
    expect(normalizeLocale("fr-CA")).toBe(LocaleType.French);
    expect(normalizeLocale("de-AT")).toBe(LocaleType.German);
    expect(normalizeLocale("pt-BR")).toBe(LocaleType.BrazilianPortuguese);
    expect(normalizeLocale("ru-RU")).toBe(LocaleType.Russian);
  });

  /**
   * 未配置偏好且宿主语言未知时，回落到默认英语。
   */
  it("falls back to the default language for an unknown host language", () => {
    expect(resolveLocalePreference(undefined, "it-IT")).toBe(LocaleType.English);
  });
});
