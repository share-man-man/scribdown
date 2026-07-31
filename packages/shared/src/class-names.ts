/**
 * Scribdown Markdown 渲染 DOM 的 class 契约。
 * 由 @scribdown/markdown-renderer 写入 DOM，@scribdown/ui-handdrawn 的样式与各宿主按名引用，
 * 统一收敛在此，禁止在其他包重新定义或硬编码。
 */

// ─── 手绘边框 / 内容折叠块 ───

/**
 * 手绘卡片边框类名：可复用的「边框」基底，由内容折叠块、目录根等显式 opt-in 引入。
 */
export const FRAME_CLASS_NAME = "scribdown-frame";

/**
 * 内容折叠块类名：用户手写的原生 <details>（区别于目录用 <details>）在渲染时打上此标。
 */
export const DETAILS_CLASS_NAME = "scribdown-details";

// ─── Frontmatter 元数据卡片 ───

/**
 * Frontmatter 元数据卡片容器类名（文档头部 YAML 键值对展示）。
 */
export const FRONTMATTER_CLASS_NAME = "scribdown-frontmatter";

/**
 * Frontmatter 顶部 chrome 容器类名（仅承载「元数据」标签）。
 */
export const FRONTMATTER_CHROME_CLASS_NAME = "scribdown-frontmatter__chrome";

/**
 * Frontmatter 标签类名。
 */
export const FRONTMATTER_LABEL_CLASS_NAME = "scribdown-frontmatter__label";

/**
 * Frontmatter 键值列表类名。
 */
export const FRONTMATTER_LIST_CLASS_NAME = "scribdown-frontmatter__list";

/**
 * Frontmatter 嵌套键值列表类名（对象类型的值向下展开一层）。
 */
export const FRONTMATTER_LIST_NESTED_CLASS_NAME = "scribdown-frontmatter__list--nested";

// ─── 目录（TOC）与标题 ───

/**
 * 目录容器类名。
 */
export const TOC_CLASS_NAME = "scribdown-toc";

/**
 * 目录摘要按钮类名。
 */
export const TOC_SUMMARY_CLASS_NAME = "scribdown-toc-summary";

/**
 * 目录导航区域类名。
 */
export const TOC_NAV_CLASS_NAME = "scribdown-toc-nav";

/**
 * 目录列表类名。
 */
export const TOC_LIST_CLASS_NAME = "scribdown-toc-list";

/**
 * 目录嵌套列表类名。
 */
export const TOC_LIST_NESTED_CLASS_NAME = "scribdown-toc-list--nested";

/**
 * 目录条目类名前缀。
 */
export const TOC_ITEM_CLASS_PREFIX = "scribdown-toc-item";

/**
 * 目录分支条目类名（拥有可折叠子层级）。
 */
export const TOC_ITEM_BRANCH_CLASS_NAME = "scribdown-toc-item--branch";

/**
 * 目录分支条目折叠态类名（运行时由折叠按钮切换，控制隐藏嵌套列表与箭头朝向）。
 */
export const TOC_ITEM_COLLAPSED_CLASS_NAME = "scribdown-toc-item--collapsed";

/**
 * 目录条目标题跳转链接类名：叶子与分支共用同一种 <a href="#id"> 元素与跳转逻辑。
 */
export const TOC_LINK_CLASS_NAME = "scribdown-toc-link";

/**
 * 目录标题链接「当前章节」高亮类名：scrollspy 命中当前可视区标题时切换，与工具栏当前指示器同步。
 */
export const TOC_LINK_ACTIVE_CLASS_NAME = "scribdown-toc-link--active";

/**
 * 目录分支折叠按钮类名（与标题链接分离，专职展开/折叠，避免与跳转冲突）。
 */
export const TOC_TOGGLE_CLASS_NAME = "scribdown-toc-toggle";

/**
 * 标题文本包裹层类名：用于按行绘制手绘高亮，确保多行标题每行都有底色。
 */
export const HEADING_MARK_CLASS_NAME = "scribdown-heading-mark";

// ─── 图片 figure ───

/**
 * 图片 figure 容器类名。
 */
export const IMAGE_FIGURE_CLASS_NAME = "scribdown-image-figure";

/**
 * 图片边框容器类名。
 */
export const IMAGE_FRAME_CLASS_NAME = "scribdown-image-frame";

/**
 * 图片元素类名。
 */
export const IMAGE_ELEMENT_CLASS_NAME = "scribdown-image";

/**
 * 图片标题类名。
 */
export const IMAGE_CAPTION_CLASS_NAME = "scribdown-image-caption";

/**
 * 图片加载失败状态类名。
 */
export const IMAGE_FRAME_FAILED_CLASS_NAME = "scribdown-image-frame--failed";

