# Scribdown

Scribdown 提供统一的 Markdown 渲染体验，可同时作为浏览器插件与 VS Code 插件运行，复用同一套渲染核心与视觉组件。

快速链接：[进入文档站](https://share-man-man.github.io/scribdown/)

## 界面截图

Scribdown 的手绘风格 Markdown 渲染效果：

![Scribdown Markdown 渲染效果](./apps/docs/public/ui-render.png)

- **多端一致**：浏览器插件与 VS Code 插件共用渲染核心与视觉组件。
- **安全默认**：原始 HTML 经 `rehype-sanitize` + `DOMPurify` 双层清洗。

技术栈：`TypeScript` · `React` · `remark`/`rehype` · `shiki`，`pnpm workspace` + `Turborepo` 管理的 Monorepo。

## 快速上手

```bash
pnpm install   # 安装依赖（Node 24.15.0 / pnpm 10.33.0，见 .tool-versions）
pnpm dev       # 并行启动所有 apps dev
```

> 更完整的环境要求与上手步骤见文档站「[快速上手](./apps/docs/guide/quick-start.md)」。

## 仓库结构

```txt
apps/        浏览器插件、VS Code 插件、文档站、渲染预览沙盒
packages/    markdown-renderer（渲染核心）、ui-handdrawn（视觉组件）、shared（常量枚举）
```

详细的包依赖与模块职责见文档站「[架构设计](./apps/docs/dev/architecture.md)」。

## 文档

| 类型 | 入口 | 说明 |
| --- | --- | --- |
| 文档站 | [在线访问](https://share-man-man.github.io/scribdown/) · [`apps/docs`](./apps/docs) | 产品介绍、快速上手、设计体系与开发文档（Rspress，`pnpm --filter @scribdown/docs dev`） |
| 设计资产 | [`design/README.md`](./design/README.md) | Pencil 源文件、导出图与设计资产说明 |
| 开发 Wiki | [`wiki/Home.md`](./wiki/Home.md) | 架构、模块、发布流程等内部文档 |
