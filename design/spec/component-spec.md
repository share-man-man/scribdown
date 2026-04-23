# 核心组件

## 文档用途

本文件回答三个问题：

- 渲染器一共有哪些公开视觉组件
- 哪些能力是共享渲染层，不需要单独暴露为视觉组件
- 每个组件最关键的结构、尺寸和状态要求是什么

`MarkdownRenderer` 只负责根据语义分发到对应节点能力，自身无视觉输出，不计入设计稿组件清单。

---

## 职责模型

本文件采用与 [ui-spec.md](./ui-spec.md) 一致的职责划分。

| 类型 | 在本项目中的含义 | 是否进入组件清单 |
| --- | --- | --- |
| Block Component | 直接承接块级节点或复杂媒体块 | 是 |
| Mark Capability | 承接行内标记的共享规则 | 否，不为每个 Mark 单独建视觉组件 |
| Inline Node Component | 承接复杂度较高的行内 / 嵌入式节点 | 视复杂度而定 |
| Shell Component | 承接状态、容器、全屏壳层等非语法能力 | 是 |

原则：

- 简单行内标记优先由共享文本流层统一处理
- 带独立布局、媒体容器或复杂交互的能力，再拆成独立组件
- 文档中的“组件清单”只列需要在设计稿中单独出现、可复用、可验收的视觉组件

---

## 共享文本流层

以下能力存在于实现层，但不要求在设计稿中作为独立视觉组件逐个出图。

| 能力 | 负责内容 | 说明 |
| --- | --- | --- |
| `InlineTextFlow` | 文本流拼接、软换行、转义、实体 | 负责把普通文本组织成稳定文本流 |
| `InlineMarks` | `emphasis`、`strong`、`delete`、`mark` | 统一行内标记样式，不拆成独立组件 |
| `HardBreak` | `break` | 作为共享文本流层中的换行节点处理，不单独出组件页 |

> `LinkRenderer` 和 `InlineCode` 仍保留为独立组件，因为它们具备明确的交互或独立视觉样式，需要单独验收。

---

## 组件分组总览

| 分组 | 组件 | 说明 |
| --- | --- | --- |
| 壳层与状态 | `DocumentShell`、`LoadingSkeleton`、`StateRenderer`、`FullscreenViewer` | 页面容器、状态页和全屏查看器 |
| 文本与列表 | `HeadingRenderer`、`ParagraphRenderer`、`ListRenderer`、`TaskListRenderer`、`Blockquote`、`HanddrawnDivider` | 正文、标题、列表、引用、分隔线 |
| 行内与轻交互 | `InlineCode`、`LinkRenderer` | 行内代码和链接交互 |
| 富媒体与扩展块 | `CodeBlock`、`ImageRenderer`、`MermaidBlock`、`VideoRenderer`、`TableRenderer`、`HtmlRenderer` | 代码、图片、图表、视频、表格、HTML |

当前公开视觉组件共 `18` 个，不含 `MarkdownRenderer` 与共享文本流层。

---

## 壳层与状态

### `DocumentShell`

| 项 | 规格 |
| --- | --- |
| 角色 | 渲染容器、页面宽度、背景、滚动与壳层布局 |
| 背景 | 使用 `--scribdown-color-bg` |
| 宽度 | 正文文本列最大宽度 `840px`，不含左右内边距 |
| 内边距 | 左右内边距最少 `48px`；容器宽度不足 `936px` 时，文本列随容器收缩，内边距保持最低值 |
| 页面留白 | 顶部 `64px`，底部 `96px` |

### `LoadingSkeleton`

| 项 | 规格 |
| --- | --- |
| 角色 | 全文档骨架屏占位，Loading 状态下模拟文档结构 |
| 结构 | 大标题占位块 → 段落三行组 → 代码块占位 → 段落两行组，循环到内容高度填满 |
| 标题占位 | 宽 `60%`，高 `28px`，圆角 `--scribdown-radius-sm` |
| 段落占位 | 宽依次为 `100% / 96% / 72%`，高 `16px`，行间距 `10px` |
| 代码块占位 | 宽 `100%`，高 `96px` |
| 动效 | 骨架色使用 `--scribdown-color-border`，透明度在 `0.4`–`0.8` 脉冲过渡，周期 `1.4s`，缓动 `ease-in-out` |
| 降级 | `prefers-reduced-motion` 开启时取消脉冲，保持静态骨架色 |
| 备注 | 所有占位块统一使用 `--scribdown-radius-sm`，保留正文区左右内边距 |

