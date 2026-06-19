# Scribdown Markdown Preview

为 VS Code 提供手绘风格的 Markdown 预览，与 Scribdown 浏览器插件复用同一套渲染核心，多端阅读体验一致。

## 功能特性

- **手绘风格渲染**：纸感、草图感的排版与轻量动画，区别于默认预览的扁平样式。
- **实时预览**：编辑 Markdown 时预览随文档变更增量刷新（基于 morphdom，原地保留滚动位置）。
- **双向滚动同步**：编辑器与预览面板顶部可视行互相跟随，来回切换不跳动。
- **光标定位高亮**：移动光标时，预览中对应内容块会短暂高亮；目标在视口外时给出上/下方向提示。
- **目录侧栏**：自动提取标题生成可折叠目录，点击跳转，并随滚动高亮当前章节。
- **浮动工具栏**：显示当前章节指示器，支持点击跳转。
- **代码高亮**：基于 `shiki` 的语法高亮。
- **安全渲染**：内容经 `rehype-sanitize` + `DOMPurify` 净化，并配合 Webview CSP，不直接拼接不可信 HTML。

## 使用方式

1. 打开任意 Markdown（`.md`）文件。
2. 通过以下任一入口打开预览：
   - 命令面板执行 **Scribdown: Open Scribdown Preview**；
   - 编辑器右上角标题栏的预览图标；
   - 编辑器内右键菜单的 **Open Scribdown Preview**。
3. 预览面板在侧边栏打开，编辑文档即可实时更新。

## 环境要求

- VS Code `^1.90.0`

## 反馈与源码

- 源码仓库：<https://github.com/share-man-man/scribdown>
- 问题反馈：<https://github.com/share-man-man/scribdown/issues>

## 许可协议

[MIT](./LICENSE)