/**
 * 图片加载完成状态类名。
 */
export const IMAGE_FRAME_LOADED_CLASS_NAME = "scribdown-image-frame--loaded";

/**
 * 图片失败态占位内容类名。
 */
export const IMAGE_FALLBACK_CLASS_NAME = "scribdown-image-fallback";

/**
 * 图片失败态图标类名。
 */
export const IMAGE_FALLBACK_ICON_CLASS_NAME = "scribdown-image-fallback-icon";

/**
 * 图片失败态标题类名。
 */
export const IMAGE_FALLBACK_TEXT_CLASS_NAME = "scribdown-image-fallback-text";

/**
 * 图片失败态来源类名。
 */
export const IMAGE_FALLBACK_SOURCE_CLASS_NAME = "scribdown-image-fallback-source";

// ─── 视频 figure ───

/**
 * 视频 figure 容器类名。
 */
export const VIDEO_FIGURE_CLASS_NAME = "scribdown-video-figure";

/**
 * 视频边框容器类名。
 */
export const VIDEO_FRAME_CLASS_NAME = "scribdown-video-frame";

/**
 * 视频元素类名。
 */
export const VIDEO_ELEMENT_CLASS_NAME = "scribdown-video";

/**
 * 视频加载失败状态类名。
 */
export const VIDEO_FRAME_FAILED_CLASS_NAME = "scribdown-video-frame--failed";

/**
 * 视频加载完成状态类名。
 */
export const VIDEO_FRAME_LOADED_CLASS_NAME = "scribdown-video-frame--loaded";

/**
 * 视频失败态占位内容类名。
 */
export const VIDEO_FALLBACK_CLASS_NAME = "scribdown-video-fallback";

/**
 * 视频失败态图标类名。
 */
export const VIDEO_FALLBACK_ICON_CLASS_NAME = "scribdown-video-fallback-icon";

/**
 * 视频失败态标题类名。
 */
export const VIDEO_FALLBACK_TEXT_CLASS_NAME = "scribdown-video-fallback-text";

/**
 * 视频失败态来源类名。
 */
export const VIDEO_FALLBACK_SOURCE_CLASS_NAME = "scribdown-video-fallback-source";

// ─── 媒体查看器共用控件 ───

/**
 * 图片 / Mermaid 查看器共用按钮类名。
 */
export const VIEWER_CONTROL_BUTTON_CLASS_NAME = "scribdown-viewer-control-button";

/**
 * 图片 / Mermaid 查看器共用缩放按钮组类名。
 */
export const VIEWER_ZOOM_GROUP_CLASS_NAME = "scribdown-viewer-zoom-group";

/**
 * 图片 / Mermaid 查看器共用缩放比例类名。
 */
export const VIEWER_ZOOM_VALUE_CLASS_NAME = "scribdown-viewer-zoom-value";

// ─── 图片全图查看器 ───

/**
 * 图片查看器 dialog 类名。
 */
export const IMAGE_VIEWER_DIALOG_CLASS_NAME = "scribdown-image-viewer";

/**
 * 图片查看器缩放状态类名。
 */
export const IMAGE_VIEWER_ZOOMED_CLASS_NAME = "scribdown-image-viewer--zoomed";

/**
 * 图片查看器拖拽状态类名。
 */
export const IMAGE_VIEWER_DRAGGING_CLASS_NAME = "scribdown-image-viewer--dragging";

/**
 * 图片查看器标题区域类名（包裹 caption + hint）。
 */
export const IMAGE_VIEWER_CAPTION_GROUP_CLASS_NAME = "scribdown-image-viewer__caption-group";

/**
 * 图片查看器快捷键提示类名。
 */
export const IMAGE_VIEWER_HINT_CLASS_NAME = "scribdown-image-viewer__hint";

/**
 * 图片查看器顶部区域类名。
 */
export const IMAGE_VIEWER_CHROME_CLASS_NAME = "scribdown-image-viewer__chrome";

/**
 * 图片查看器按钮区域类名。
 */
export const IMAGE_VIEWER_CONTROLS_CLASS_NAME = "scribdown-image-viewer__controls";

/**
 * 图片查看器按钮类名。
 */
export const IMAGE_VIEWER_BUTTON_CLASS_NAME = "scribdown-image-viewer__button";

/**
 * 图片查看器关闭按钮修饰类名。
 */
export const IMAGE_VIEWER_CLOSE_BUTTON_CLASS_NAME = "scribdown-image-viewer__button--close";

/**
 * 图片查看器视口类名。
 */
export const IMAGE_VIEWER_VIEWPORT_CLASS_NAME = "scribdown-image-viewer__viewport";

