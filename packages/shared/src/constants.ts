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

/**
 * 浮动工具栏容器 class。
 */
export const SCRIBDOWN_TOOLBAR_CLASS_NAME = "scribdown-toolbar";

/**
 * 工具栏单个按钮 class。
 */
export const SCRIBDOWN_TOOLBAR_BTN_CLASS_NAME = "scribdown-toolbar-btn";

/**
 * 工具栏目录面板 class。
 */
export const SCRIBDOWN_TOOLBAR_TOC_PANEL_CLASS_NAME =
  "scribdown-toolbar-toc-panel";

/**
 * 工具栏挂载时附加到 container 上的 class，把 container 标记为 TOC + 正文的 flex 容器。
 */
export const SCRIBDOWN_TOC_HOST_CLASS_NAME = "scribdown-toc-host";

/**
 * 工具栏挂载时用于包裹 container 已有内容的 wrapper class，作为 flex 流中的正文 item，与 TOC 横向并列。
 */
export const SCRIBDOWN_CONTENT_AREA_CLASS_NAME = "scribdown-content-area";

/**
 * 工具栏「更多」下拉菜单容器 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_CLASS_NAME = "scribdown-toolbar-menu";

/**
 * 工具栏「更多」下拉菜单单个菜单项 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_ITEM_CLASS_NAME =
  "scribdown-toolbar-menu-item";

/**
 * 工具栏「更多」下拉菜单内子项分组容器 class（例：宽度选择下拉）。
 */
export const SCRIBDOWN_TOOLBAR_MENU_GROUP_CLASS_NAME =
  "scribdown-toolbar-menu-group";

/**
 * 工具栏「更多」下拉菜单内子项 class（例：宽度具体档位）。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_CLASS_NAME =
  "scribdown-toolbar-menu-sub-item";

/**
 * localStorage 中保存页面内容宽度的 key。
 */
export const CONTENT_WIDTH_STORAGE_KEY = "scribdown-content-width";
