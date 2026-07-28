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
export const NODE_LTS_VERSION = "24.18.0";

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
 * Markdown 文件扩展名。
 * 用于兜底识别被宿主注册为其他语言 ID 的 Markdown 文件（如 VS Code 内置
 * prompt-basics 扩展把 SKILL.md 注册为 skill 语言）。
 */
export const MARKDOWN_FILE_EXTNAME = ".md";

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
 * 强制暗色主题 class：加到文档根元素（`<html>`）上，优先级高于系统的
 * `prefers-color-scheme`，供自带主题开关的宿主（文档站、VS Code）显式指定主题。
 * 未加任何主题 class 时默认跟随系统偏好。
 */
export const SCRIBDOWN_THEME_DARK_CLASS_NAME = "scribdown-theme-dark";

/**
 * 强制浅色主题 class：与 {@link SCRIBDOWN_THEME_DARK_CLASS_NAME} 相对，
 * 用于在系统处于暗色时仍把渲染结果锁定为浅色。
 */
export const SCRIBDOWN_THEME_LIGHT_CLASS_NAME = "scribdown-theme-light";

/**
 * 工具栏挂载时附加到 container 上的 class，把 container 标记为 TOC + 正文的 flex 容器。
 */
export const SCRIBDOWN_TOC_HOST_CLASS_NAME = "scribdown-toc-host";

/**
 * 目录侧栏与正文之间的拖拽调宽手柄 class（flex 流中位于 TOC 与正文之间的独立 item）。
 */
export const SCRIBDOWN_TOC_RESIZER_CLASS_NAME = "scribdown-toc-resizer";

/**
 * 拖拽调整目录宽度期间附加到 toc-host 上的 class，用于屏蔽正文文本选中并统一光标。
 */
export const SCRIBDOWN_TOC_RESIZING_CLASS_NAME = "is-toc-resizing";

/**
 * 目录侧栏宽度的 CSS 自定义属性名：声明在 toc-host 上，由 TOC 自身定宽与折叠位移共用。
 */
export const TOC_WIDTH_CSS_VAR = "--scribdown-toc-width";

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

/**
 * localStorage 中保存目录侧栏宽度（纯数字，单位 px）的 key。
 */
export const TOC_WIDTH_STORAGE_KEY = "scribdown-toc-width";

/**
 * 目录侧栏默认宽度（px），与 CSS 中 `min(280px, 70vw)` 的上限保持一致。
 */
export const TOC_WIDTH_DEFAULT_PX = 280;

/**
 * 目录侧栏可拖拽的最小宽度（px），低于此值目录条目已无法阅读。
 */
export const TOC_WIDTH_MIN_PX = 180;

/**
 * 目录侧栏可拖拽的最大宽度（px），另外还受「不超过宿主宽度 70%」约束。
 */
export const TOC_WIDTH_MAX_PX = 640;

/**
 * 目录侧栏宽度相对宿主容器宽度的占比上限，避免窄屏下目录挤没正文。
 */
export const TOC_WIDTH_MAX_HOST_RATIO = 0.7;
