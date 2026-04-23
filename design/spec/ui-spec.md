# UI 规范

## 文档用途

本文件作为 Scribdown 的主 UI 规范，回答以下问题：

- 这是一个什么产品，边界在哪里
- 页面和宿主层面应如何组织
- 视觉基础、Token、Typography 应如何统一
- Markdown 渲染语义应如何映射到 UI
- 状态、交互、无障碍和出图范围应如何定义

组件的结构细节、状态变体和验收口径统一放在 [component-spec.md](./component-spec.md)。

---

## 产品概览

Scribdown 是一个以**手绘风格**为核心视觉语言的 **Markdown 渲染器**。产品目标是把 Markdown 内容稳定、安全、可读地渲染到不同宿主环境中，包括浏览器插件与 VS Code 插件预览容器。

- **产品定位**：只做 Markdown 渲染，不做 Markdown 编辑
- **设计目标**：在保证阅读效率的前提下，以手绘线条、纸感纹理、低干扰动效构建差异化的 Markdown 阅读体验
- **目标用户**：有一定 Markdown 使用习惯的开发者、写作者、文档阅读者

---

## 产品边界

### In Scope

- Markdown 文档渲染
- Markdown 节点的视觉表达与交互反馈
- `Mermaid` 图表渲染与查看
- 浏览器插件与 VS Code 预览容器的统一渲染体验
- 主题、密度、字体等渲染层配置
- 安全渲染、异常状态、性能边界

### Out of Scope

- Markdown 编辑、所见即所得编辑器
- 光标、选区、输入法、撤销重做
- 协作编辑与评论
- 文档管理、同步、版本控制

> 设计、研发、测试都应以“渲染器”而非“编辑器”作为产品边界。

---

## 设计原则

| 原则 | 说明 |
| --- | --- |
| 可读性优先 | 装饰风格不能压过正文信息，正文、标题、代码、引用必须有稳定层级 |
| 手绘但克制 | 线条、圆角、阴影、纹理有手绘感，但不做高噪声、强抖动、重动画 |
| 结构清晰 | 长文档阅读时，章节层级、代码块、引用块、列表等结构应一眼可分 |
| 宿主一致 | 浏览器插件与 VS Code 预览容器共享同一渲染语言，只允许壳层行为差异 |
| 安全默认 | 原始 HTML、外链、图片等内容默认按安全策略处理 |

---

## 信息架构

```text
Scribdown
├── 应用壳层
│   ├── 工具区（复制、打开原文等，可选）
│   └── 文档容器
├── Markdown 渲染区
│   ├── Block Node
│   ├── Inline Mark / Inline Node
│   └── 扩展能力
└── 状态层
    ├── Loading
    ├── Empty
    ├── Error
    └── Unsupported
```

- 渲染区是主角，默认占据页面主要视觉面积；壳层控件不能长期抢占正文空间
- 工具区若存在，应弱化视觉权重，避免形成“应用后台”观感
- 长文档默认纵向滚动，不引入分页式阅读

---

## 关键场景

| 场景 | 目标 | 关键要求 |
| --- | --- | --- |
| 普通文档阅读 | 清晰展示正文与层级 | 标题、段落、列表、引用层级稳定 |
| 技术文档阅读 | 清晰展示代码与结构 | 代码块高亮可靠，长行可横向滚动 |
| 图文混排阅读 | 避免视觉拥堵 | 图片、标题、说明、列表有足够留白 |
| 图表与媒体查看 | 保证图表与媒体可读 | `Mermaid`、图片、视频支持放大查看 |
| 宿主嵌入预览 | 在受限容器中仍可阅读 | 支持窄宽度、滚动容器、宿主主题适配 |

---

## 多端适配

两端共用 `packages/markdown-renderer` 作为渲染核心；手绘视觉组件优先收敛到 `packages/ui-handdrawn`；宿主差异只体现在壳层与能力开关，不分叉正文渲染规则。

| 平台 | 约束 | 设计要求 |
| --- | --- | --- |
| 浏览器插件（Chrome / Edge / Firefox） | 宽度与背景受宿主页面影响 | 优先保证嵌入环境兼容性，避免强依赖固定画布尺寸 |
| VS Code 插件 | 受编辑器主题、滚动条与侧边宽度影响 | 深浅主题映射、窄栏阅读与宿主字体差异 |

---

## 视觉基础

### 视觉风格

