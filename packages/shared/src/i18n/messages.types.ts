/**
 * Scribdown 文案目录的结构契约。
 * 每个受支持语言都必须提供 {@link Messages} 的全部 key（由 Record 类型在编译期约束缺漏），
 * 保证跨语言 key 对齐；带 `{name}` 的值表示运行时插值占位。
 */

/**
 * 全量文案 key → 文案字符串的映射结构。
 * key 采用 `<面>.<语义>` 命名，便于按面归组与静态文件生成。
 */
export interface Messages {
  // ─── 共享浮动工具栏（packages/markdown-renderer/toolbar.ts）───
  /** 工具栏「目录」按钮 / 目录侧栏标题。 */
  "toolbar.toc": string;
  /** 目录侧栏右上角关闭按钮 aria-label。 */
  "toolbar.tocClose": string;
  /** 目录为空时的占位文案。 */
  "toolbar.tocEmpty": string;
  /** 目录侧栏右侧拖拽调宽手柄的 aria-label。 */
  "toolbar.tocResize": string;
  /** 工具栏「更多」按钮。 */
  "toolbar.more": string;
  /** 「更多」菜单内「页面宽度」触发行文案。 */
  "toolbar.pageWidth": string;
  /** 「更多」菜单内「回到顶部」项。 */
  "toolbar.backTop": string;
  /** 「更多」菜单内「语言」切换触发行。 */
  "toolbar.language": string;
  /** 语言切换列表中的跟随系统选项。 */
  "toolbar.languageSystem": string;
  /** 语言切换列表中的英文选项。 */
  "toolbar.languageEnglish": string;
  /** 语言切换列表中的简体中文选项。 */
  "toolbar.languageSimplifiedChinese": string;
  /** 语言切换列表中的繁体中文选项。 */
  "toolbar.languageTraditionalChinese": string;
  /** 语言切换列表中的日语选项。 */
  "toolbar.languageJapanese": string;
  /** 语言切换列表中的韩语选项。 */
  "toolbar.languageKorean": string;
  /** 语言切换列表中的西班牙语选项。 */
  "toolbar.languageSpanish": string;
  /** 语言切换列表中的法语选项。 */
  "toolbar.languageFrench": string;
  /** 语言切换列表中的德语选项。 */
  "toolbar.languageGerman": string;
  /** 语言切换列表中的巴西葡萄牙语选项。 */
  "toolbar.languageBrazilianPortuguese": string;
  /** 语言切换列表中的俄语选项。 */
  "toolbar.languageRussian": string;
  /** 「更多」菜单内「关于」项。 */
  "toolbar.about": string;

  // ─── 代码块 chrome（code/code-block-chrome.ts）───
  /** 代码块复制按钮 aria-label（默认态）。 */
  "code.copy": string;
  /** 代码块复制按钮 aria-label（已复制态）。 */
  "code.copied": string;

  // ─── 通用内容复制按钮（core/copy-control.ts）───
  /** 通用内容复制按钮 aria-label。 */
  "content.copy": string;
  /** 通用内容复制成功态 aria-label。 */
  "content.copied": string;

  // ─── Mermaid 图表与全屏查看器（code/mermaid.ts、code/mermaid-viewer.ts）───
  /** Mermaid 渲染失败占位文案。 */
  "mermaid.renderFailed": string;
  /** Mermaid 代码块上的「全屏查看」按钮 aria-label。 */
  "mermaid.fullscreenButton": string;
  /** Mermaid 全屏查看对话框 aria-label。 */
  "mermaid.fullscreen": string;
  /** Mermaid 全屏查看器放大按钮 aria-label。 */
  "mermaid.zoomIn": string;
  /** Mermaid 全屏查看器缩小按钮 aria-label。 */
  "mermaid.zoomOut": string;
  /** Mermaid 全屏查看器重置缩放按钮 aria-label。 */
  "mermaid.zoomReset": string;
  /** Mermaid 非全屏缩放按钮组 aria-label。 */
  "mermaid.zoomControls": string;
  /** Mermaid 非全屏切换到拖拽模式按钮 aria-label。 */
  "mermaid.switchToDrag": string;
  /** Mermaid 非全屏切换到选择模式按钮 aria-label。 */
  "mermaid.switchToSelect": string;
  /** Mermaid 全屏查看器关闭按钮 aria-label。 */
  "mermaid.close": string;

