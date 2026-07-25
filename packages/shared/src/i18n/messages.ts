/**
 * Scribdown 全量文案目录（唯一源）。
 * 三处运行时（浏览器 popup/viewer、共享工具栏、VS Code 宿主/webview）与两处静态清单
 * （Chrome `_locales`、VS Code `package.nls`）均以此为准，禁止在各端硬编码或重复定义。
 * 插值占位统一用 `{name}` 语法，由 translator 在运行时替换。
 */

import { LocaleType } from "./locales";
import type { Messages } from "./messages.types";

/**
 * 英语文案（默认兜底语言）。
 */
const EN_MESSAGES: Messages = {
  "toolbar.toc": "Contents",
  "toolbar.tocClose": "Close contents",
  "toolbar.tocEmpty": "No headings",
  "toolbar.more": "More",
  "toolbar.pageWidth": "Page width",
  "toolbar.backTop": "Back to top",
  "toolbar.language": "Language",
  "toolbar.languageSystem": "Follow system",
  "toolbar.languageEnglish": "English",
  "toolbar.languageSimplifiedChinese": "Simplified Chinese",
  "toolbar.about": "About",

  "code.copy": "Copy code",
  "code.copied": "Copied",

  "mermaid.renderFailed": "Diagram failed to render",
  "mermaid.fullscreenButton": "View diagram fullscreen",
  "mermaid.fullscreen": "View Mermaid diagram fullscreen",
  "mermaid.zoomIn": "Zoom in diagram",
  "mermaid.zoomOut": "Zoom out diagram",
  "mermaid.zoomReset": "Reset zoom",
  "mermaid.close": "Close fullscreen view",

  "image.viewFull": "View full image",
  "image.viewFullOf": "View full image: {alt}",
  "image.loadFailed": "Image failed to load",
  "image.hint":
    "Shortcuts: +/= zoom in · - zoom out · 0 reset · Esc close · drag to pan · Ctrl/⌘ + wheel to zoom",
  "image.zoomIn": "Zoom in image",
  "image.zoomOut": "Zoom out image",
  "image.zoomReset": "Reset zoom",
  "image.close": "Close image viewer",

  "video.loadFailed": "Video failed to load",

  "toc.label": "Contents",
  "toc.toggle": "Expand or collapse subheadings",

  "frontmatter.label": "Metadata",

  "popup.enableAria": "Enable Scribdown",
  "popup.enabledTitle": "Scribdown enabled",
  "popup.disabledTitle": "Scribdown disabled",
  "popup.disabledEmpty": "Disabled. Markdown pages are no longer taken over.",
  "popup.fileAccessBannerTitle": "⚠️ “Allow access to file URLs” is off",
  "popup.fileAccessBannerText":
    "Local .md files can’t be taken over or auto-refreshed by Scribdown. Turn the switch on to enable it.",
  "popup.fileAccessAction": "Turn on",
  "popup.fileAccessActionAria": "Open the extension details page to allow access to file URLs",
  "popup.autoRefreshGroupAria": "Local file auto-refresh settings",
  "popup.autoRefreshLabel": "Auto-refresh local files",
  "popup.autoRefreshInfoAria": "About local file auto-refresh",
  "popup.autoRefreshOnTip": "On: re-fetches the local .md file every {seconds}s",
  "popup.autoRefreshOffTip": "Off: reload the page manually after the local .md changes",
  "popup.intervalLabel": "Refresh interval",
  "popup.intervalInfoAria": "Refresh interval range",
  "popup.intervalRangeTip": "Range {min}–{max} seconds",
  "popup.intervalUnit": "s",
  "popup.savedTip": "Saved. Reload the current page to apply.",

  "browser.disabledTitle": "Scribdown (disabled)",
  "browser.fileAccessNeededTitle": "Scribdown · needs “Allow access to file URLs”",

  "viewer.errorHeading": "Scribdown can’t render this file",
  "viewer.viewRawLink": "View raw source",
  "viewer.errorIframe": "The Scribdown viewer can’t load inside an iframe.",
  "viewer.errorMissingSrc": "Missing src parameter.",
  "viewer.errorRequestFailed": "Request failed: {message}",
  "viewer.errorNotMarkdown": "Response is not Markdown (Content-Type: {contentType}).",
  "viewer.contentTypeUndeclared": "undeclared",
  "viewer.errorEmpty": "The file is empty.",
  "viewer.errorUnsupportedProtocol":
    "Unsupported protocol ({protocol}); only http / https are allowed.",
  "viewer.errorInvalidUrl": "The src parameter is not a valid URL.",

  "vscode.noMarkdownWarning": "Open a Markdown document first, then run Scribdown preview.",
  "vscode.openLinkFailed": "Can’t open link: {href}",
  "vscode.linkTargetMissing": "Link target not found: {path}",
  "vscode.renderFailed": "Render failed",

  "manifest.browserName": "Scribdown",
  "manifest.browserDescription": "Handdrawn markdown rendering experience.",
  "manifest.vscodeDisplayName": "Scribdown Markdown Preview",
  "manifest.vscodeDescription": "Handdrawn-style Markdown preview for VS Code.",
  "manifest.vscodeCommandTitle": "Open Scribdown Preview",
  "manifest.vscodeLanguageDescription": "Choose the language used by Scribdown's interface.",
  "manifest.vscodeLanguageSystemDescription": "Follow the VS Code display language.",
  "manifest.vscodeLanguageEnglishDescription": "Use English.",
  "manifest.vscodeLanguageSimplifiedChineseDescription": "Use Simplified Chinese."
};