### `StateRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | `Empty` / `Error` / `Unsupported` 三种状态的统一展示容器 |
| 结构 | `Icon + Title + Description`，垂直居中于容器 |
| 尺寸 | 图标 `48px`；标题使用 `h3`；描述使用 `body-sm` |
| `Empty` | 中性色图标，标题「无可渲染内容」，可附轻量引导文案，颜色使用 `--scribdown-color-text-secondary` |
| `Error` | 图标与标题颜色使用 `--scribdown-color-danger`，展示错误摘要 |
| `Unsupported` | 图标与标题颜色使用 `--scribdown-color-warning`，说明语法或能力限制 |
| 约束 | 不混入任何正文渲染内容 |

### `FullscreenViewer`

| 项 | 规格 |
| --- | --- |
| 角色 | 承载 `Mermaid`、图片、视频的统一全屏浮层 |
| 结构 | `Overlay + TopBar + ContentStage` |
| 遮罩 | `rgba(45, 36, 31, 0.72)` |
| 顶栏 | 内容标题（左）+ 类型标签（中）+ 关闭按钮（右），关闭按钮含 `focus-visible` 态 |
| 内容区 | 居中展示被放大的对象，四周安全留白至少 `32px`，浮层圆角 `--scribdown-radius-lg` |
| 变体 | 承载图片 / 承载 `Mermaid` / 承载视频，`TopBar` 结构相同，内容随类型变化 |

---

## 文本与列表

### `HeadingRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | h1–h6 标题渲染，含字号层级、标题字体、上下留白与锚点入口 |
| 字体 | 统一使用 `--scribdown-font-heading`（`Caveat` / `LXGW WenKai`） |
| 字号体系 | 严格对应 [ui-spec.md](./ui-spec.md) Typography 表中的 `h1`–`h6` |
| 上间距 | `h1` → `--scribdown-space-8`；`h2` → `--scribdown-space-7`；`h3`–`h6` → `--scribdown-space-5` |
| 下间距 | 统一为 `--scribdown-space-4` |
| 锚点入口 | 标题悬停时在左侧低调出现 `#` 图标，颜色 `--scribdown-color-text-secondary`，`focus-visible` 规格与 `LinkRenderer` 一致 |
| 布局要求 | 锚点入口使用 `absolute` 定位，不影响标题文本对齐 |

### `ParagraphRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 正文段落渲染，负责正文文字节奏与基础留白 |
| 字体 | 使用 `--scribdown-font-body` |
| 字号 / 行高 | 对应 `body-md`（`18px / 1.75`） |
| 段间距 | `--scribdown-space-5`（`24px`） |
| 行内规则 | `emphasis`、`strong`、`delete`、`mark`、`break` 由共享文本流层处理；链接与行内代码分别接入 `LinkRenderer`、`InlineCode` |

### `ListRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 有序、无序列表渲染，含多级嵌套缩进与列表标记样式 |
| 结构 | `List + ListItem + Marker + Content` |
| 无序标记 | 使用手绘圆点或短划线，不使用标准浏览器 bullet，颜色 `--scribdown-color-text-secondary` |
| 有序标记 | 使用等宽数字，与正文基线对齐 |
| 嵌套 | 每级缩进 `--scribdown-space-5`（`24px`），最大支持三级 |
| 三级标记 | 无序列表标记形状随层级递减（实心 → 空心 → 短横） |
| 间距 | `ListItem` 行间距 `--scribdown-space-2`（`8px`），列表块与前后段落间距 `--scribdown-space-5` |

### `TaskListRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 任务列表渲染，继承 `ListRenderer` 结构并扩展完成态展示 |
| 继承关系 | 继承 `ListRenderer` 的缩进、间距与嵌套规则 |
| 标记 | `Marker` 替换为 `CheckboxIndicator` |
| 复选框 | 手绘感方形复选框（`16px`），已完成态内有手绘勾，不提供点击交互 |
| 完成态 | 使用 `delete` 样式并将颜色降至 `--scribdown-color-text-secondary`，不降低 `opacity` |
| 备注 | 多级任务列表缩进与普通列表保持一致，视觉上可区分 |

### `Blockquote`

| 项 | 规格 |
| --- | --- |
| 角色 | 引用块的边框、背景与排版 |
| 强调线 | 左侧强调线宽度 `4px`，颜色 `--scribdown-color-accent` |
| 内边距 | `16px 20px` |
| 颜色 | 背景 `--scribdown-color-surface`，正文 `--scribdown-color-text-secondary` |
| 底纹 | 不启用额外纹理；手绘感通过左侧强调线的轻微不规则笔触表达，背景保持平色 |

### `HanddrawnDivider`

| 项 | 规格 |
| --- | --- |
| 角色 | 分隔线的手绘化表达 |
| 视觉权重 | 介于标题与段落之间 |
| 颜色 | `--scribdown-color-border` |
| 留白 | 上下留白 `--scribdown-space-5` |
| 约束 | 不使用标准 `<hr>` 直线，允许轻微不规则笔触 |

