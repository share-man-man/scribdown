# @scribdown/markdown-renderer

## 0.3.0

### Minor Changes

- 085661e: 标题锚点 slug 换用 github-slugger，与 GitHub / VS Code 内置预览完全对齐：空格逐个替换为连字符、不再合并（如「聊天 / 新建对话首页」→ `聊天--新建对话首页`），按 GitHub 惯例书写的 `#锚点` 均可命中；重复标题去重与空标题回退行为不变。渲染核心内部同步迁移 unified 官方生态（unist-util-visit、mdast-util-to-string、hast-util-classnames、@types/mdast 官方类型与自定义节点注册），渲染输出不变。

### Patch Changes

- 085661e: 工具栏「更多」菜单的「关于」改为原生链接：VS Code Webview 中经链接拦截器转交扩展进程打开系统浏览器（原 window.open 被沙箱禁用而静默失败），浏览器宿主走原生新标签页；菜单项样式兼容链接形态。
- Updated dependencies [085661e]
  - @scribdown/ui-handdrawn@0.2.1

## 0.2.0

### Minor Changes

- 3a0f949: 新增 YAML frontmatter 元数据卡片渲染：渲染核心解析文档头部 frontmatter 并输出元数据卡片，共享包补充相关常量，手绘组件包提供配套卡片样式。同时将渲染核心拆分为按功能划分的模块，行为保持不变。

### Patch Changes

- 3a0f949: Shiki 语法按需懒加载，减小初始加载体积并加快首次渲染。
- Updated dependencies [3a0f949]
  - @scribdown/shared@0.2.0
  - @scribdown/ui-handdrawn@0.2.0

## 0.1.0

### Minor Changes

- 26c2bea: 首个公开发布。渲染核心、共享常量与手绘视觉组件以公共包形式发布到 npm；浏览器插件与 VS Code 插件接入统一的版本编排与发布流程。

### Patch Changes

- Updated dependencies [26c2bea]
  - @scribdown/ui-handdrawn@0.1.0
  - @scribdown/shared@0.1.0
