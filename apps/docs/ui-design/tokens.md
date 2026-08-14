# Token 系统

所有公开 CSS 变量统一使用 `--scribdown-` 前缀，避免与宿主环境或第三方样式发生命名冲突。整体设计入口见 [设计导览](./overview.md)，组件消费方式见 [组件规范](./components.md)。

> Token 的唯一来源是 `packages/ui-handdrawn/src/styles/tokens.css`，本页只做说明。改 Token 一律改那个文件，不要在应用层重新定义色值。

## 主题机制

Token 分两层：

- **调色板层** `--scribdown-palette-light-*` / `--scribdown-palette-dark-*`：两套主题的原始值，各定义一次。
- **语义层** `--scribdown-color-*` 等：组件实际消费的变量，只做 `var()` 映射，不直接写色值。

主题切换即切换语义层指向哪套调色板，优先级从低到高：

| 场景 | 触发方式 | 生效规则 |
| --- | --- | --- |
| 默认 | 无需处理 | 浅色 |
| 跟随系统 | 系统开启深色 | `@media (prefers-color-scheme: dark)` 切到暗色 |
| 宿主强制 | 根元素加 `scribdown-theme-dark` / `scribdown-theme-light` | 覆盖系统偏好 |

强制主题的两个 class 名在 `@scribdown/shared` 中以 `SCRIBDOWN_THEME_DARK_CLASS_NAME` / `SCRIBDOWN_THEME_LIGHT_CLASS_NAME` 导出，宿主应引用常量而非硬编码字符串。文档站的明暗按钮就是通过它接上的。

调色板层仅供 Token 内部映射使用，组件请消费语义层变量。

## 颜色

| Token | 浅色 | 暗色 | 说明 |
| --- | --- | --- | --- |
| `--scribdown-color-bg` | `#ebe1c8` | `#1e1915` | 主背景，暖纸色 / 夜间暖褐近黑 |
| `--scribdown-color-surface` | `#f8f0db` | `#2a241f` | 卡片与内容块背景 |
| `--scribdown-color-text-primary` | `#2f2620` | `#ebdfcc` | 正文主文字 |
| `--scribdown-color-text-secondary` | `#786758` | `#ae9b85` | 辅助说明、次标题 |
| `--scribdown-color-accent` | `#436b5b` | `#7ebbab` | 主题强调色，重点与交互态 |
| `--scribdown-color-link` | `#355a7d` | `#94b8de` | 链接 |
| `--scribdown-color-link-visited` | `#6a527b` | `#b39bcd` | 链接 visited 态 |
| `--scribdown-color-mark` | `#d7ab48` | `#d3aa57` | `<mark>` 高亮背景色 |
| `--scribdown-color-border` | `#c5ad8a` | `#5a4a39` | 轻描边与分隔线 |
| `--scribdown-color-danger` | `#a8504a` | `#db847a` | 错误态 |
| `--scribdown-color-warning` | `#8d6432` | `#d3a45f` | Unsupported 态 |
| `--scribdown-color-code-ink` | `#5e5483` | `#beacdc` | 代码块墨色，与正文文字色区分 |

引用块的四个颜色由上表派生，两套主题的配比不同：

| Token | 浅色配比 | 暗色配比 |
| --- | --- | --- |
| `--scribdown-color-blockquote-bg` | `border` 18% + `surface` | `border` 28% + `surface` |
| `--scribdown-color-blockquote-text` | `text-secondary` 88% + `surface` | `text-secondary` 90% + `bg` |
| `--scribdown-color-blockquote-link` | `link` 86% + `text-primary` | `link` 88% + `text-primary` |
| `--scribdown-color-blockquote-link-visited` | `link-visited` 86% + `text-primary` | `link-visited` 88% + `text-primary` |

## 纸面与阴影

| Token | 浅色 | 暗色 | 说明 |
| --- | --- | --- | --- |
| `--scribdown-paper-grain` | `rgba(132, 96, 44, 0.10)` | `rgba(211, 170, 87, 0.10)` | 纸面颗粒噪点 |
| `--scribdown-paper-fiber` | `rgba(67, 107, 91, 0.06)` | `rgba(126, 187, 171, 0.07)` | 纸面纤维丝纹 |
| `--scribdown-shadow-sm` | `2px 3px 0 rgba(47, 38, 32, 0.13)` | `2px 3px 0 rgba(0, 0, 0, 0.36)` | 轻浮起感 |
| `--scribdown-shadow-md` | `4px 6px 0 rgba(47, 38, 32, 0.18)` | `4px 6px 0 rgba(0, 0, 0, 0.48)` | 卡片与代码块 |