---

## 行内与轻交互

### `InlineCode`

| 项 | 规格 |
| --- | --- |
| 角色 | 行内代码的底色、描边与文本样式 |
| 内边距 | `2px 6px` |
| 背景 | 比正文背景深一层，不接近代码块重量 |
| 对齐 | 与正文基线对齐，不允许显著跳高 |
| 字体 | `--scribdown-font-code` |
| 字号 | `inline-code`（`0.92em`） |

### `LinkRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 统一处理内链、外链、安全属性与交互反馈 |
| 默认颜色 | `--scribdown-color-accent` |
| 悬停态 | 手绘下划线或轻微背景笔刷 |
| 外链增强 | 可选附加跳转图标，图标权重弱于正文 |
| `focus-visible` | `2px` 实线轮廓，颜色 `--scribdown-color-accent`，偏移 `2px` |
| `visited` | 颜色略深于默认态 |

---

## 富媒体与扩展块

### `CodeBlock`

| 项 | 规格 |
| --- | --- |
| 角色 | 代码块高亮、语言标签、行高亮、复制反馈、横向滚动 |
| 结构 | `Header + ScrollArea` |
| `Header` | 语言标签（左）+ 复制按钮（右），高度 `40px`，内边距 `12px 16px` |
| 按钮状态 | 复制按钮区分 default / hover / focus-visible / copied 四态 |
| `ScrollArea` | 背景 `--scribdown-color-surface`，内边距 `16px`；长代码行保留横向滚动，不折行 |
| 行高亮 | 通过围栏元信息（如 `{1,3-5}`）指定，高亮行用 `--scribdown-color-border` 约 `0.3` 透明度底色，非高亮行不降低对比度 |
| 外观 | 圆角 `--scribdown-radius-md`，阴影 `--scribdown-shadow-md` |

### `ImageRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 图片渲染、加载态、失败态与媒体操作入口 |
| 尺寸 | 默认宽度 `100%`，最大展示宽度 `720px` |
| 加载态 | 在图片未完成加载前展示稳定占位，避免布局抖动 |
| 说明文 | 下方允许出现 `caption`，使用 `body-sm`，颜色 `--scribdown-color-text-secondary` |
| 失败态 | 保留固定高度占位，展示 `alt` 文本，占位框使用 `--scribdown-color-surface` 背景 + `--scribdown-color-border` 描边 |
| 交互 | 右上角提供低存在感媒体操作入口；至少覆盖「全屏查看」，可选支持「在新上下文打开」；入口含 `focus-visible` 态 |

### `MermaidBlock`

| 项 | 规格 |
| --- | --- |
| 角色 | `Mermaid` 图表渲染、错误态与全屏查看入口 |
| 结构 | `Header + DiagramCanvas`，失败时替换为 `ErrorState` |
| `Header` | 图表类型标签（左）+ 全屏查看入口（右），含 `focus-visible` 态 |
| `DiagramCanvas` | 最小高度 `240px`，内容水平居中，四周内边距 `24px`，背景 `--scribdown-color-surface`，圆角 `--scribdown-radius-md` |
| 错误态 | 展示错误摘要 + 查看原始源码入口 |

### `VideoRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 视频容器渲染、封面、播放控制与全屏查看 |
| 结构 | `Poster + PlayButton + PlayerSurface + FullscreenTrigger` |
| 比例 | 默认 `16:9` 比例容器，最大展示宽度 `720px` |
| 未播放态 | 展示封面，播放按钮居中，`focus-visible` 轮廓偏移 `3px` |
| 播放态 | 展示播放器本体与基础控制条 |
| 全屏行为 | 退出全屏后保持播放进度 |
| 全屏入口 | 位置与 `ImageRenderer` 保持一致 |

### `TableRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 表格渲染、横向滚动与表头层级表达 |
| 结构 | `TableWrapper + TableHead + TableBody` |
| 滚动 | `TableWrapper` 必须支持横向滚动，避免撑破正文容器 |
| 层级 | 表头与正文至少通过字重、底色或描边形成层级差异 |
| 尺寸 | 单元格内边距 `12px 16px`，整体圆角 `--scribdown-radius-md` |

### `HtmlRenderer`

| 项 | 规格 |
| --- | --- |
| 角色 | 经白名单清洗后的 HTML 块级与行内内容渲染，含降级占位 |
| 安全链路 | 块级与行内 HTML 共用 `rehype-sanitize + DOMPurify` |
| 正常态 | 白名单标签输出等效视觉效果，样式继承正文 Token |
| 降级态 | 非白名单内容显示占位框：`--scribdown-color-surface` 背景 + `--scribdown-color-border` 描边 + `--scribdown-radius-sm` 圆角，内含简短说明，不暴露原始标签 |
