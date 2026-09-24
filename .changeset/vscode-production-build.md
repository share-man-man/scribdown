---
"scribdown-markdown-preview": patch
---

修复生产构建未压缩的问题，扩展包体积从 14.34MB 降至 1.82MB。

构建此前依赖 `NODE_ENV=production` 判定生产模式，但仓库中没有任何脚本设置过该变量，导致发布产物长期未压缩，并且把 8MB 的 sourcemap 一并打进 vsix。现改为默认按生产构建，仅 `tsup --watch`（dev）产出未压缩的调试产物。
