// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createMarkdownMermaidThemeVariables } from "./mermaid-theme";

describe("createMarkdownMermaidThemeVariables", () => {
  it("maps Scribdown semantic CSS tokens to Mermaid base theme variables", () => {
    // 图表元素直接声明 token，模拟宿主完成明暗主题映射后的计算样式。
    const figureElement = document.createElement("figure");
    figureElement.style.setProperty("--scribdown-color-bg", "#101010");
    figureElement.style.setProperty("--scribdown-color-surface", "#202020");
    figureElement.style.setProperty("--scribdown-color-text-primary", "#f5f5f5");
    figureElement.style.setProperty("--scribdown-color-text-secondary", "#bbbbbb");
    figureElement.style.setProperty("--scribdown-color-accent", "#55aa88");
    figureElement.style.setProperty("--scribdown-color-mark", "#ddbb55");
    figureElement.style.setProperty("--scribdown-color-border", "#665544");
    figureElement.style.setProperty("--scribdown-color-danger", "#dd6655");
    figureElement.style.setProperty("--scribdown-color-warning", "#cc9955");
    figureElement.style.setProperty("--scribdown-font-body", '"Test Serif", serif');
    document.body.append(figureElement);

    // 生成出的变量应直接复用项目 token，不再保留 Mermaid 默认蓝紫配色。
    const themeVariables = createMarkdownMermaidThemeVariables(figureElement);

    expect(themeVariables).toMatchObject({
      background: "#101010",
      primaryColor: "#101010",
      primaryTextColor: "#f5f5f5",
      primaryBorderColor: "#55aa88",
      secondaryColor: "#202020",
      secondaryBorderColor: "#665544",
      tertiaryColor: "#ddbb55",
      lineColor: "#bbbbbb",
      mainBkg: "#101010",
      nodeBkg: "#101010",
      noteBorderColor: "#cc9955",
      errorBkgColor: "#dd6655",
      fontFamily: '"Test Serif", serif',
      useGradient: false
    });
  });

  it("does not duplicate palette values before the stylesheet is available", () => {
    // 未挂任何 token 的元素模拟 CSS 尚未加载的瞬间。
    const figureElement = document.createElement("figure");

    // 样式缺失时交给 Mermaid base 主题保底，不在 TypeScript 中复制 CSS 调色板色值。
    const themeVariables = createMarkdownMermaidThemeVariables(figureElement);

    expect(themeVariables).toBeUndefined();
  });
});
