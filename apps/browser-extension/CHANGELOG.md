# @scribdown/browser-extension

## 0.3.0

### Minor Changes

- 1757947: Scribdown 界面新增繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语与俄语支持。语言选择器仅展示显式语言，未设置偏好时自动跟随宿主应用语言；同时修复多语言列表的视口适配、光标状态与开合动画。
- 194b3b4: 浏览器插件迁移至 WXT 构建体系，并支持按网站分别保存界面语言偏好。VS Code 预览新增语言设置；共享 i18n 与 Markdown 工具栏新增语言偏好解析、切换及宿主同步接口。

### Patch Changes

- Updated dependencies [1757947]
- Updated dependencies [194b3b4]
- Updated dependencies [35e7035]
- Updated dependencies [646e7ca]
  - @scribdown/shared@0.4.0
  - @scribdown/markdown-renderer@0.5.0
  - @scribdown/ui-handdrawn@0.2.2

## 0.2.1

### Patch Changes

- d40ff16: 修复 Chrome 发布流程（V2 上传状态判断）后重新发布浏览器插件。

## 0.2.0

### Minor Changes

- f07b8eb: 引入 shared/i18n 统一文案，浏览器插件与 VS Code 插件接入多语言，manifest 文案由 sync:i18n 生成，默认兜底 en。

### Patch Changes

- Updated dependencies [f07b8eb]
  - @scribdown/shared@0.3.0
  - @scribdown/markdown-renderer@0.4.1

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
