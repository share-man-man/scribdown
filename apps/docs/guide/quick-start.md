# 快速上手

## 环境要求

| 工具 | 版本 |
| --- | --- |
| Node.js | `24.15.0` |
| pnpm | `10.33.0` |
| asdf | `>= 0.14.0`（可选，用于统一工具链版本） |

## 安装依赖

```bash
pnpm install
```

## 本地开发

```bash
# 一键启动（推荐）
pnpm run dev

# 分步启动
pnpm run dev:packages   # 先启动 packages/* 的 watch 编译
pnpm run dev:apps       # 再启动 apps/* 的开发进程
```

::: tip 首次启动
首次运行前需先执行一次 `pnpm run build`，让各 `packages/*` 生成 `dist` 产物，否则 `dev:apps` 找不到模块。
:::

## 构建与校验

```bash
pnpm run build        # 全量构建
pnpm run lint         # 代码检查
pnpm run typecheck    # 类型检查
pnpm run test         # 单元测试
pnpm run e2e          # 端到端测试
```

## 常用命令

| 场景 | 命令 |
| --- | --- |
| 格式化检查 | `pnpm run format` |
| 自动修复格式 | `pnpm exec prettier --write .` |
| 创建版本变更记录 | `pnpm run changeset` |
| 计算并写入版本号 | `pnpm run version-packages` |
| 发布包 | `pnpm run release` |
| 清理构建产物 | `pnpm run clean` |

## 调试各平台插件

**浏览器插件**

执行 `pnpm run dev` 后，进入 `chrome://extensions`，开启开发者模式，加载 `apps/browser-extension/dist` 目录。每次热更新后需手动点击「刷新」重载插件。

**VS Code 插件**

在 VS Code 中打开仓库根目录，按 `F5` 启动扩展开发宿主（Extension Development Host），在新窗口中执行命令 `Scribdown: Open Preview`。

## 常见问题

**`pnpm run dev` 后报找不到模块？**

先执行 `pnpm run build` 生成各包产物，再启动 `dev`。

**E2E 测试报找不到浏览器？**

首次运行前需安装 Playwright 浏览器：

```bash
pnpm exec playwright install
```

**`pnpm run typecheck` 报找不到类型声明？**

确认 `pnpm run build` 已执行，各 `packages/*/dist` 目录存在后重试。
