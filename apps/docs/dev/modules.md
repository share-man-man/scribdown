# 模块说明

## apps/browser-extension

浏览器插件宿主，负责挂载 React 应用并展示 Markdown 预览面板。

| 文件 | 说明 |
| --- | --- |
| `src/main.tsx` | 应用入口 |
| `src/App.tsx` | 主页面组件 |
| `src/styles.css` | 全局样式 |
| `public/manifest.json` | 插件清单 |

- 使用 `@scribdown/markdown-renderer` 将 Markdown 渲染为 HTML
- 使用 `@scribdown/ui-handdrawn` 输出统一手绘卡片风格

## apps/vscode-extension

VS Code 插件宿主，注册预览命令并通过 Webview 展示渲染结果。

| 文件 | 说明 |
| --- | --- |
| `src/extension.ts` | 插件入口，注册命令 |

- 命令 ID：`scribdown.openPreview`
- 激活时注册预览命令，命令触发后创建 Webview
- 为后续接入完整 `markdown-renderer` 预留扩展点

## packages/markdown-renderer

Markdown 渲染核心，承载 Markdown 到 HTML 的统一转换能力。

**关键导出**

```ts
renderMarkdown(markdownText: string, options?: RenderOptions): string
renderCodeToHtml(codeText: string, language: string): string
sanitizeHtmlWithDomPurify(unsafeHtml: string): string
```

- 提供可选的结构化（`rehype-sanitize`）与字符串级（`DOMPurify`）双层清洗
- 提供代码高亮 HTML 输出能力（基于 Shiki）

## packages/ui-handdrawn

手绘视觉组件库，提供统一手绘风格容器组件和样式 Token。

| 文件 | 说明 |
| --- | --- |
| `src/index.tsx` | 组件导出入口 |
| `src/styles.css` | Token 变量与基础样式 |

- 关键组件：`HanddrawnCard`
- 使用 `@scribdown/shared` 的项目名和主题常量，保持跨端一致

## packages/shared

跨端基础共享层，统一项目级命名、平台类型、主题类型和命令常量。

| 文件 | 说明 |
| --- | --- |
| `src/constants.ts` | 项目级常量 |
| `src/enums.ts` | 平台类型、主题类型等枚举 |
| `src/index.ts` | 统一导出 |

> 所有跨端共用的常量和枚举必须在此定义，避免多处硬编码分叉。

## tools

存放脚本、自动化流程与开发辅助工具，详见 `tools/README.md`。
