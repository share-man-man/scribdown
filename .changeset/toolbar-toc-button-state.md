---
"@scribdown/markdown-renderer": minor
"@scribdown/ui-handdrawn": minor
"@scribdown/browser-extension": patch
"scribdown-markdown-preview": patch
---

工具栏目录按钮区分展开与收起态：展开时图标切换为带左向箭头的收起图标，按钮底色加深、着强调色并显示一条下划线，tooltip 与 `aria-label` 同步切换为「关闭目录」，`aria-expanded` 反映当前状态。展开态样式由「更多」按钮一并复用。