| 维度 | 描述 |
| --- | --- |
| 线条 | 手绘笔触感，允许轻微不规则，不做明显抖动动画 |
| 背景 | 纸张纹理感，非纯白，可有轻量噪点或淡格纹 |
| 圆角与阴影 | 略带非机械感，避免标准化 SaaS 卡片视觉 |
| 颜色 | 低饱和度为主，强调色克制使用，避免大面积高对比撞色 |
| 字体 | 正文优先保证可读性，手写感更多体现在标题、装饰元素与局部强调 |

**动效策略**：仅用于增强层级感和状态切换；时长控制在 `120ms`–`240ms`；禁止循环吸引注意力的动画；`prefers-reduced-motion` 开启时关闭非必要过渡。

### 设计 Token

所有公开 CSS 变量统一使用 `--scribdown-` 前缀，避免与宿主环境或第三方样式发生命名冲突。

#### 浅色主题

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-color-bg` | `#F6F1E8` | 主背景，偏暖纸色 |
| `--scribdown-color-surface` | `#FFFDF8` | 卡片与内容块背景 |
| `--scribdown-color-text-primary` | `#2D241F` | 正文主文字 |
| `--scribdown-color-text-secondary` | `#6A5B53` | 辅助说明、次标题 |
| `--scribdown-color-accent` | `#2F6A5F` | 链接、重点强调 |
| `--scribdown-color-border` | `#CDBEAE` | 轻描边与分隔线 |
| `--scribdown-color-danger` | `#A94A3F` | 错误态 |
| `--scribdown-color-warning` | `#8B6B2E` | Unsupported 态 |
| `--scribdown-shadow-sm` | `2px 3px 0 rgba(45, 36, 31, 0.12)` | 轻浮起感 |
| `--scribdown-shadow-md` | `4px 6px 0 rgba(45, 36, 31, 0.16)` | 卡片与代码块 |

#### 暗色主题

> 暗色主题仅在宿主明确传入 `data-theme="dark"` 或 VS Code Webview 检测到深色编辑器主题时激活。字体、圆角、间距、过渡 Token 深浅主题共用，无需覆盖。

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-color-bg` | `#1E1A16` | 主背景，暗暖棕调 |
| `--scribdown-color-surface` | `#2A2420` | 卡片与内容块背景 |
| `--scribdown-color-text-primary` | `#E8DDD4` | 正文主文字 |
| `--scribdown-color-text-secondary` | `#9B8C82` | 辅助说明、次标题 |
| `--scribdown-color-accent` | `#5FBFAD` | 链接、重点强调（浅色以保证对比度） |
| `--scribdown-color-border` | `#3D3028` | 轻描边与分隔线 |
| `--scribdown-color-danger` | `#D4706A` | 错误态 |
| `--scribdown-color-warning` | `#C49A4A` | Unsupported 态 |
| `--scribdown-shadow-sm` | `2px 3px 0 rgba(0, 0, 0, 0.3)` | 轻浮起感 |
| `--scribdown-shadow-md` | `4px 6px 0 rgba(0, 0, 0, 0.4)` | 卡片与代码块 |

