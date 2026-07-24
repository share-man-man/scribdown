# @scribdown/browser-extension

## 0.1.4

### Patch Changes

- 7571ec3: 发布流程改用 Google Service Account 鉴权，弃用 OAuth refresh_token。

## 0.1.3

### Patch Changes

- Updated dependencies [06611b0]
  - @scribdown/markdown-renderer@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [085661e]
- Updated dependencies [085661e]
  - @scribdown/markdown-renderer@0.3.0
  - @scribdown/ui-handdrawn@0.2.1

## 0.1.1

### Patch Changes

- 3a0f949: 修复渲染器静态资源未随插件暴露及相对路径 URL 解析问题；修复文件轮询可能产生重复定时器的问题。源码目录按功能重组，行为不变。
- Updated dependencies [3a0f949]
- Updated dependencies [3a0f949]
  - @scribdown/markdown-renderer@0.2.0
  - @scribdown/shared@0.2.0
  - @scribdown/ui-handdrawn@0.2.0

## 0.1.0

### Minor Changes

- 26c2bea: 首个公开发布。渲染核心、共享常量与手绘视觉组件以公共包形式发布到 npm；浏览器插件与 VS Code 插件接入统一的版本编排与发布流程。

### Patch Changes

- Updated dependencies [26c2bea]
  - @scribdown/markdown-renderer@0.1.0
  - @scribdown/ui-handdrawn@0.1.0
  - @scribdown/shared@0.1.0