  // ─── 表格交互（syntax/tables.ts）───
  /** 表格复制按钮 aria-label。 */
  "table.copy": string;

  // ─── 图片查看器（media/images.ts、media/image-viewer.ts）───
  /** 图片查看器无标题时的兜底 aria-label。 */
  "image.viewFull": string;
  /** 图片查看器带标题时的 aria-label（插值：{alt} 图片标题）。 */
  "image.viewFullOf": string;
  /** 图片加载失败占位文案。 */
  "image.loadFailed": string;
  /** 图片查看器快捷键提示文本。 */
  "image.hint": string;
  /** 图片查看器放大按钮 aria-label。 */
  "image.zoomIn": string;
  /** 图片查看器缩小按钮 aria-label。 */
  "image.zoomOut": string;
  /** 图片查看器重置缩放按钮 aria-label。 */
  "image.zoomReset": string;
  /** 图片查看器缩放按钮组 aria-label。 */
  "image.zoomControls": string;
  /** 图片查看器关闭按钮 aria-label。 */
  "image.close": string;

  // ─── 视频（media/videos.ts）───
  /** 视频加载失败占位文案。 */
  "video.loadFailed": string;

  // ─── 内联目录 [TOC]（syntax/toc.ts）───
  /** 内联目录容器 aria-label / summary 文案。 */
  "toc.label": string;
  /** 内联目录子项折叠切换按钮 aria-label。 */
  "toc.toggle": string;

  // ─── Frontmatter 元数据块（syntax/frontmatter.ts）───
  /** Frontmatter 折叠块标题。 */
  "frontmatter.label": string;

  // ─── 浏览器 popup（apps/browser-extension/popup/Popup.tsx）───
  /** 顶部启用开关 aria-label。 */
  "popup.enableAria": string;
  /** 顶部启用开关 title（已启用）。 */
  "popup.enabledTitle": string;
  /** 顶部启用开关 title（已关闭）。 */
  "popup.disabledTitle": string;
  /** 扩展关闭时的空态提示。 */
  "popup.disabledEmpty": string;
  /** 「允许访问文件网址」未开启横幅标题。 */
  "popup.fileAccessBannerTitle": string;
  /** 「允许访问文件网址」未开启横幅说明。 */
  "popup.fileAccessBannerText": string;
  /** 横幅「去开启」按钮文案。 */
  "popup.fileAccessAction": string;
  /** 横幅「去开启」按钮 aria-label。 */
  "popup.fileAccessActionAria": string;
  /** 自动刷新设置分组 aria-label。 */
  "popup.autoRefreshGroupAria": string;
  /** 自动刷新开关标签。 */
  "popup.autoRefreshLabel": string;
  /** 自动刷新说明按钮 aria-label。 */
  "popup.autoRefreshInfoAria": string;
  /** 自动刷新开启态说明气泡（插值：{seconds} 刷新间隔秒数）。 */
  "popup.autoRefreshOnTip": string;
  /** 自动刷新关闭态说明气泡。 */
  "popup.autoRefreshOffTip": string;
  /** 刷新间隔输入项标签。 */
  "popup.intervalLabel": string;
  /** 刷新间隔说明按钮 aria-label。 */
  "popup.intervalInfoAria": string;
  /** 刷新间隔取值范围气泡（插值：{min} 最小值、{max} 最大值）。 */
  "popup.intervalRangeTip": string;
  /** 刷新间隔单位（秒）。 */
  "popup.intervalUnit": string;
  /** 切换后保存成功提示。 */
  "popup.savedTip": string;

  // ─── 浏览器后台（apps/browser-extension/background/service-worker.ts）───
  /** 扩展关闭时的浏览器工具栏图标 title。 */
  "browser.disabledTitle": string;
  /** 未开启「允许访问文件网址」时的工具栏图标 title。 */
  "browser.fileAccessNeededTitle": string;

