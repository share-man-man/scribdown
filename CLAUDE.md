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
pnpm run dev            # 一键启动（packages watch + apps dev）
pnpm run dev:packages   # 仅 packages/tools watch
pnpm run dev:apps       # 仅 apps dev
pnpm run build          # 全工作区构建
pnpm run e2e            # Playwright E2E（首次需 pnpm exec playwright install）
```

> **首次 `dev` 前**需先 `pnpm run build`，让各 `packages/*` 生成 `dist`。其余脚本（`lint` / `format` / `typecheck` / `test` / `clean` / `changeset` / `version-packages` / `release`）见根 `package.json`。

## 架构约束

- **应用层优先依赖 `packages/*`**，不在 `apps/*` 中重复实现渲染或组件逻辑。
- **常量和枚举必须复用 `@scribdown/shared`**，禁止硬编码或在其他包重新定义。
- **平台差异仅在 `apps/*` 落地**，`packages/markdown-renderer` 保持跨端一致。
- **渲染安全默认可开关**：用户输入内容渲染时统一开启 `sanitizeHtml`；Webview / 浏览器宿主中不直接拼接不可信 HTML。

## 应用模块速查

| 应用 | 作用 | dev 地址 | preview 地址 | 备注 |
| --- | --- | --- | --- | --- |
| `@scribdown/browser-extension` | 浏览器插件宿主：popup + content script 调用 `markdown-renderer` 与 `ui-handdrawn` 完成页面渲染。 | `http://127.0.0.1:5173` | `http://127.0.0.1:4173` | dev 服务器仅服务 popup 调试，扩展加载走 `dist/`。 |
| `@scribdown/vscode-extension` | VS Code 预览插件：注册 `Scribdown: Open Preview` 命令并在 Webview 中复用同一套渲染。 | — | — | `tsup --watch` 仅产出 `dist/`，调试通过 `F5` 启动 Extension Host。 |
| `@scribdown/docs` | VitePress 文档站点：指南、UI 设计规范、开发文档对外发布入口。 | `http://127.0.0.1:5174` | `http://127.0.0.1:4174` | `apps/docs/ui-design/markdown-fixture.md` 同时作为渲染样例的"单一信息源"。 |
| `@scribdown/markdown-fixture-preview` | 渲染预览沙盒：直接加载 `apps/docs/ui-design/markdown-fixture.md`，通过真实渲染链路输出到浏览器。 | `http://127.0.0.1:5175` | `http://127.0.0.1:4175` | 用于设计走查与样式回归，避免每次都打包浏览器 / VS Code 插件；非发布产物，不上线。 |

> 端口已通过各自 `package.json` 的 dev/preview 脚本固定，新增 web 应用时请沿用 `dev: 51xx` / `preview: 41xx` 段位；`browser-extension` 的 dev 端口使用 `--strictPort`，被占用时会直接报错而非自动跳号。

## UI 验证约定

改动可能影响渲染效果时，必须打开 `@scribdown/markdown-fixture-preview`（`http://127.0.0.1:5175`）核对再收工；不影响渲染的改动可跳过并在结论中注明。
