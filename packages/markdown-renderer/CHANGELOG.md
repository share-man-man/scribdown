# @scribdown/markdown-renderer

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
