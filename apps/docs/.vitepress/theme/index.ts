import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./style.css";

/**
 * 文档站自定义主题：沿用 VitePress 默认主题，仅叠加 Scribdown 设计 Token 皮肤。
 * 配色、字体、圆角等均通过 style.css 把 VitePress 主题变量映射到 `--scribdown-*` Token，
 * 不重写布局与组件逻辑。
 */
export default {
  extends: DefaultTheme,
} satisfies Theme;
