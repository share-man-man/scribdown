# @scribdown/markdown-renderer

## 0.5.0

### Minor Changes

- 1757947: Scribdown 界面新增繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语与俄语支持。语言选择器仅展示显式语言，未设置偏好时自动跟随宿主应用语言；同时修复多语言列表的视口适配、光标状态与开合动画。
- 194b3b4: 浏览器插件迁移至 WXT 构建体系，并支持按网站分别保存界面语言偏好。VS Code 预览新增语言设置；共享 i18n 与 Markdown 工具栏新增语言偏好解析、切换及宿主同步接口。

### Patch Changes

- Updated dependencies [1757947]
- Updated dependencies [194b3b4]
- Updated dependencies [35e7035]
- Updated dependencies [646e7ca]
  - @scribdown/shared@0.4.0
  - @scribdown/ui-handdrawn@0.2.2

## 0.4.1

### Patch Changes

- f07b8eb: 引入 shared/i18n 统一文案，浏览器插件与 VS Code 插件接入多语言，manifest 文案由 sync:i18n 生成，默认兜底 en。
- Updated dependencies [f07b8eb]
  - @scribdown/shared@0.3.0

## 0.4.0

### Minor Changes

- 06611b0: 光标同步高亮支持表格行级粒度：渲染核心为表格行标注 `data-source-line`，光标落在表格内时高亮精确到所在行而非整张表；高亮浮层按祖先横向滚动容器裁剪，宽表格横向滚动时不再溢出边界或错位。

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
