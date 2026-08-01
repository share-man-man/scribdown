---
"@scribdown/markdown-renderer": patch
"@scribdown/ui-handdrawn": patch
---

优化 Mermaid 与图片查看器的缩放体验：Mermaid 根据图表文字和视口尺寸计算自适应放大上限，缩放步进随当前倍率动态变化；全屏与非全屏视图稳定预留滚动条空间，并在达到缩放边界后停止重复焦点修正，避免滚动条闪烁和视图漂移。