#### 字体、圆角、间距、动效

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-font-body` | `"Source Serif 4", "Noto Serif SC", serif` | 正文阅读字体 |
| `--scribdown-font-heading` | `"Caveat", "LXGW WenKai", "Noto Serif SC", serif` | 标题与局部强调字体 |
| `--scribdown-font-code` | `"JetBrains Mono", "Fira Code", monospace` | 代码字体 |
| `--scribdown-radius-sm` | `8px 10px 9px 11px` | 行内元素与轻组件 |
| `--scribdown-radius-md` | `14px 16px 13px 17px` | 卡片、引用块 |
| `--scribdown-radius-lg` | `22px 24px 20px 26px` | 容器级背景块 |
| `--scribdown-space-1` | `4px` | 最小间距 |
| `--scribdown-space-2` | `8px` | 细小间距 |
| `--scribdown-space-3` | `12px` | 紧凑组件间距 |
| `--scribdown-space-4` | `16px` | 默认组件内边距 |
| `--scribdown-space-5` | `24px` | 块级元素间距 |
| `--scribdown-space-6` | `32px` | 大块间距 |
| `--scribdown-space-7` | `48px` | 区域间距 |
| `--scribdown-space-8` | `64px` | 页面级留白 |
| `--scribdown-duration-fast` | `120ms` | 轻量反馈 |
| `--scribdown-duration-base` | `200ms` | 普通过渡 |
| `--scribdown-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认状态切换，匀速进出 |
| `--scribdown-easing-enter` | `cubic-bezier(0, 0, 0.2, 1)` | 元素进入，先快后慢 |
| `--scribdown-easing-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 元素退出，先慢后快 |

### Typography

| 样式 | 字号 | 行高 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| `body-md` | `18px` | `1.75` | `400` | 默认正文 |
| `body-sm` | `15px` | `1.6` | `400` | 次文本、说明 |
| `h1` | `44px` | `1.2` | `700` | 文档主标题 |
| `h2` | `32px` | `1.3` | `700` | 一级章节 |
| `h3` | `24px` | `1.35` | `600` | 二级章节 |
| `h4` | `20px` | `1.4` | `600` | 三级章节 |
| `h5` | `18px` | `1.5` | `600` | 四级章节（同正文字号，字重区分层级） |
| `h6` | `15px` | `1.5` | `600` | 五级章节（同次文本字号，字重区分层级） |
| `code-block` | `14px` | `1.7` | `500` | 代码块 |
| `inline-code` | `0.92em` | `inherit` | `500` | 行内代码 |

### 落地规则

| 类别 | 规则 |
| --- | --- |
| 间距 | 统一采用 4 的倍数体系，容器内边距优先使用 `16`、`24`、`32` |
| 字号 | 严格使用上表中已定义文本样式，不新增自由字号 |
| 圆角 | 允许轻微不规则感，但同层级组件只能使用同一组半径 |
| 阴影 | 以轻阴影或偏移感为主，不做厚重浮层投影 |
| 动效 | 所有交互过渡统一走 Token，不写散落 magic number |

---

## 渲染模型

本项目的渲染模型参考 Tiptap 的拆分方式，先区分语义，再决定是否需要独立视觉组件。

| 类型 | 含义 | 典型例子 | 在本项目中的落地方式 |
| --- | --- | --- | --- |
| Block Node | 独立占据文档结构层级的节点 | `paragraph`、`heading`、`blockquote`、`code` | 通常映射为独立块级组件 |
| Inline Mark | 附着在文本上的行内标记 | `strong`、`emphasis`、`delete`、`mark`、`link` | 由共享文本流层统一处理，不强制拆成独立视觉组件 |
| Inline / Embedded Node | 出现在文本流或内容流中的非 Mark 节点 | `break`、`image`、行内 `html` | 按节点处理；是否独立出组件取决于复杂度 |
| Shell Capability | 不直接对应 Markdown 语法，但承接状态或交互 | Loading、Fullscreen、状态页 | 由壳层组件负责，不属于 `mdast` 节点本身 |

### Block Node

| `mdast` 节点 | Markdown 语法 | 推荐承接 | 渲染要求 |
| --- | --- | --- | --- |
| `root` | 整篇文档 | `MarkdownRenderer` | AST 根节点，不直接渲染 |
| `paragraph` | `hello` | `ParagraphRenderer` | 正文行高稳定，段间距统一，不出现挤压感 |
| `heading` | `## Title` | `HeadingRenderer` | `depth` 对应 `h1` 到 `h6`，字号、字重、上下留白层级明显 |
| `thematicBreak` | `---` | `HanddrawnDivider` | 使用手绘风格分隔线，弱于标题、强于普通段落 |
| `blockquote` | `> quote` | `Blockquote` | 带手绘左边框或底纹，内部正文颜色略弱于主文本 |
| `list` / `listItem` | `- item`、`1. item` | `ListRenderer` / `TaskListRenderer` | 有序与无序样式区分明确，嵌套层级缩进稳定 |
| `code` | `` ```js `` | `CodeBlock` / `MermaidBlock` | 普通代码块使用 `CodeBlock`；`mermaid` 语言标记走 `MermaidBlock` |
| 块级 `html` | `<div>...</div>` | `HtmlRenderer` | 原始 HTML 块经 `rehype-sanitize + DOMPurify` 处理后再渲染 |
| `definition` | `[id]: /url` | 无独立渲染 | 仅供引用式链接与图片使用，不直接渲染 |
| 表格 | GFM Table | `TableRenderer` | 需提供横向滚动能力，不能撑破正文容器 |
| 视频 | 白名单 `<video>` | `VideoRenderer` | 支持封面、播放控制与全屏查看 |

### Inline Mark

| 类型 | Markdown 语法 | 默认承接 | 渲染要求 |
| --- | --- | --- | --- |
| `emphasis` | `*em*` | 共享文本流层 | 斜体或轻强调，不影响正文节奏 |
| `strong` | `**strong**` | 共享文本流层 | 粗体与正文形成清晰对比，但避免过黑 |
| `delete` | `~~del~~` | 共享文本流层 | 删除线，字色降至 `--scribdown-color-text-secondary`，线条使用 Token 颜色，不加粗 |
| `mark` | `==mark==` | 共享文本流层 | 低饱和暖黄底色，前景色保持正文对比，不盖过正文层级 |
| `link` | `[link](url)` | `LinkRenderer` + 共享文本流层 | 有明显可点击样式，`hover` / `focus` / `visited` 状态需区分 |

说明：

- `LinkRenderer` 虽然是独立命名组件，但它本质上承接的是 Mark 级交互能力
- `underline` 不作为独立 Markdown Mark 处理，而是通过白名单 HTML 路径进入 `HtmlRenderer`
- 删除线（`~~text~~`）与任务列表完成态共用同一 `delete` 样式规则

### Inline / Embedded Node

| 类型 | Markdown / HTML 语法 | 推荐承接 | 渲染要求 |
| --- | --- | --- | --- |
| `inlineCode` | `` `code` `` | `InlineCode` | 使用轻底色、描边或胶带感装饰，保证可复制和可辨识 |
| `break` | 行尾两空格或 `\` | 共享文本流层中的 `HardBreak` 处理 | 显式换行，不吞掉阅读节奏 |
| `image` | `![alt](a.png)` | `ImageRenderer` | 图片默认自适应容器宽度，失败时展示 `alt` 与异常占位 |
| 行内 `html` | `<span>x</span>`、`<u>x</u>` | `HtmlRenderer` | 与 HTML 块共用安全渲染链路 |
| 引用式链接/图片 | `[link][id]` | 复用最终节点 | 与普通链接、图片共用最终渲染逻辑 |
| 软换行、转义、实体 | `\*`、`&amp;` 等 | 文本流基础能力 | 解析后按文本流处理 |

---

## 状态与交互

### 通用状态

| 状态 | 展示要求 |
| --- | --- |
| Loading | 使用低干扰骨架占位块，模拟文档结构，避免闪烁；见 [component-spec.md](./component-spec.md) `LoadingSkeleton` |
| Empty | 明确告知“无可渲染内容”，可附带轻量引导 |
| Error | 明确告知渲染失败，并展示错误摘要或降级说明 |
| Unsupported | 当语法或宿主能力不支持时，给出稳定降级表现 |

### 关键交互

| 对象 | 交互要求 |
| --- | --- |
| 链接 | 支持 `hover`、`focus-visible`、外链安全策略、已访问态 |
| 代码块复制按钮 | 默认低存在感，悬停或聚焦后增强可见，复制成功有即时反馈 |
| `Mermaid` 图表 | 支持点击“全屏查看”，全屏态下优先展示完整图表与关闭入口 |
| 图片 | 支持加载中、加载失败、点击全屏查看原图或在新上下文打开 |
| 视频 | 支持封面、播放控制与全屏查看，退出全屏后保持播放进度 |
| 长代码行 / 宽表格 | 容器内部横向滚动，不能撑爆页面布局 |
| 标题锚点 | 如启用目录或深链，标题悬停时可显式暴露锚点入口 |

### 全屏查看规则

- `Mermaid`、图片、视频共用统一的全屏查看器壳层
- 全屏态使用居中的浮层或覆盖层，背景需压暗正文，但不使用纯黑遮罩
- 浮层顶部必须有关闭按钮、内容标题区和当前对象类型标识
- 图片全屏默认按比例适配视口，保留原始宽高比
- 视频全屏优先展示播放器本体与基础控制条，不叠加多余装饰
- `Mermaid` 全屏优先保证图表完整可见，必要时允许容器内二次缩放或平移
- 键盘 `Esc` 必须可退出全屏；关闭后回到原滚动位置

### 主题切换

- 主题由宿主通过 `data-theme="dark"` 属性注入，渲染器自身不提供主题切换控件
- VS Code 宿主通过检测 `body.vscode-dark` / `body.vscode-light` 类名自动映射，无需手动传参
- 切换时所有颜色 Token 通过 CSS 变量即时生效，无需重新渲染 DOM
- 切换过渡时长使用 `--scribdown-duration-base`（`200ms`），缓动 `--scribdown-easing-standard`
- `prefers-reduced-motion` 开启时取消过渡，直接切换
- 主题切换不重置滚动位置，不中断正在播放的视频

### `focus-visible` 规格

所有可交互元素必须在键盘聚焦时显示 `focus-visible` 轮廓，鼠标点击时不显示。

| 元素 | 轮廓规格 |
| --- | --- |
| `LinkRenderer` | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px` |
| `CodeBlock` 复制按钮 | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`；聚焦时按钮可见度同 hover 态 |
| `ImageRenderer` 全屏入口 | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px` |
| `MermaidBlock` 全屏入口 | 同上 |
| `VideoRenderer` 播放按钮 | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `3px`（圆形按钮外侧） |
| `FullscreenViewer` 关闭按钮 | `2px` 实线，颜色 `--scribdown-color-text-primary`，偏移 `2px` |
| 标题锚点入口 | `2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px` |

