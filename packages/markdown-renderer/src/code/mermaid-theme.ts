/**
 * Mermaid 主题桥接：把 ui-handdrawn 暴露的 CSS 语义 token 转成 Mermaid 主题变量。
 */

// Mermaid 主题使用的项目 CSS token，集中声明避免读取处重复硬编码。
const MERMAID_THEME_CSS_TOKEN = {
  background: "--scribdown-color-bg",
  surface: "--scribdown-color-surface",
  textPrimary: "--scribdown-color-text-primary",
  textSecondary: "--scribdown-color-text-secondary",
  accent: "--scribdown-color-accent",
  mark: "--scribdown-color-mark",
  border: "--scribdown-color-border",
  danger: "--scribdown-color-danger",
  warning: "--scribdown-color-warning",
  fontBody: "--scribdown-font-body"
} as const;

/**
 * 从图表所在文档解析一个 CSS token。
 * @param computedStyle 图表元素的最终计算样式。
 * @param tokenName CSS 自定义属性名。
 * @returns 可直接传给 Mermaid 的最终样式值；token 缺失时返回 undefined。
 */
function readMermaidCssToken(
  computedStyle: CSSStyleDeclaration,
  tokenName: string
): string | undefined {
  // 自定义属性可能带首尾空白，传给 Mermaid 前统一清理。
  const tokenValue = computedStyle.getPropertyValue(tokenName).trim();
  return tokenValue || undefined;
}

/**
 * 根据当前图表元素的主题生成 Mermaid base 主题变量。
 * @param figureElement Mermaid 图表外层元素。
 * @returns 使用 Scribdown CSS token 解析出的 Mermaid 主题变量；样式未加载时返回 undefined。
 */
export function createMarkdownMermaidThemeVariables(
  figureElement: HTMLElement
): Record<string, string | boolean> | undefined {
  // 关键步骤：从 ownerDocument 获取视图，兼容 iframe 与 VS Code webview。
  const documentView = figureElement.ownerDocument.defaultView;
  // 当前图表的计算样式会包含 :root 明暗主题映射后的 token 值。
  const computedStyle = documentView?.getComputedStyle(figureElement);

  if (!computedStyle) {
    return undefined;
  }

  // 下列值均来自 ui-handdrawn 的语义 token，会随宿主明暗主题一起切换。
  const background = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.background);
  const surface = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.surface);
  const textPrimary = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.textPrimary);
  const textSecondary = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.textSecondary);
  const accent = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.accent);
  const mark = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.mark);
  const border = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.border);
  const danger = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.danger);
  const warning = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.warning);
  const fontBody = readMermaidCssToken(computedStyle, MERMAID_THEME_CSS_TOKEN.fontBody);

  if (
    !background ||
    !surface ||
    !textPrimary ||
    !textSecondary ||
    !accent ||
    !mark ||
    !border ||
    !danger ||
    !warning ||
    !fontBody
  ) {
    return undefined;
  }

  return {
    background,
    // 主节点使用页面底色，与 Mermaid body 的 surface 混合背景拉开明度层次。
    primaryColor: background,
    primaryTextColor: textPrimary,
    primaryBorderColor: accent,
    secondaryColor: surface,
    secondaryTextColor: textPrimary,
    secondaryBorderColor: border,
    tertiaryColor: mark,
    tertiaryTextColor: textPrimary,
    tertiaryBorderColor: warning,
    textColor: textPrimary,
    lineColor: textSecondary,
    arrowheadColor: textSecondary,
    mainBkg: background,
    nodeBkg: background,
    nodeBorder: accent,
    nodeTextColor: textPrimary,
    clusterBkg: background,
    clusterBorder: border,
    edgeLabelBackground: surface,
    noteBkgColor: mark,
    noteTextColor: textPrimary,
    noteBorderColor: warning,
    errorBkgColor: danger,
    errorTextColor: surface,
    critBkgColor: danger,
    critBorderColor: danger,
    todayLineColor: danger,
    fontFamily: fontBody,
    useGradient: false
  };
}
