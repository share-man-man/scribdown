---
"scribdown-markdown-preview": patch
---

修正 VS Code 插件对内部包的依赖声明（`devDependencies` → `dependencies`），使渲染器 / 视觉包的改动能联动 bump 版本并触发商店发布；同时补发上一轮遗漏的 Mermaid 主题配色与缩放交互优化。