/**
 * 图片查看器图片类名。
 */
export const IMAGE_VIEWER_IMAGE_CLASS_NAME = "scribdown-image-viewer__image";

/**
 * 图片查看器说明文字类名。
 */
export const IMAGE_VIEWER_CAPTION_CLASS_NAME = "scribdown-image-viewer__caption";

/**
 * 图片查看器缩放数值类名。
 */
export const IMAGE_VIEWER_ZOOM_VALUE_CLASS_NAME = "scribdown-image-viewer__zoom-value";

// ─── 代码块 chrome ───

/**
 * 代码块外层 figure 类名。
 */
export const CODE_BLOCK_CLASS_NAME = "scribdown-code-block";

/**
 * 代码块顶部 chrome 区域类名。
 */
export const CODE_BLOCK_CHROME_CLASS_NAME = "scribdown-code-block__chrome";

/**
 * 代码块正文区域类名。
 */
export const CODE_BLOCK_BODY_CLASS_NAME = "scribdown-code-block__body";

/**
 * 代码块语言标签类名。
 */
export const CODE_BLOCK_LANG_CLASS_NAME = "scribdown-code-block__lang";

/**
 * 代码块复制按钮类名。
 */
export const CODE_BLOCK_COPY_CLASS_NAME = "scribdown-code-block__copy";

/**
 * 代码块复制按钮图标类名。
 */
export const CODE_BLOCK_COPY_ICON_CLASS_NAME = "scribdown-code-block__copy-icon";

/**
 * 代码块复制按钮"复制"态图标类名（默认显示）。
 */
export const CODE_BLOCK_COPY_ICON_COPY_CLASS_NAME = "scribdown-code-block__copy-icon--copy";

/**
 * 代码块复制按钮"已复制"态图标类名（复制成功后显示）。
 */
export const CODE_BLOCK_COPY_ICON_CHECK_CLASS_NAME = "scribdown-code-block__copy-icon--check";

/**
 * 代码块代码行类名。
 */
export const CODE_BLOCK_LINE_CLASS_NAME = "scribdown-code-block__line";

/**
 * 代码块行号固定列类名。
 */
export const CODE_BLOCK_GUTTER_CLASS_NAME = "scribdown-code-block__gutter";

/**
 * 代码块行号固定列中的单行节点类名。
 */
export const CODE_BLOCK_GUTTER_LINE_CLASS_NAME = "scribdown-code-block__gutter-line";

// ─── 通用复制按钮 ───

/**
 * Markdown 内容复制按钮类名。
 */
export const CONTENT_COPY_BUTTON_CLASS_NAME = "scribdown-copy-button";

/**
 * Markdown 内容复制按钮图标类名。
 */
export const CONTENT_COPY_ICON_CLASS_NAME = "scribdown-copy-button__icon";

/**
 * Markdown 内容复制按钮默认图标类名。
 */
export const CONTENT_COPY_ICON_COPY_CLASS_NAME = "scribdown-copy-button__icon--copy";

/**
 * Markdown 内容复制按钮成功图标类名。
 */
export const CONTENT_COPY_ICON_CHECK_CLASS_NAME = "scribdown-copy-button__icon--check";

// ─── Mermaid 图表 ───

/**
 * Mermaid 图表外层 figure 容器类名。
 */
export const MERMAID_FIGURE_CLASS_NAME = "scribdown-mermaid";

/**
 * Mermaid 图表顶部 chrome 容器类名。
 */
export const MERMAID_CHROME_CLASS_NAME = "scribdown-mermaid__chrome";

/**
 * Mermaid 图表语言标签类名。
 */
export const MERMAID_LABEL_CLASS_NAME = "scribdown-mermaid__label";

/**
 * Mermaid 图表正文容器类名。
 */
export const MERMAID_BODY_CLASS_NAME = "scribdown-mermaid__body";

/**
 * Mermaid 图表 SVG 画布容器类名。
 */
export const MERMAID_CANVAS_CLASS_NAME = "scribdown-mermaid__canvas";

/**
 * Mermaid 图表失败态容器类名。
 */
export const MERMAID_FALLBACK_CLASS_NAME = "scribdown-mermaid__fallback";

/**
 * Mermaid 失败态图标类名。
 */
export const MERMAID_FALLBACK_ICON_CLASS_NAME = "scribdown-mermaid__fallback-icon";

/**
 * Mermaid 失败态文案类名。
 */
export const MERMAID_FALLBACK_TEXT_CLASS_NAME = "scribdown-mermaid__fallback-text";

/**
 * Mermaid 失败态源码块类名。
 */
export const MERMAID_FALLBACK_SOURCE_CLASS_NAME = "scribdown-mermaid__fallback-source";

