// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR,
  CONTENT_DENSITY_SPACING_CSS_VAR,
  CONTENT_DENSITY_STORAGE_KEY,
  CONTENT_DENSITY_MIN,
  CONTENT_DENSITY_MAX,
  CONTENT_DENSITY_STEP,
  DEFAULT_CONTENT_DENSITY,
  LocaleType,
  setActiveLocale
} from "@scribdown/shared";

import { mountMarkdownToolbar } from "../index";
import { loadContentDensity } from "./content-density";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(CONTENT_DENSITY_STORAGE_KEY);
  document.documentElement.style.removeProperty(CONTENT_DENSITY_SPACING_CSS_VAR);
  document.documentElement.style.removeProperty(CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR);
  document.body.replaceChildren();
});

/**
 * 挂载真实工具栏并获取紧凑程度滑块。
 * @returns 本次工具栏容器与原生滑块。
 */
function createToolbar(): { container: HTMLElement; slider: HTMLInputElement } {
  setActiveLocale(LocaleType.SimplifiedChinese);
  /** 不需要 Markdown 异步渲染的最小宿主。 */
  const container = document.createElement("div");
  document.body.append(container);
  mountMarkdownToolbar(container);
  /** 按可访问名称定位滑块。 */
  const slider = container.querySelector<HTMLInputElement>(
    'input[type="range"][aria-label="紧凑程度"]'
  )!;
  expect(slider).not.toBeNull();
  return { container, slider };
}

describe("content density", () => {
  it("groups width and density, previews intermediate values and restores the saved value", () => {
    /** 首次挂载的宿主及滑块。 */
    const { container, slider } = createToolbar();
    /** 包含两种阅读设置的同一语义分组。 */
    const group = slider.closest('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("排版");
    expect(group?.textContent).toContain("页面宽度");
    expect(slider.min).toBe(String(CONTENT_DENSITY_MIN));
    expect(slider.max).toBe(String(CONTENT_DENSITY_MAX));
    expect(slider.step).toBe(String(CONTENT_DENSITY_STEP));
    expect(slider.valueAsNumber).toBe(DEFAULT_CONTENT_DENSITY);
    expect(slider.getAttribute("aria-valuetext")).toContain("标准");
    container.querySelector<HTMLButtonElement>(".scribdown-toolbar-btn--more")!.click();
    slider.value = "120";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.documentElement.style.getPropertyValue(CONTENT_DENSITY_SPACING_CSS_VAR)).toBe(
      "1.2"
    );
    expect(
      Number(document.documentElement.style.getPropertyValue(CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR))
    ).toBeCloseTo(1.75);
    expect(slider.getAttribute("aria-valuetext")).toBe("120%");
    expect(container.querySelector(".scribdown-toolbar-menu")?.classList.contains("is-open")).toBe(
      true
    );
    expect(localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY)).toBeNull();
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY)).toBe("120");
    // 关键步骤：重挂载后检查滑块与正文都恢复中间值，而非只恢复三档端点。
    document.documentElement.style.removeProperty(CONTENT_DENSITY_SPACING_CSS_VAR);
    mountMarkdownToolbar(container);
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("120");
    expect(document.documentElement.style.getPropertyValue(CONTENT_DENSITY_SPACING_CSS_VAR)).toBe(
      "1.2"
    );
  });

  it.each([
    [null, DEFAULT_CONTENT_DENSITY],
    ["", DEFAULT_CONTENT_DENSITY],
    ["obsolete", DEFAULT_CONTENT_DENSITY],
    ["Infinity", DEFAULT_CONTENT_DENSITY],
    ["compact", CONTENT_DENSITY_MIN],
    ["standard", DEFAULT_CONTENT_DENSITY],
    ["relaxed", CONTENT_DENSITY_MAX],
    ["-10", CONTENT_DENSITY_MIN],
    ["999", CONTENT_DENSITY_MAX],
    ["122", 120]
  ])("normalizes stored value %s to %s", (stored, expected) => {
    if (stored !== null) localStorage.setItem(CONTENT_DENSITY_STORAGE_KEY, stored);
    expect(loadContentDensity(document)).toBe(expected);
  });

  it("continues to preview and commit without throwing when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    /** 无存储权限时仍可调整的滑块。 */
    const { slider } = createToolbar();
    expect(slider.valueAsNumber).toBe(DEFAULT_CONTENT_DENSITY);
    slider.value = String(CONTENT_DENSITY_MAX);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      document.documentElement.style.getPropertyValue(CONTENT_DENSITY_LINE_HEIGHT_CSS_VAR)
    ).toBe("1.9");
  });
});
