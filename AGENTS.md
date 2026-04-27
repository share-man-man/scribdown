# Scribdown — CLAUDE.md

## 项目定位

Scribdown 提供统一的 Markdown 渲染体验，覆盖浏览器插件与 VS Code 插件，复用同一套渲染核心与视觉组件。

## 仓库结构

```text
.
├── apps/
│   ├── browser-extension/   # React + Vite 浏览器插件弹窗
│   └── vscode-extension/    # VS Code 预览插件
├── packages/
│   ├── markdown-renderer/   # Markdown → HTML 渲染核心
│   ├── ui-handdrawn/        # 手绘风格视觉组件
│   └── shared/              # 常量、枚举、跨端命名
├── tools/                   # 开发脚本与自动化工具
├── tests/e2e/               # Playwright E2E 测试
├── design/                  # 设计源文件（.pen）
├── wiki/                    # 项目文档
├── turbo.json
└── pnpm-workspace.yaml
```

## 环境基线

- Node.js：`24.15.0`（通过 `.tool-versions` 管理）
- pnpm：`10.33.0`
- VS Code 引擎：`^1.90.0`

## 常用命令

```bash
pnpm install                  # 安装依赖
pnpm run dev                  # 一键启动（packages watch + apps dev）
pnpm run dev:packages         # 仅启动 packages/tools watch
pnpm run dev:apps             # 仅启动 apps 开发进程
pnpm run build                # 全工作区构建
pnpm run lint                 # ESLint 静态检查
pnpm run format               # Prettier 格式检查
pnpm run typecheck            # TypeScript 类型检查
pnpm run test                 # Vitest 单元测试
pnpm run e2e                  # Playwright E2E 测试
pnpm run clean                # 清理 dist / build / coverage / node_modules
pnpm run changeset            # 记录版本变更
pnpm run version-packages     # 计算并写入版本号
pnpm run release              # 发布包
```

> **首次运行 `dev` 前**，需先执行 `pnpm run build` 让各 `packages/*` 生成 `dist`。

## 架构约束

- **应用层优先依赖 `packages/*`**，不在 `apps/*` 中重复实现渲染或组件逻辑。
- **常量和枚举必须复用 `@scribdown/shared`**，禁止硬编码或在其他包重新定义。
- **平台差异仅在 `apps/*` 落地**，`packages/markdown-renderer` 保持跨端一致。
- **渲染安全默认可开关**：用户输入内容渲染时统一开启 `sanitizeHtml`；Webview / 浏览器宿主中不直接拼接不可信 HTML。

## 关键模块速查

| 模块                           | 关键导出                          | 说明                                |
| ------------------------------ | --------------------------------- | ----------------------------------- |
| `@scribdown/markdown-renderer` | `renderMarkdown(text, options?)`  | Markdown → 安全 HTML（async）       |
|                                | `renderCodeToHtml(code, lang)`    | Shiki 代码高亮                      |
|                                | `sanitizeHtmlWithDomPurify(html)` | 字符串级安全清洗                    |
| `@scribdown/ui-handdrawn`      | `HanddrawnCard`                   | 统一手绘卡片容器                    |
| `@scribdown/shared`            | constants / enums                 | 项目名、平台类型、主题类型、命令 ID |

## 代码规范

- 所有 `let` / `const` 变量必须写明注释；函数使用 JSDoc 格式说明参数含义。
- 枚举和常量统一引用 `@scribdown/shared`，不重复定义或硬编码。
- 关键步骤写明注释，解释"为什么"而非"做了什么"。

## 测试规范

- 单元测试文件匹配 `**/*.test.ts` / `**/*.test.tsx`，使用 Vitest。
- E2E 测试放在 `tests/e2e/`，使用 Playwright（首次需 `pnpm exec playwright install`）。
- 发布前必须通过 `lint`、`typecheck`、`test`。

## VS Code 插件本地调试

在 VS Code 中打开仓库，按 `F5` 启动 Extension Development Host，在新窗口执行命令 `Scribdown: Open Preview`。

## 设计文件

`.pen` 文件位于 `design/source/`，只能通过 Pencil MCP 工具读写，不可直接用文本工具打开。
