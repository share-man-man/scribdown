---
"@scribdown/browser-extension": patch
---

按 URL 协议拆分 content script，http(s) 页面的注入脚本从 7.70MB 降至 6.1KB。

MV3 声明式 content script 只能是单文件、无法按需分包，此前 file:// 与 http(s):// 共用一个入口，导致每个 http(s) 的 `.md` 页面都要下载并解析整份渲染核心，而这条路径实际只需要跳转到扩展 viewer。现拆为两个入口：`file.content.ts` 保留就地渲染，`web.content.ts` 仅做跳转。
