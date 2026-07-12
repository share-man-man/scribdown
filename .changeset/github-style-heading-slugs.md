---
"@scribdown/markdown-renderer": minor
---

标题锚点 slug 换用 github-slugger，与 GitHub / VS Code 内置预览完全对齐：空格逐个替换为连字符、不再合并（如「聊天 / 新建对话首页」→ `聊天--新建对话首页`），按 GitHub 惯例书写的 `#锚点` 均可命中；重复标题去重与空标题回退行为不变。渲染核心内部同步迁移 unified 官方生态（unist-util-visit、mdast-util-to-string、hast-util-classnames、@types/mdast 官方类型与自定义节点注册），渲染输出不变。
