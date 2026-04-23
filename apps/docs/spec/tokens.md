# Token 系统

所有公开 CSS 变量统一使用 `--scribdown-` 前缀，避免与宿主环境或第三方样式发生命名冲突。产品边界与宿主约束见 [产品与渲染概览](./overview.md)，组件消费方式见 [组件规范](./components.md)。

## 浅色主题

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

## 暗色主题

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

## 字体

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-font-body` | `"Source Serif 4", "Noto Serif SC", serif` | 正文阅读字体 |
| `--scribdown-font-heading` | `"Caveat", "LXGW WenKai", "Noto Serif SC", serif` | 标题与局部强调字体 |
| `--scribdown-font-code` | `"JetBrains Mono", "Fira Code", monospace` | 代码字体 |

## 圆角

圆角值采用轻微不规则的四角独立写法，以呼应手绘感。同层级组件只能使用同一组半径。

| Token | Value | 用途 |
| --- | --- | --- |
| `--scribdown-radius-sm` | `8px 10px 9px 11px` | 行内元素与轻组件 |
| `--scribdown-radius-md` | `14px 16px 13px 17px` | 卡片、引用块 |
| `--scribdown-radius-lg` | `22px 24px 20px 26px` | 容器级背景块 |

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
| `--scribdown-space-8` | `64px` | 页面级留白 |

## 动效

所有交互过渡统一走 Token，不写散落 magic number。

| Token | Value | 说明 |
| --- | --- | --- |
| `--scribdown-duration-fast` | `120ms` | 轻量反馈 |
| `--scribdown-duration-base` | `200ms` | 普通过渡 |
| `--scribdown-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认状态切换，匀速进出 |
| `--scribdown-easing-enter` | `cubic-bezier(0, 0, 0.2, 1)` | 元素进入，先快后慢 |
| `--scribdown-easing-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 元素退出，先慢后快 |

## Typography

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

## 落地规则

| 类别 | 规则 |
| --- | --- |
| 间距 | 统一采用 4 的倍数体系，容器内边距优先使用 `16`、`24`、`32` |
| 字号 | 严格使用上表中已定义文本样式，不新增自由字号 |
| 圆角 | 允许轻微不规则感，但同层级组件只能使用同一组半径 |
| 阴影 | 以轻阴影或偏移感为主，不做厚重浮层投影 |
| 动效 | 所有交互过渡统一走 Token，不写散落 magic number |