/**
 * Mermaid 加载/失败/完成态修饰类名。
 */
export const MERMAID_FIGURE_LOADING_CLASS_NAME = "scribdown-mermaid--loading";

/**
 * MERMAID_FIGURE_FAILED_CLASS_NAME
 */
export const MERMAID_FIGURE_FAILED_CLASS_NAME = "scribdown-mermaid--failed";

/**
 * MERMAID_FIGURE_LOADED_CLASS_NAME
 */
export const MERMAID_FIGURE_LOADED_CLASS_NAME = "scribdown-mermaid--loaded";

/**
 * Mermaid 全屏按钮类名（位于 figure 右下角）。
 */
export const MERMAID_FULLSCREEN_BUTTON_CLASS_NAME = "scribdown-mermaid__fullscreen";

/**
 * Mermaid 非全屏工具组类名。
 */
export const MERMAID_CONTROLS_CLASS_NAME = "scribdown-mermaid__controls";

/**
 * Mermaid 非全屏缩放按钮组类名。
 */
export const MERMAID_ZOOM_GROUP_CLASS_NAME = "scribdown-mermaid__zoom-group";

/**
 * Mermaid 非全屏工具按钮类名。
 */
export const MERMAID_CONTROL_BUTTON_CLASS_NAME = "scribdown-mermaid__control-button";

/**
 * Mermaid 非全屏缩放百分比类名。
 */
export const MERMAID_ZOOM_VALUE_CLASS_NAME = "scribdown-mermaid__zoom-value";

/**
 * Mermaid 非全屏拖拽模式类名。
 */
export const MERMAID_DRAG_MODE_CLASS_NAME = "scribdown-mermaid--drag-mode";

/**
 * Mermaid 非全屏拖拽中类名。
 */
export const MERMAID_DRAGGING_CLASS_NAME = "scribdown-mermaid--dragging";

// ─── Mermaid 全屏查看器 ───

/**
 * Mermaid 全屏查看器 dialog 类名。
 */
export const MERMAID_VIEWER_DIALOG_CLASS_NAME = "scribdown-mermaid-viewer";

/**
 * Mermaid 全屏查看器缩放进行中状态类名。
 */
export const MERMAID_VIEWER_ZOOMED_CLASS_NAME = "scribdown-mermaid-viewer--zoomed";

/**
 * Mermaid 全屏查看器拖拽模式类名。
 */
export const MERMAID_VIEWER_DRAG_MODE_CLASS_NAME = "scribdown-mermaid-viewer--drag-mode";

/**
 * Mermaid 全屏查看器拖拽中状态类名。
 */
export const MERMAID_VIEWER_DRAGGING_CLASS_NAME = "scribdown-mermaid-viewer--dragging";

/**
 * Mermaid 全屏查看器顶部 chrome 类名。
 */
export const MERMAID_VIEWER_CHROME_CLASS_NAME = "scribdown-mermaid-viewer__chrome";

/**
 * Mermaid 全屏查看器 caption 类名。
 */
export const MERMAID_VIEWER_CAPTION_CLASS_NAME = "scribdown-mermaid-viewer__caption";

/**
 * Mermaid 全屏查看器控件容器类名。
 */
export const MERMAID_VIEWER_CONTROLS_CLASS_NAME = "scribdown-mermaid-viewer__controls";

/**
 * Mermaid 全屏查看器按钮类名。
 */
export const MERMAID_VIEWER_BUTTON_CLASS_NAME = "scribdown-mermaid-viewer__button";

/**
 * Mermaid 全屏查看器关闭按钮修饰类名。
 */
export const MERMAID_VIEWER_CLOSE_BUTTON_CLASS_NAME = "scribdown-mermaid-viewer__button--close";

/**
 * Mermaid 全屏查看器视口类名。
 */
export const MERMAID_VIEWER_VIEWPORT_CLASS_NAME = "scribdown-mermaid-viewer__viewport";

/**
 * Mermaid 全屏查看器画布类名。
 */
export const MERMAID_VIEWER_CANVAS_CLASS_NAME = "scribdown-mermaid-viewer__canvas";

/**
 * Mermaid 全屏查看器缩放百分比文本类名。
 */
export const MERMAID_VIEWER_ZOOM_VALUE_CLASS_NAME = "scribdown-mermaid-viewer__zoom-value";

// ─── 表格交互 ───

/**
 * 表格交互壳层类名。
 */
export const TABLE_WRAPPER_CLASS_NAME = "scribdown-table";

/**
 * 表格复制按钮修饰类名。
 */
export const TABLE_COPY_BUTTON_CLASS_NAME = "scribdown-table__copy";
