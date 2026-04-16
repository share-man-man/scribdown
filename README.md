# Scribdown

Scribdown 是一个以手绘风格为核心视觉语言的 Markdown 渲染器，可同时作为主流浏览器插件与 VS Code 插件运行，提供统一的编辑与预览体验。

## 快速上手

```bash
# 1) 安装依赖
pnpm install

# 2) 启动开发
pnpm dev
```

## 项目定位

- 多端一致：浏览器与 VS Code 使用同一套渲染核心与 UI 语言
- 手绘风格：偏纸感、草图感、轻量动画的阅读与编辑界面
- 可扩展：支持插件化渲染能力与主题扩展

## 支持平台

- 浏览器插件：Chrome、Edge、Firefox（基于 WebExtension）
- 编辑器插件：VS Code Extension

## 技术栈

### 前端与渲染

- 开发语言与类型系统：`TypeScript`
- 交互式界面框架：`React`
- Markdown 处理链：`remark` + `rehype`
- 代码高亮：`shiki`
- 安全渲染：`rehype-sanitize` + `DOMPurify`

### 仓库管理与构建发布

- 仓库组织模式：`Monorepo`
- 工作区依赖管理：`pnpm workspace`
- 任务编排与缓存加速：`Turborepo`（仅负责任务调度与缓存）
- 版本管理与发布流程：`Changesets`（仅负责版本与发包）
- 应用与共享包构建：`Vite`（统一构建配置与开发体验）
- 工具链版本管理：`asdf`

### 插件平台

- 浏览器扩展能力：`WebExtension API` + `webextension-polyfill`
- VS Code 扩展能力：`VS Code Extension API`

### 质量保障

- 代码质量检查：`ESLint` + `Prettier`
- 单元与端到端测试：`Vitest` + `Playwright`

### 版本约束与环境基线

> 具体安装版本以仓库根目录配置（如 `package.json`、`.tool-versions`）为准

- `Node.js`：`24.15.0`（LTS）
- `pnpm`：`10.33.0`
- `asdf`：`>= 0.14.0`（用于统一本地工具链版本）
- 浏览器插件开发与调试：`Chrome >= 124`、`Edge >= 124`、`Firefox >= 126`
- VS Code 插件开发与调试：`VS Code >= 1.90.0`

## Monorepo 结构规划

```txt
.
├── apps
│   ├── browser-extension
│   └── vscode-extension
├── packages
│   ├── markdown-renderer
│   ├── ui-handdrawn
│   └── shared
└── tools
```

## UI 风格说明

- 视觉方向：手绘线条、轻纹理背景、非机械化圆角与阴影
- 组件风格：强调内容可读性与编辑聚焦，减少装饰性噪声
- 动效策略：小幅度、低干扰、增强层级感

## Wiki

- 入口页：[`wiki/Home.md`](./wiki/Home.md)