  // ─── 浏览器 viewer 错误页（apps/browser-extension/viewer/*.ts）───
  /** 渲染失败错误页标题。 */
  "viewer.errorHeading": string;
  /** 「查看原始链接」跳转文案。 */
  "viewer.viewRawLink": string;
  /** 禁止在 iframe 中加载的错误。 */
  "viewer.errorIframe": string;
  /** 缺少 src 参数的错误。 */
  "viewer.errorMissingSrc": string;
  /** 请求失败错误（插值：{message} 错误信息）。 */
  "viewer.errorRequestFailed": string;
  /** 响应非 Markdown 类型的错误（插值：{contentType} 响应内容类型）。 */
  "viewer.errorNotMarkdown": string;
  /** Content-Type 未声明时的占位词，用于填充 {contentType}。 */
  "viewer.contentTypeUndeclared": string;
  /** 文件内容为空的错误。 */
  "viewer.errorEmpty": string;
  /** 不支持的协议错误（插值：{protocol} 协议名）。 */
  "viewer.errorUnsupportedProtocol": string;
  /** src 非合法 URL 的错误。 */
  "viewer.errorInvalidUrl": string;

  // ─── VS Code 宿主（apps/vscode-extension/extension.ts）───
  /** 无激活 Markdown 文档时的警告。 */
  "vscode.noMarkdownWarning": string;
  /** 无法打开链接的警告（插值：{href} 链接地址）。 */
  "vscode.openLinkFailed": string;
  /** 链接目标不存在的警告（插值：{path} 目标路径）。 */
  "vscode.linkTargetMissing": string;
  /** 预览渲染失败标题。 */
  "vscode.renderFailed": string;

  // ─── 静态清单（Chrome _locales、VS Code package.nls，由 sync 脚本生成）───
  /** 浏览器扩展商店展示名称。 */
  "manifest.browserName": string;
  /** 浏览器扩展商店描述。 */
  "manifest.browserDescription": string;
  /** VS Code 扩展展示名称（displayName）。 */
  "manifest.vscodeDisplayName": string;
  /** VS Code 扩展描述（description）。 */
  "manifest.vscodeDescription": string;
  /** VS Code「打开预览」命令标题。 */
  "manifest.vscodeCommandTitle": string;
  /** VS Code 界面语言设置的说明。 */
  "manifest.vscodeLanguageDescription": string;
  /** VS Code 界面语言设置中「跟随系统」选项的说明。 */
  "manifest.vscodeLanguageSystemDescription": string;
  /** VS Code 界面语言设置中英语选项的说明。 */
  "manifest.vscodeLanguageEnglishDescription": string;
  /** VS Code 界面语言设置中简体中文选项的说明。 */
  "manifest.vscodeLanguageSimplifiedChineseDescription": string;
  /** VS Code 界面语言设置中繁体中文选项的说明。 */
  "manifest.vscodeLanguageTraditionalChineseDescription": string;
  /** VS Code 界面语言设置中日语选项的说明。 */
  "manifest.vscodeLanguageJapaneseDescription": string;
  /** VS Code 界面语言设置中韩语选项的说明。 */
  "manifest.vscodeLanguageKoreanDescription": string;
  /** VS Code 界面语言设置中西班牙语选项的说明。 */
  "manifest.vscodeLanguageSpanishDescription": string;
  /** VS Code 界面语言设置中法语选项的说明。 */
  "manifest.vscodeLanguageFrenchDescription": string;
  /** VS Code 界面语言设置中德语选项的说明。 */
  "manifest.vscodeLanguageGermanDescription": string;
  /** VS Code 界面语言设置中巴西葡萄牙语选项的说明。 */
  "manifest.vscodeLanguageBrazilianPortugueseDescription": string;
  /** VS Code 界面语言设置中俄语选项的说明。 */
  "manifest.vscodeLanguageRussianDescription": string;
}

/**
 * 文案 key 联合类型，供 `t()` 与 `createTranslator()` 约束调用方只能取已声明的 key。
 */
export type MessageKey = keyof Messages;
