---
"@scribdown/shared": minor
"@scribdown/markdown-renderer": minor
"@scribdown/ui-handdrawn": minor
"@scribdown/browser-extension": minor
"scribdown-markdown-preview": minor
---

新增数学公式渲染：基于 remark-math 与 KaTeX 支持 `$…$` 行内公式、`$$…$$` 块级公式与 ` ```math ` 围栏，KaTeX 样式与字体随包离线加载；按 Pandoc 规则避免把货币金额识别为公式，非法公式保留原文并局部提示，块级公式支持横向滚动与复制原文，选中公式复制时写入 TeX 源码。
