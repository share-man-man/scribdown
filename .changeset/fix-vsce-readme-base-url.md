---
"scribdown-markdown-preview": patch
---

修复 Marketplace 页面预览截图 404：vsce 改写 README 相对链接时只认 `repository.url`（仓库根）而忽略 `repository.directory`，`../docs/public/ui-render.png` 拼接后被 URL 归一化吃掉 ref 段。改由 `scripts/vsce.mjs` 从 `repository` 字段推导 `--baseImagesUrl` 与 `--baseContentUrl` 并指向扩展子目录，打包与发布共用同一份基址。
