import { PlatformType, ThemeType } from "./enums";

/**
 * 当前项目展示名称。
 */
export const PROJECT_NAME = "Scribdown";

/**
 * 当前项目固定 Node.js LTS 版本。
 */
export const NODE_LTS_VERSION = "24.15.0";

/**
 * 当前项目支持的平台列表。
 */
export const SUPPORTED_PLATFORMS: PlatformType[] = [
  PlatformType.BrowserExtension,
  PlatformType.VscodeExtension
];

/**
 * 当前项目默认主题。
 */
export const DEFAULT_THEME = ThemeType.Paper;

/**
 * VS Code 预览命令 ID。
 */
export const OPEN_PREVIEW_COMMAND = "scribdown.openPreview";

/**
 * Markdown 语言 ID。
 */
export const MARKDOWN_LANGUAGE_ID = "markdown";

/**
 * 浏览器插件预览标题。
 */
export const BROWSER_PREVIEW_TITLE = "Browser Preview";

/**
 * Markdown fixture 开发预览标题。
 */
export const MARKDOWN_FIXTURE_PREVIEW_TITLE = "Markdown Fixture Preview";

/**
 * VS Code 预览标题。
 */
export const VSCODE_PREVIEW_TITLE = "VS Code Preview";

/**
 * Scribdown 页面根容器 class。
 */
export const SCRIBDOWN_PAGE_CLASS_NAME = "scribdown-page";

/**
 * Scribdown 应用布局容器 class。
 */
export const SCRIBDOWN_APP_CLASS_NAME = "scribdown-app";

/**
 * Scribdown Markdown 渲染容器 class。
 */
export const SCRIBDOWN_MARKDOWN_CLASS_NAME = "scribdown-markdown";

/**
 * 块级元素源码起始行号的 data 属性名，用于编辑器与预览的双向滚动对齐。
 */
export const SOURCE_LINE_DATA_ATTRIBUTE = "data-source-line";

/**
 * 编辑器光标所在源码行对应预览块的高亮 class。
 */
export const SOURCE_LINE_ACTIVE_CLASS_NAME = "scribdown-source-line-active";

/**
 * 高亮块位于预览视口外时，提示其方向的边缘弧形闪烁 class。
 */
export const SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME = "scribdown-source-line-offscreen-hint";

/**
 * 边缘提示位于视口顶部（高亮块在视口上方）的修饰 class。
 */
export const SOURCE_LINE_OFFSCREEN_HINT_TOP_CLASS_NAME =
  "scribdown-source-line-offscreen-hint--top";

/**
 * 边缘提示位于视口底部（高亮块在视口下方）的修饰 class。
 */
export const SOURCE_LINE_OFFSCREEN_HINT_BOTTOM_CLASS_NAME =
  "scribdown-source-line-offscreen-hint--bottom";
