---
"@scribdown/browser-extension": patch
"@scribdown/markdown-renderer": patch
---

修复浏览器插件在文档内容更新后重新渲染时，阅读位置跳回顶部、Mermaid 全屏与图片放大失效的问题。插件改为与 VS Code 预览一致的 morphdom 增量更新，未变化的内容原地保留；全屏查看器在宿主重建页面后也能自动恢复可用。