阴影采用零模糊的偏移写法，保留手绘"墨晕"感，不做厚重浮层投影。

## 字体

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-font-body` | `"Noto Serif SC Variable", "Songti SC", serif` | 正文阅读字体，由本地 WOFF2 资产覆盖中英文 |
| `--scribdown-font-heading` | `"LXGW WenKai Screen", "Kaiti SC", serif` | 标题与局部强调字体，由本地 WOFF2 资产覆盖中英文 |
| `--scribdown-font-code` | `"JetBrains Mono", "Fira Code", monospace` | 代码字体 |

## 圆角

圆角值采用轻微不规则的四角独立写法，以呼应手绘感。同层级组件只能使用同一组半径。

| Token | Value | 用途 |
| --- | --- | --- |
| `--scribdown-radius-sm` | `8px 10px 9px 11px` | 行内元素与轻组件 |
| `--scribdown-radius-md` | `14px 16px 13px 17px` | 卡片、引用块、容器级背景块 |

## 间距

统一采用 4 的倍数体系。

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-space-1` | `4px` | 最小间距 |
| `--scribdown-space-2` | `8px` | 细小间距 |
| `--scribdown-space-3` | `12px` | 紧凑组件间距 |
| `--scribdown-space-4` | `16px` | 默认组件内边距 |
| `--scribdown-space-5` | `24px` | 块级元素间距 |
| `--scribdown-space-6` | `32px` | 大块间距 |
| `--scribdown-space-7` | `48px` | 区域间距 |

## 动效

所有交互过渡统一走 Token，不写散落 magic number。

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-duration-fast` | `120ms` | 轻量反馈（hover、图标着色） |
| `--scribdown-duration-base` | `200ms` | 普通过渡（侧栏开合、下拉展开） |
| `--scribdown-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认状态切换曲线 |

## 资源与运行时变量

| Token | 写入位置 | 说明 |
| --- | --- | --- |
| `--scribdown-toc-toggle-icon` | tokens.css | 目录折叠箭头 SVG，inline `[TOC]` 与工具栏抽屉共用 |
| `--scribdown-content-width` | 运行时写入 `<html>` | 正文最大宽度，由工具栏"页面宽度"菜单切换并持久化 |
| `--scribdown-toc-width` | 运行时写入 `.scribdown-toc-host` | 目录侧栏宽度，默认 `280px`，可拖拽调整（范围 `180px`–`640px`，且不超过宿主宽度的 70%） |

组件内部还有一批局部变量（如代码块、表格、手绘边框的贴图与尺寸），它们定义在各自的组件样式内、作用域仅限该组件，不属于全局 Token，不应被应用层消费。

## 排版

正文与标题的字号阶梯定义在 `markdown.css`，代码相关定义在 `code.css` / `inline.css`。

| 样式 | 字号 | 行高 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| 正文 | `16px` | `1.65` | `400` | 默认正文 |
| `h1` | `34px` | `1.2` | `700` | 文档主标题 |
| `h2` | `26px` | `1.3` | `700` | 一级章节 |
| `h3` | `21px` | `1.35` | `600` | 二级章节 |
| `h4` | `18px` | `1.4` | `600` | 三级章节 |
| `h5` | `16px` | `1.5` | `600` | 四级章节（同正文字号，字重区分层级） |
| `h6` | `14px` | `1.5` | `600` | 五级章节 |
| 代码块 | `14px` | `1.65` | `500` | 围栏与缩进代码块 |
| 行内代码 | `0.86em` | `1.2` | `600` | 随上下文缩放 |

工具栏、图注、目录等组件的字号在各自组件样式内定义，不进入本表。

## 落地规则

| 类别 | 规则 |
| --- | --- |
| 颜色 | 只消费语义层 `--scribdown-color-*`，不直接引用 `--scribdown-palette-*`，更不要写字面色值 |
| 主题 | 宿主强制主题时使用 `@scribdown/shared` 导出的 class 常量，不硬编码字符串 |
| 间距 | 统一采用 4 的倍数体系，容器内边距优先使用 `16`、`24`、`32` |
| 字号 | 严格使用上表中已定义文本样式，不新增自由字号 |
| 圆角 | 允许轻微不规则感，但同层级组件只能使用同一组半径 |
| 阴影 | 以轻阴影或偏移感为主，不做厚重浮层投影 |
| 动效 | 所有交互过渡统一走 Token，不写散落 magic number |