### 滚动还原

- 进入全屏查看时，记录当前文档滚动位置（`scrollTop`）
- 关闭全屏后，恢复到进入前的 `scrollTop`，不使用浏览器默认的页面跳转行为
- 若全屏内容支持二次缩放或平移（如 `Mermaid`），关闭后只还原文档滚动位置，不还原全屏内部的缩放状态

### 无障碍最低要求

- 正文与背景颜色对比满足基本可读性
- 所有可交互元素具备 `focus-visible` 状态
- 图片保留 `alt` 信息
- 代码块复制按钮、外链图标等附加功能具备可读标签
- 全屏查看器的关闭按钮、上一状态返回动作具备明确可读标签

---

## 性能与安全

### 性能

- 长文档渲染不能因装饰性效果显著拖慢首屏
- 纹理、噪点、阴影等装饰必须控制层数与绘制成本
- 大图需要限制最大显示宽度，避免布局抖动

### 安全

- 原始 HTML 必须经过白名单清洗后再注入
- 外链需带明确安全策略
- 不可信资源加载失败时应稳定降级，不能破坏主内容流

---

## 出图范围

| 画板 | 画布尺寸 | 内容区宽度 | 用途 |
| --- | --- | --- | --- |
| Browser Preview / Default | `1440 × 1080` | `960px` | 浏览器插件默认渲染页，可见纸感背景 |
| Browser Preview / Long Content | `1440 × 1600` | `960px` | 长文档、长代码块场景 |
| VS Code Preview / Default | `1280 × 960` | `860px` | VS Code Webview 默认渲染页，背景更克制 |
| VS Code Preview / Narrow | `960 × 960` | `680px` | 窄栏阅读，检查标题、代码块、表格在窄宽度下的表现 |
| State / Loading | `1280 × 720` | — | 骨架屏 Loading 状态 |
| State / Empty | `1280 × 720` | — | 空内容状态 |
| State / Error | `1280 × 720` | — | 渲染失败状态 |
| State / Unsupported | `1280 × 720` | — | 不支持语法或能力受限 |
| Components / Core Blocks | `1600 × 1200` | — | 核心组件拆解与样式对照 |
| Fullscreen Viewer | `1440 × 960` | — | `Mermaid`、图片、视频的全屏查看规则 |

### 画板约束

- 所有画板统一使用桌面端视角，不额外产出移动端版本
- Browser 与 VS Code 画板共用正文渲染语言，只允许壳层样式不同
- 每个主画板都必须包含标题、段落、列表、引用、代码块、链接、行内代码、图片至少 8 类元素中的 6 类
- `State` 画板只展示状态内容，不混入完整正文
- `Components / Core Blocks` 画板必须包含 `Mermaid`、图片全屏、视频全屏 3 类交互示例

### 出图判定标准

- 是否严格遵守“只做渲染，不做编辑”的产品边界
- 是否使用统一的 `--scribdown-*` Token 命名和具体值
- 是否同时体现纸感、手绘感与可读性，而不是只剩装饰
- 是否在 Browser 与 VS Code 两类宿主中保持同一视觉语言
- 是否能从标准 Markdown 样例中稳定抽取内容并完成高保真布局
- 是否把 `Mermaid`、图片、视频的全屏放大交互设计完整表达出来
- 是否覆盖 `focus-visible` 态（键盘可访问性）