/**
 * 简体中文文案。
 */
const ZH_CN_MESSAGES: Messages = {
  "toolbar.toc": "目录",
  "toolbar.tocClose": "关闭目录",
  "toolbar.tocEmpty": "暂无标题",
  "toolbar.more": "更多",
  "toolbar.pageWidth": "页面宽度",
  "toolbar.backTop": "回到顶部",
  "toolbar.language": "语言",
  "toolbar.languageSystem": "跟随系统",
  "toolbar.languageEnglish": "English",
  "toolbar.languageSimplifiedChinese": "简体中文",
  "toolbar.about": "关于",

  "code.copy": "复制代码",
  "code.copied": "已复制",

  "mermaid.renderFailed": "图表渲染失败",
  "mermaid.fullscreenButton": "全屏查看图表",
  "mermaid.fullscreen": "全屏查看 Mermaid 图表",
  "mermaid.zoomIn": "放大图表",
  "mermaid.zoomOut": "缩小图表",
  "mermaid.zoomReset": "重置缩放",
  "mermaid.close": "关闭全屏查看",

  "image.viewFull": "查看全图",
  "image.viewFullOf": "查看全图：{alt}",
  "image.loadFailed": "图片加载失败",
  "image.hint":
    "快捷键：+/= 放大 · - 缩小 · 0 重置 · Esc 关闭 · 鼠标拖拽可平移 · Ctrl/⌘ + 滚轮缩放",
  "image.zoomIn": "放大图片",
  "image.zoomOut": "缩小图片",
  "image.zoomReset": "重置缩放",
  "image.close": "关闭全图查看",

  "video.loadFailed": "视频加载失败",

  "toc.label": "目录",
  "toc.toggle": "展开或折叠子目录",

  "frontmatter.label": "元数据",

  "popup.enableAria": "启用 Scribdown",
  "popup.enabledTitle": "已启用 Scribdown",
  "popup.disabledTitle": "已关闭 Scribdown",
  "popup.disabledEmpty": "已关闭，访问 .md 不再被接管。",
  "popup.fileAccessBannerTitle": "⚠️ 「允许访问文件网址」未开启",
  "popup.fileAccessBannerText":
    "本地 .md 文件无法被 Scribdown 接管与自动刷新。打开开关后即可生效。",
  "popup.fileAccessAction": "去开启",
  "popup.fileAccessActionAria": "打开扩展详情页以开启允许访问文件网址",
  "popup.autoRefreshGroupAria": "本地文件自动刷新设置",
  "popup.autoRefreshLabel": "本地文件自动刷新",
  "popup.autoRefreshInfoAria": "查看本地文件自动刷新说明",
  "popup.autoRefreshOnTip": "已开启：每 {seconds} 秒回拉一次本地 .md 文件",
  "popup.autoRefreshOffTip": "已关闭：本地 .md 更新后需手动刷新页面",
  "popup.intervalLabel": "刷新间隔",
  "popup.intervalInfoAria": "查看刷新间隔取值范围",
  "popup.intervalRangeTip": "取值范围 {min} – {max} 秒",
  "popup.intervalUnit": "秒",
  "popup.savedTip": "切换已保存，刷新当前页面后生效。",

  "browser.disabledTitle": "Scribdown（已关闭）",
  "browser.fileAccessNeededTitle": "Scribdown · 需开启「允许访问文件网址」",

  "viewer.errorHeading": "Scribdown 无法渲染该文件",
  "viewer.viewRawLink": "查看原始链接",
  "viewer.errorIframe": "Scribdown viewer 不允许在 iframe 中加载。",
  "viewer.errorMissingSrc": "缺少 src 参数。",
  "viewer.errorRequestFailed": "请求失败：{message}",
  "viewer.errorNotMarkdown": "响应不是 Markdown 类型（Content-Type: {contentType}）。",
  "viewer.contentTypeUndeclared": "未声明",
  "viewer.errorEmpty": "文件内容为空。",
  "viewer.errorUnsupportedProtocol": "不支持的协议（{protocol}），仅允许 http / https。",
  "viewer.errorInvalidUrl": "src 参数不是合法的 URL。",

  "vscode.noMarkdownWarning": "请先打开一个 Markdown 文档，再执行 Scribdown 预览。",
  "vscode.openLinkFailed": "无法打开链接：{href}",
  "vscode.linkTargetMissing": "链接目标不存在：{path}",
  "vscode.renderFailed": "渲染失败",

  "manifest.browserName": "Scribdown",
  "manifest.browserDescription": "手绘风格的 Markdown 渲染体验。",
  "manifest.vscodeDisplayName": "Scribdown Markdown 预览",
  "manifest.vscodeDescription": "VS Code 的手绘风格 Markdown 预览。",
  "manifest.vscodeCommandTitle": "打开 Scribdown 预览",
  "manifest.vscodeLanguageDescription": "选择 Scribdown 界面使用的语言。",
  "manifest.vscodeLanguageSystemDescription": "跟随 VS Code 显示语言。",
  "manifest.vscodeLanguageEnglishDescription": "使用英语。",
  "manifest.vscodeLanguageSimplifiedChineseDescription": "使用简体中文。"
};

/**
 * 语言 → 文案目录的总表。新增语言时在此登记对应目录。
 */
export const MESSAGES: Record<LocaleType, Messages> = {
  [LocaleType.English]: EN_MESSAGES,
  [LocaleType.SimplifiedChinese]: ZH_CN_MESSAGES
};
