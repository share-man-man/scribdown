# @scribdown/shared

## 0.3.0

### Minor Changes

- f07b8eb: 引入 shared/i18n 统一文案，浏览器插件与 VS Code 插件接入多语言，manifest 文案由 sync:i18n 生成，默认兜底 en。

## 0.2.0

### Minor Changes

- 3a0f949: 新增 YAML frontmatter 元数据卡片渲染：渲染核心解析文档头部 frontmatter 并输出元数据卡片，共享包补充相关常量，手绘组件包提供配套卡片样式。同时将渲染核心拆分为按功能划分的模块，行为保持不变。

## 0.1.0

### Minor Changes

- 26c2bea: 首个公开发布。渲染核心、共享常量与手绘视觉组件以公共包形式发布到 npm；浏览器插件与 VS Code 插件接入统一的版本编排与发布流程。
