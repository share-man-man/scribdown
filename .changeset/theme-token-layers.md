---
"@scribdown/ui-handdrawn": minor
"@scribdown/shared": minor
---

设计 Token 拆成「调色板层 + 语义层」：浅色与暗色的色值各定义一次，语义 Token 只做映射，两套主题不再各存一份色值副本。同时新增 `scribdown-theme-dark` / `scribdown-theme-light` 两个根元素 class（常量由 `@scribdown/shared` 导出），供自带主题开关的宿主覆盖系统 `prefers-color-scheme`；未指定时行为不变，仍跟随系统。
