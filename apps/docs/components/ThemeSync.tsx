/**
 * 把 Rspress 的明暗模式同步给 Scribdown 设计 Token。
 *
 * Rspress 的主题开关只在 `<html>` 上增删 `rp-dark`，而 `@scribdown/ui-handdrawn`
 * 的 Token 默认跟随系统 `prefers-color-scheme`，需要宿主显式加 `scribdown-theme-*`
 * 才能覆盖系统偏好。本组件以全局 UI 组件形式挂载，负责两者的单向同步，
 * 使文档站点击主题按钮时，正文与渲染预览页一起切换。
 */

import { useEffect } from "react";

import {
  SCRIBDOWN_THEME_DARK_CLASS_NAME,
  SCRIBDOWN_THEME_LIGHT_CLASS_NAME
} from "@scribdown/shared";

/** Rspress 暗色模式挂在 `<html>` 上的 class。 */
const RSPRESS_DARK_CLASS_NAME = "rp-dark";

/**
 * 无渲染输出的副作用组件：监听 `<html>` 的 class 变化并同步主题标记。
 * @returns 始终为 null，仅用于挂载副作用。
 */
export default function ThemeSync(): null {
  useEffect(() => {
    /** 文档根元素，两套主题 class 都挂在它上面。 */
    const rootElement = document.documentElement;

    /** 依据 Rspress 当前模式重写 scribdown 主题 class。 */
    const syncThemeClass = (): void => {
      /** Rspress 当前是否处于暗色模式。 */
      const isDark = rootElement.classList.contains(RSPRESS_DARK_CLASS_NAME);
      // 关键步骤：两个主题 class 都已是目标状态才跳过，避免自身的 class 变更反复触发
      // MutationObserver；只比对暗色 class 会让「初次进入浅色页」被误判为无需处理，
      // 导致 scribdown-theme-light 一直缺席，系统深色下预览与文档站主题分叉。
      if (
        rootElement.classList.contains(SCRIBDOWN_THEME_DARK_CLASS_NAME) === isDark &&
        rootElement.classList.contains(SCRIBDOWN_THEME_LIGHT_CLASS_NAME) === !isDark
      ) {
        return;
      }
      rootElement.classList.toggle(SCRIBDOWN_THEME_DARK_CLASS_NAME, isDark);
      rootElement.classList.toggle(SCRIBDOWN_THEME_LIGHT_CLASS_NAME, !isDark);
    };

    syncThemeClass();

    /** 监听 Rspress 主题切换（其实现为增删 `<html>` 的 class）。 */
    const classObserver = new MutationObserver(syncThemeClass);
    classObserver.observe(rootElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      classObserver.disconnect();
    };
  }, []);

  return null;
}
