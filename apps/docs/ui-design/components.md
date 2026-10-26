# 组件规范

本页定义公开视觉组件、共享文本流层和核心交互规格。整体设计入口见 [设计导览](./overview.md)，所有数值型 Token 见 [Token 系统](./tokens.md)。

## 职责模型

| 类型                  | 在本项目中的含义                     | 是否进入组件清单                 |
| --------------------- | ------------------------------------ | -------------------------------- |
| Block Component       | 直接承接块级节点或复杂媒体块         | 是                               |
| Mark Capability       | 承接行内标记的共享规则               | 否，不为每个 Mark 单独建视觉组件 |
| Inline Node Component | 承接复杂度较高的行内 / 嵌入式节点    | 视复杂度而定                     |
| Shell Component       | 承接状态、容器、全屏壳层等非语法能力 | 是                               |

## 共享文本流层

以下能力存在于实现层，但不要求在设计稿中作为独立视觉组件逐个出图。

| 能力             | 负责内容                               | 说明                                             |
| ---------------- | -------------------------------------- | ------------------------------------------------ |
| `InlineTextFlow` | 文本流拼接、软换行、转义、实体         | 负责把普通文本组织成稳定文本流                   |
| `InlineMarks`    | `emphasis`、`strong`、`delete`、`mark` | 统一行内标记样式，不拆成独立组件                 |
| `HardBreak`      | `break`                                | 作为共享文本流层中的换行节点处理，不单独出组件页 |

> `LinkRenderer` 和 `InlineCode` 仍保留为独立组件，因为它们具备明确的交互或独立视觉样式，需要单独验收。

## 组件分组总览

| 分组           | 组件                                                                                                         | 说明                               |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 壳层与状态     | `DocumentShell`、`LoadingSkeleton`、`StateRenderer`、`FullscreenViewer`                                      | 页面容器、状态页和全屏查看器       |
| 文本与列表     | `HeadingRenderer`、`ParagraphRenderer`、`ListRenderer`、`TaskListRenderer`、`Blockquote`、`HanddrawnDivider` | 正文、标题、列表、引用、分隔线     |
| 行内与轻交互   | `InlineCode`、`LinkRenderer`                                                                                 | 行内代码和链接交互                 |
| 富媒体与扩展块 | `CodeBlock`、`ImageRenderer`、`MermaidBlock`、`VideoRenderer`、`TableRenderer`、`HtmlRenderer`               | 代码、图片、图表、视频、表格、HTML |

当前公开视觉组件共 `18` 个，不含 `MarkdownRenderer` 与共享文本流层。

## 壳层与状态

### `DocumentShell`

- 背景使用 `--scribdown-color-bg`
- 正文文本列最大宽度 `840px`
- 左右内边距最少 `48px`
- 页面留白为顶部 `64px`、底部 `96px`
- 浅色主题可加入低噪声纸感纹理和轻量纸张外框；纹理只能作为背景层，不能降低正文、代码、表格的可读性

### `LoadingSkeleton`

- 结构：大标题占位块 → 段落三行组 → 代码块占位 → 段落两行组
- 骨架色使用 `--scribdown-color-border`
- 透明度在 `0.4`–`0.8` 脉冲过渡，周期 `1.4s`
- `prefers-reduced-motion` 开启时取消脉冲

### `StateRenderer`

| 变体          | 颜色                               | 说明                   |
| ------------- | ---------------------------------- | ---------------------- |
| `Empty`       | `--scribdown-color-text-secondary` | 无可渲染内容           |
| `Error`       | `--scribdown-color-danger`         | 渲染失败，展示错误摘要 |
| `Unsupported` | `--scribdown-color-warning`        | 语法或能力不支持       |

### `FullscreenViewer`

- 结构：`Overlay + TopBar + ContentStage`
- 遮罩：`rgba(45, 36, 31, 0.72)`
- 顶栏：内容标题（左）+ 类型标签（中）+ 关闭按钮（右）
- 内容区四周安全留白至少 `32px`
- 承载图片、`Mermaid`、视频时共用同一壳层

## 文本与列表

### `HeadingRenderer`

- 字体统一使用 `--scribdown-font-heading`
- 字号、行高、字重严格对应 Typography 规范
- 标题悬停时左侧出现低调 `#` 锚点图标
- 锚点入口使用 `absolute` 定位，不影响标题文本对齐
- h2 可使用短横线涂抹感底线强化章节分隔；底线颜色来自 `--scribdown-color-border` 或 `--scribdown-color-accent` 的低透明度派生值

### `ParagraphRenderer`

- 使用 `body-md`（`18px / 1.75`）
- 段间距 `--scribdown-space-5`
- 行内 `emphasis`、`strong`、`delete`、`mark`、`break` 由共享文本流层处理

### `ListRenderer`

- 有序与无序列表都支持三级嵌套
- 无序标记使用手绘圆点或短横，不使用标准浏览器 bullet
- 每级缩进 `24px`
- `ListItem` 行间距 `8px`

### `TaskListRenderer`

- 继承 `ListRenderer` 的缩进、间距与嵌套规则
- `Marker` 替换为手绘感方形复选框（`16px`）
- 已完成项使用 `delete` 样式并降为 `--scribdown-color-text-secondary`

### `Blockquote`

- 左侧强调线宽 `4px`
- 颜色使用 `--scribdown-color-accent`
- 内边距 `16px 20px`
- 背景使用 `--scribdown-color-surface`
- 可加入手绘引用符号作为弱装饰，装饰颜色必须低于正文权重

