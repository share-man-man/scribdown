import { PlatformType, ThemeType } from "./enums";

/**
 * 当前项目展示名称。
 */
export const PROJECT_NAME = "Scribdown";

/**
 * 当前项目主页地址（部署在 GitHub Pages 的项目站点，带 /scribdown/ 子路径）。
 */
export const PROJECT_HOMEPAGE_URL = "https://share-man-man.github.io/scribdown/";

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
 * 工具栏「当前章节指示器」class：位于目录按钮左侧，随滚动展示当前可视区所属标题。
 */
export const SCRIBDOWN_TOOLBAR_CURRENT_CLASS_NAME = "scribdown-toolbar-current";

/**
 * 工具栏挂载时附加到 container 上的 class，把 container 标记为 TOC + 正文的 flex 容器。
 */
export const SCRIBDOWN_TOC_HOST_CLASS_NAME = "scribdown-toc-host";

/**
 * 工具栏挂载时用于包裹 container 已有内容的 wrapper class，作为 flex 流中的正文 item，与 TOC 横向并列。
 * 自身 flex:1 填满 TOC 之外的剩余宽度，并作为内部滚动层的定位上下文（position:relative）。
 */
export const SCRIBDOWN_CONTENT_AREA_CLASS_NAME = "scribdown-content-area";

/**
 * 正文内部滚动层 class：位于 .scribdown-content-area 内，position:absolute + inset:0 铺满父级，
 * 由它统一承载正文的横向与纵向滚动（外层 page / content-area 均不滚动）。
 */
export const SCRIBDOWN_CONTENT_SCROLL_CLASS_NAME = "scribdown-content-scroll";

/**
 * 通用「细 + 主题色」滚动条 class：各滚动容器（目录侧栏、正文滚动层等）显式 opt-in 引入，
 * 统一标准 scrollbar-* 与 ::-webkit-scrollbar 兜底配色，避免在多个容器选择器上重复罗列。
 */
export const SCRIBDOWN_THIN_SCROLLBAR_CLASS_NAME = "scribdown-scrollbar-thin";

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
 * 工具栏菜单子项左侧勾选占位 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_MARK_CLASS_NAME =
  "scribdown-toolbar-menu-sub-item-mark";

/**
 * 工具栏菜单子项文字标签 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SUB_ITEM_LABEL_CLASS_NAME =
  "scribdown-toolbar-menu-sub-item-label";

/**
 * 工具栏菜单「下拉选择」触发行的文字标签 class（例：页面宽度）。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SELECT_LABEL_CLASS_NAME =
  "scribdown-toolbar-menu-select-label";

/**
 * 工具栏菜单「下拉选择」触发行的当前值展示 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SELECT_VALUE_CLASS_NAME =
  "scribdown-toolbar-menu-select-value";

/**
 * 工具栏菜单「下拉选择」触发行的 chevron 箭头 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_SELECT_CHEVRON_CLASS_NAME =
  "scribdown-toolbar-menu-select-chevron";

/**
 * 工具栏菜单分组内可折叠的档位列表容器 class。
 */
export const SCRIBDOWN_TOOLBAR_MENU_GROUP_CHOICES_CLASS_NAME =
  "scribdown-toolbar-menu-group-choices";

/**
 * 工具栏目录侧栏顶部标题行 class。
 */
export const SCRIBDOWN_TOOLBAR_TOC_PANEL_TITLE_CLASS_NAME =
  "scribdown-toolbar-toc-panel-title";

/**
 * 工具栏目录侧栏右上角关闭按钮 class。
 */
export const SCRIBDOWN_TOOLBAR_TOC_PANEL_CLOSE_CLASS_NAME =
  "scribdown-toolbar-toc-panel-close";

/**
 * 工具栏目录侧栏「暂无标题」空态 class。
 */
export const SCRIBDOWN_TOOLBAR_TOC_PANEL_EMPTY_CLASS_NAME =
  "scribdown-toolbar-toc-panel-empty";

/**
 * 工具栏当前章节指示器的可见文本 class。
 */
export const SCRIBDOWN_TOOLBAR_CURRENT_TEXT_CLASS_NAME =
  "scribdown-toolbar-current-text";

/**
 * localStorage 中保存页面内容宽度的 key。
 */
export const CONTENT_WIDTH_STORAGE_KEY = "scribdown-content-width";
