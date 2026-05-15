# Scribdown

## 项目定位

Scribdown 提供统一的 Markdown 渲染体验，覆盖浏览器插件与 VS Code 插件，复用同一套渲染核心与视觉组件。

## 仓库结构

```text
.
├── apps/
│   ├── browser-extension/        # 浏览器插件（React + Vite）
│   ├── docs/                     # VitePress 文档站点
│   ├── markdown-fixture-preview/ # 渲染预览沙盒
│   └── vscode-extension/         # VS Code 预览插件
├── packages/
│   ├── markdown-renderer/        # Markdown → HTML 渲染核心
│   ├── ui-handdrawn/             # 手绘风格视觉组件
│   └── shared/                   # 常量、枚举、跨端命名
├── tests/e2e/                    # Playwright E2E
├── design/source/                # 设计源文件（.pen，仅通过 Pencil MCP 读写）
├── turbo.json
└── pnpm-workspace.yaml
```

## 环境基线

- Node.js：`24.15.0`（`.tool-versions`）
- pnpm：`10.33.0`

## 常用命令

```bash
pnpm run dev            # 并行启动所有 apps dev
pnpm run build          # 全工作区构建
pnpm run e2e            # Playwright E2E（首次需 pnpm exec playwright install）
```

> `packages/*` 为 Just-in-Time 内部包，`exports` 直接指向 `src` 的 TS/CSS 源码，无构建步骤；`dev` 可直接启动，无需先 `build`。其余脚本（`lint` / `format` / `typecheck` / `test` / `clean` / `changeset` / `version-packages` / `release`）见根 `package.json`。

## 架构约束

- **应用层优先依赖 `packages/*`**，不在 `apps/*` 中重复实现渲染或组件逻辑。
- **常量和枚举必须复用 `@scribdown/shared`**，禁止硬编码或在其他包重新定义。
- **平台差异仅在 `apps/*` 落地**，`packages/markdown-renderer` 保持跨端一致。
- **渲染安全默认可开关**：用户输入内容渲染时统一开启 `sanitizeHtml`；Webview / 浏览器宿主中不直接拼接不可信 HTML。

## UI 验证约定

改动可能影响渲染效果时，进入 http://127.0.0.1:5175，如果没有启动，则在根目录执行 `pnpm run dev` 启动验证。