### `HanddrawnDivider`

- 不使用标准 `<hr>` 直线
- 颜色使用 `--scribdown-color-border`
- 上下留白 `--scribdown-space-5`

## 行内与轻交互

### `InlineCode`

- 内边距 `2px 6px`
- 字体使用 `--scribdown-font-code`
- 背景比正文背景深一层
- 字号使用 `inline-code`

### `LinkRenderer`

- 默认颜色 `--scribdown-color-accent`
- 区分 default / hover / visited / focus-visible 四态
- `focus-visible` 使用 `2px` 实线轮廓，偏移 `2px`
- `visited` 颜色略深于默认态

## 富媒体与扩展块

### `CodeBlock`

- 结构：`Header + ScrollArea`
- `Header` 高度 `40px`，内边距 `12px 16px`
- 复制按钮区分 default / hover / focus-visible / copied 四态
- 长代码行保留横向滚动，不折行
- 外观使用 `--scribdown-radius-md` 与 `--scribdown-shadow-md`
- 行号、语法高亮与行高亮需要同时可辨；行高亮使用浅色底，不使用高饱和整行色块

### `ImageRenderer`

- 默认宽度 `100%`，最大展示宽度 `720px`
- 需要同时支持加载态、正常态、失败态
- 失败态展示固定高占位与 `alt` 文本
- 右上角提供低存在感媒体操作入口，至少覆盖全屏查看
- caption 位于图片下方并居中，使用 `body-sm` 与 `--scribdown-color-text-secondary`

### `MermaidBlock`

- 结构：`Header + DiagramCanvas`
- `DiagramCanvas` 最小高度 `240px`
- 失败态展示错误摘要与源码入口
- 全屏入口含 `focus-visible` 态
- 正常态节点可使用柔和色块和手绘描边，箭头保持清晰方向；失败态使用语义色轻描边提示，避免呈现为原始报错堆栈

### `VideoRenderer`

- 默认 `16:9` 比例容器，最大宽 `720px`
- 未播放态展示封面与居中播放按钮
- 播放按钮 `focus-visible` 轮廓偏移 `3px`
- 全屏入口位置与 `ImageRenderer` 保持一致
- 播放控件可近似真实播放器的时间轴、音量和全屏入口布局，但视觉权重必须低于视频内容

### `TableRenderer`

- 结构：`TableWrapper + TableHead + TableBody`
- `TableWrapper` 必须支持横向滚动
- 表头通过字重、底色或描边形成层级差异
- 单元格内边距 `12px 16px`

### `HtmlRenderer`

- 块级与行内 HTML 共用 `rehype-sanitize + DOMPurify` 安全链路
- 白名单标签输出等效视觉效果，样式继承正文 Token
- 非白名单内容显示占位框，不暴露原始标签

## `focus-visible` 规格

| 元素                        | 轮廓规格                                                      |
| --------------------------- | ------------------------------------------------------------- |
| `LinkRenderer`              | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`       |
| `CodeBlock` 复制按钮        | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`       |
| `ImageRenderer` 全屏入口    | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`       |
| `MermaidBlock` 全屏入口     | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`       |
| `VideoRenderer` 播放按钮    | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `3px`       |
| `FullscreenViewer` 关闭按钮 | `2px` 实线，颜色 `--scribdown-color-text-primary`，偏移 `2px` |
| 标题锚点入口                | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`       |

## 提示块与容器

提示块通过共享渲染器输出，在浏览器扩展和 VS Code 中使用相同的手绘边框、语义色及明暗主题。标题与类型名称提供颜色之外的识别信息，普通引用保持原样。

- GitHub 提示：引用第一行使用 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]` 或 `[!CAUTION]`，后续引用行作为正文。
- 冒号容器：独立行使用 `::: tip` 开始，以 `:::` 结束；同时支持 `note`、`info`、`important`、`warning`、`caution`、`danger`。容器写在文档根级，嵌套时建议外层使用更多冒号。
- 自定义标题：提示标记或容器类型后加空格和纯文本标题；省略时显示对应类型的英文名称。
- 折叠内容：`::: details 标题` 转为原生 `<details>`，默认折叠，复用已有折叠块样式。

正文继续支持链接、列表、代码、表格和其他 Markdown 块，并保留源码行号。未知类型、未闭合容器、转义文本以及代码中的语法不转换；标题按纯文本转义，正文经过统一安全清洗。完整示例见[渲染预览](./render-preview)。

## 数学公式

公式由共享渲染器在安全清洗之后调用 KaTeX 排版，样式与字体随包提供，浏览器扩展和 VS Code Webview 均离线加载。

- 行内公式：`$…$`；开头 `$` 后与结尾 `$` 前不能是空白，结尾 `$` 后不能紧跟数字，因此 `$5 和 $10` 按普通文本显示。`\$` 转义与代码中的 `$` 不转换。
- 块级公式：独立行的 `$$ … $$`，或 GitHub 风格的 ` ```math ` 围栏；保留源码行号，右上角复制按钮复制公式原文。超宽公式在块内横向滚动。
- 选中公式复制时写入 TeX 原文，而不是排版后的字形。
- 解析失败：行内公式以危险色虚线显示原文，悬停查看错误原因；块级公式显示原文与错误提示，其余内容照常渲染。
- 安全边界：KaTeX 以 `trust: false` 运行，`\href`、`\url`、`\includegraphics`、`\htmlClass` 等命令不会生成链接、资源或自定义属性。
