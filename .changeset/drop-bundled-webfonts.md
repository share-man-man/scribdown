---
"@scribdown/ui-handdrawn": minor
---

不再内置 WOFF2 字体资产，改用系统字体栈。

- 移除 `@fontsource-variable/noto-serif-sc` 与 `lxgw-wenkai-screen-webfont` 依赖，随包分发的字体资产（约 10.6MB）全部去除。
- 删除 `styles/fonts.css`，其 `@import` 已从样式入口移除；直接引用 `@scribdown/ui-handdrawn/styles/fonts.css` 的调用方需要自行删除该导入。
- `--scribdown-font-body`、`--scribdown-font-heading`、`--scribdown-font-code` 改为标准系统字体栈，按「西文在前、中文在后、泛型兜底、emoji 收尾」排列；代码字体与 GitHub Primer 对齐。

正文与标题不再强制使用内置字形，改由系统字体呈现，视觉上会与此前版本存在差异。
