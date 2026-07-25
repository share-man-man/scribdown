import { describe, expect, it } from "vitest";
import { LocalePreference, LocaleType, resolveLocalePreference } from "./index";

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

  /**
   * 未配置偏好且宿主语言未知时，回落到默认英语。
   */
  it("falls back to the default language for an unknown host language", () => {
    expect(resolveLocalePreference(undefined, "fr-FR")).toBe(LocaleType.English);
  });
});
