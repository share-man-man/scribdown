---
"@scribdown/markdown-renderer": minor
"scribdown-markdown-preview": minor
---

光标同步高亮支持表格行级粒度：渲染核心为表格行标注 `data-source-line`，光标落在表格内时高亮精确到所在行而非整张表；高亮浮层按祖先横向滚动容器裁剪，宽表格横向滚动时不再溢出边界或错位。
