import * as vscode from "vscode";
import { OPEN_PREVIEW_COMMAND, PROJECT_NAME, VSCODE_PREVIEW_TITLE } from "@scribdown/shared";

/**
 * 插件激活函数。
 * @param context VS Code 扩展上下文。
 */
export function activate(context: vscode.ExtensionContext): void {
  // 注册预览命令，后续可接入 markdown-renderer 的完整能力。
  const previewCommand = vscode.commands.registerCommand(OPEN_PREVIEW_COMMAND, async () => {
    // 关键步骤：创建并展示 Webview 面板。
    const panel = vscode.window.createWebviewPanel(
      "scribdownPreview",
      `${PROJECT_NAME} Preview`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true
      }
    );

    panel.webview.html = createPreviewHtml();
  });

  context.subscriptions.push(previewCommand);
}

/**
 * 插件停用函数。
 */
export function deactivate(): void {
  // 当前初始化阶段无持久资源需要释放。
}

/**
 * 生成 Webview 的基础 HTML。
 * @returns HTML 字符串。
 */
function createPreviewHtml(): string {
  // 统一主题变量，便于后续与浏览器插件保持一致。
  const paperBackground = "linear-gradient(145deg, #fef7e8, #f7ead6)";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${PROJECT_NAME} Preview</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Comic Sans MS", "Bradley Hand", cursive;
        background: ${paperBackground};
        color: #2a2a2a;
      }
      .card {
        border: 2px solid #4c4c4c;
        border-radius: 16px;
        box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.25);
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <section class="card">
      <h2>${PROJECT_NAME} · ${VSCODE_PREVIEW_TITLE}</h2>
      <p>Monorepo initialization complete. Markdown renderer integration can be expanded next.</p>
    </section>
  </body>
</html>`;
}
