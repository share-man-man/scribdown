---
"@scribdown/markdown-renderer": patch
"@scribdown/ui-handdrawn": patch
---

工具栏「更多」菜单的「关于」改为原生链接：VS Code Webview 中经链接拦截器转交扩展进程打开系统浏览器（原 window.open 被沙箱禁用而静默失败），浏览器宿主走原生新标签页；菜单项样式兼容链接形态。
