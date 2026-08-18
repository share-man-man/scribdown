# scribdown-markdown-preview

## 0.7.2

### Patch Changes

- Updated dependencies [0824a4b]
- Updated dependencies [ccd56f4]
  - @scribdown/markdown-renderer@0.6.2
  - @scribdown/shared@0.5.1

## 0.7.1

### Patch Changes

- ea8155b: 修正 VS Code 插件对内部包的依赖声明（`devDependencies` → `dependencies`），使渲染器 / 视觉包的改动能联动 bump 版本并触发商店发布；同时补发上一轮遗漏的 Mermaid 主题配色与缩放交互优化。

## 0.7.0

### Minor Changes

- 2374a9b: 目录侧栏支持拖拽调整宽度：侧栏与正文之间新增调宽手柄，支持鼠标 / 触摸拖拽、键盘方向键微调、双击恢复默认宽度，结果按 localStorage 持久化，窗口缩放时按宿主宽度占比自动夹取。

### Patch Changes

- 21eb8d3: 工具栏目录按钮区分展开与收起态：展开时图标切换为带左向箭头的收起图标，按钮底色加深、着强调色并显示一条下划线，tooltip 与 `aria-label` 同步切换为「关闭目录」，`aria-expanded` 反映当前状态。展开态样式由「更多」按钮一并复用。

## 0.6.1

### Patch Changes

- f16c649: 修复 Marketplace 页面预览截图 404：vsce 改写 README 相对链接时只认 `repository.url`（仓库根）而忽略 `repository.directory`，`../docs/public/ui-render.png` 拼接后被 URL 归一化吃掉 ref 段。改由 `scripts/vsce.mjs` 从 `repository` 字段推导 `--baseImagesUrl` 与 `--baseContentUrl` 并指向扩展子目录，打包与发布共用同一份基址。

## 0.6.0

### Minor Changes

- 194b3b4: 浏览器插件迁移至 WXT 构建体系，并支持按网站分别保存界面语言偏好。VS Code 预览新增语言设置；共享 i18n 与 Markdown 工具栏新增语言偏好解析、切换及宿主同步接口。

### Patch Changes

- 1757947: Scribdown 界面新增繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语与俄语支持。语言选择器仅展示显式语言，未设置偏好时自动跟随宿主应用语言；同时修复多语言列表的视口适配、光标状态与开合动画。

## 0.5.0

### Minor Changes

- f07b8eb: 引入 shared/i18n 统一文案，浏览器插件与 VS Code 插件接入多语言，manifest 文案由 sync:i18n 生成，默认兜底 en。

## 0.4.0

### Minor Changes

- 06611b0: 光标同步高亮支持表格行级粒度：渲染核心为表格行标注 `data-source-line`，光标落在表格内时高亮精确到所在行而非整张表；高亮浮层按祖先横向滚动容器裁剪，宽表格横向滚动时不再溢出边界或错位。

## 0.3.0

### Minor Changes

- 085661e: 预览内跨文件链接支持锚点定位：点击 `foo.md#章节` 打开目标文件后，预览自动平滑滚动到对应标题；同文件带锚点链接同样生效，中文锚点做原文与解码双重匹配。

## 0.2.0

### Minor Changes

- 3a0f949: 预览中的链接点击按类型分流：工作区内文件在编辑器中打开，外部链接交由系统浏览器处理。同时修复 .md 文件被注册为其他 language id 时无法识别预览的问题。

## 0.1.0

### Minor Changes

- 26c2bea: 首个公开发布。渲染核心、共享常量与手绘视觉组件以公共包形式发布到 npm；浏览器插件与 VS Code 插件接入统一的版本编排与发布流程。
