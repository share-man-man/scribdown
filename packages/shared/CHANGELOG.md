# @scribdown/shared

## 0.5.0

### Minor Changes

- 21eb8d3: 设计 Token 拆成「调色板层 + 语义层」：浅色与暗色的色值各定义一次，语义 Token 只做映射，两套主题不再各存一份色值副本。同时新增 `scribdown-theme-dark` / `scribdown-theme-light` 两个根元素 class（常量由 `@scribdown/shared` 导出），供自带主题开关的宿主覆盖系统 `prefers-color-scheme`；未指定时行为不变，仍跟随系统。
- 2374a9b: 目录侧栏支持拖拽调整宽度：侧栏与正文之间新增调宽手柄，支持鼠标 / 触摸拖拽、键盘方向键微调、双击恢复默认宽度，结果按 localStorage 持久化，窗口缩放时按宿主宽度占比自动夹取。
- b25f0b8: 统一图片与 Mermaid 的查看器控件：新增可复用的按钮、连体缩放组与图标，Mermaid 行内及全屏视图支持选择 / 拖拽模式、缩放、重置、源码复制与失败态精简，图片全屏复用同一套缩放交互。同时为表格增加 TSV 复制入口，并仅在 hover、键盘聚焦或触屏场景展示。

## 0.4.0

### Minor Changes

- 1757947: Scribdown 界面新增繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语与俄语支持。语言选择器仅展示显式语言，未设置偏好时自动跟随宿主应用语言；同时修复多语言列表的视口适配、光标状态与开合动画。
- 194b3b4: 浏览器插件迁移至 WXT 构建体系，并支持按网站分别保存界面语言偏好。VS Code 预览新增语言设置；共享 i18n 与 Markdown 工具栏新增语言偏好解析、切换及宿主同步接口。

### Patch Changes

- 646e7ca: 升级项目 Node.js 与 pnpm 工具链，并同步 Node.js LTS 版本常量。

## 0.3.0

### Minor Changes

- f07b8eb: 引入 shared/i18n 统一文案，浏览器插件与 VS Code 插件接入多语言，manifest 文案由 sync:i18n 生成，默认兜底 en。

## 0.2.0

### Minor Changes

- 3a0f949: 新增 YAML frontmatter 元数据卡片渲染：渲染核心解析文档头部 frontmatter 并输出元数据卡片，共享包补充相关常量，手绘组件包提供配套卡片样式。同时将渲染核心拆分为按功能划分的模块，行为保持不变。

## 0.1.0

### Minor Changes

- 26c2bea: 首个公开发布。渲染核心、共享常量与手绘视觉组件以公共包形式发布到 npm；浏览器插件与 VS Code 插件接入统一的版本编排与发布流程。
