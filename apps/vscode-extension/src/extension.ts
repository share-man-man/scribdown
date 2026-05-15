import * as vscode from "vscode";
import { renderMarkdownPreview } from "@scribdown/markdown-renderer";
import {
  MARKDOWN_LANGUAGE_ID,
  OPEN_PREVIEW_COMMAND,
  PROJECT_NAME,
  SCRIBDOWN_APP_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_PAGE_CLASS_NAME,
  VSCODE_PREVIEW_TITLE
} from "@scribdown/shared";

/**
 * Webview 预览面板 ViewType。
 */
const PREVIEW_WEBVIEW_VIEW_TYPE = "scribdownPreview";

/**
 * Webview 预览根节点 ID。
 */
const PREVIEW_ROOT_ELEMENT_ID = "scribdown-preview-root";

/**
 * Webview base 标签 ID。
 */
const PREVIEW_BASE_ELEMENT_ID = "scribdown-preview-base";

/**
 * Webview UI 资源目录名。
 */
const WEBVIEW_UI_DIRECTORY_NAME = "webview-ui";

/**
 * Webview UI 样式文件名。
 */
const WEBVIEW_UI_STYLE_FILE_NAME = "styles.css";

/**
 * Webview UI 运行时脚本文件名。
 */
const WEBVIEW_UI_RUNTIME_FILE_NAME = "preview-runtime.global.js";

/**
 * Webview 全局运行时变量名。
 */
const WEBVIEW_RUNTIME_GLOBAL_NAME = "ScribdownPreviewRuntime";

/**
 * Webview -> Extension 消息类型：预览已就绪。
 */
const PREVIEW_READY_MESSAGE_TYPE = "preview-ready";

/**
 * Webview -> Extension 消息类型：预览滚动变化。
 */
const PREVIEW_SCROLL_CHANGED_MESSAGE_TYPE = "preview-scroll-changed";

/**
 * Extension -> Webview 消息类型：渲染内容。
 */
const RENDER_CONTENT_MESSAGE_TYPE = "render-content";

/**
 * Extension -> Webview 消息类型：设置滚动百分比。
 */
const SET_PREVIEW_SCROLL_MESSAGE_TYPE = "set-preview-scroll";

/**
 * Webview 消息最小结构。
 */
interface PreviewMessagePayload {
  type: string;
  scrollPercentage?: number;
}

/**
 * 预览面板与文档控制器。
 */
class ScribdownPreviewController implements vscode.Disposable {
  /**
   * 当前扩展目录 URI。
   */
  private readonly extensionUri: vscode.Uri;

  /**
   * 当前预览面板实例。
   */
  private panel: vscode.WebviewPanel | undefined;

  /**
   * 当前绑定文档 URI 字符串。
   */
  private previewDocumentUriText: string | undefined;

  /**
   * 控制器内部订阅集合。
   */
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * 预览当前滚动百分比（预留双向同步用）。
   */
  private previewScrollPercentage = 0;

  /**
   * 创建控制器并注册文档监听。
   * @param extensionUri 当前扩展目录 URI。
   */
  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;

    // 文档变更监听：命中当前预览文档时刷新内容。
    const changeDocumentDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
      // 当前变化文档 URI。
      const changedDocumentUriText = event.document.uri.toString();

      if (!this.panel || changedDocumentUriText !== this.previewDocumentUriText) {
        return;
      }

      await this.renderDocumentToPanel(event.document);
    });

    // 编辑器可视区变化监听：预留编辑器 -> 预览同步入口。
    const changeVisibleRangesDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(
      (event) => {
        // 当前事件编辑器文档 URI。
        const editorDocumentUriText = event.textEditor.document.uri.toString();

        if (!this.panel || editorDocumentUriText !== this.previewDocumentUriText) {
          return;
        }

        // 关键步骤：保留事件读取，后续实现编辑器与预览滚动同步时直接复用。
        void event.visibleRanges;
      }
    );

    this.disposables.push(changeDocumentDisposable, changeVisibleRangesDisposable);
  }

  /**
   * 打开（或复用）当前激活 Markdown 文档的预览面板。
   */
  public async openPreviewForActiveMarkdown(): Promise<void> {
    // 当前激活 Markdown 文档。
    const activeDocument = getActiveMarkdownDocument();

    if (!activeDocument) {
      vscode.window.showWarningMessage("请先打开一个 Markdown 文档，再执行 Scribdown 预览。");
      return;
    }

    // 记录当前预览绑定文档 URI。
    this.previewDocumentUriText = activeDocument.uri.toString();

    if (!this.panel) {
      // 首次打开时创建新面板。
      this.panel = this.createPreviewPanel(activeDocument);
      this.registerPanelListeners(this.panel);
    } else {
      // 已有面板时直接复用并更新资源根目录。
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.panel.title = createPreviewPanelTitle(activeDocument);
      this.panel.webview.options = {
        enableScripts: true,
        localResourceRoots: resolveLocalResourceRoots(activeDocument.uri, this.extensionUri)
      };
    }

    await this.renderDocumentToPanel(activeDocument);
  }

  /**
   * 释放控制器资源。
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * 创建预览面板与固定 HTML 外壳。
   * @param document 当前 Markdown 文档。
   * @returns Webview 预览面板。
   */
  private createPreviewPanel(document: vscode.TextDocument): vscode.WebviewPanel {
    // 面板标题。
    const panelTitle = createPreviewPanelTitle(document);
    // 面板可访问资源根目录。
    const localResourceRoots = resolveLocalResourceRoots(document.uri, this.extensionUri);

    // 关键步骤：创建独立 Webview 预览面板。
    const panel = vscode.window.createWebviewPanel(
      PREVIEW_WEBVIEW_VIEW_TYPE,
      panelTitle,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots
      }
    );

    // 预览样式 URI。
    const previewStylesUri = resolvePreviewStylesUri(panel.webview, this.extensionUri);
    // 预览 runtime URI。
    const previewRuntimeScriptUri = resolvePreviewRuntimeScriptUri(panel.webview, this.extensionUri);

    panel.webview.html = createPreviewShellHtml(
      panel.webview,
      previewStylesUri.toString(),
      previewRuntimeScriptUri.toString()
    );

    return panel;
  }

  /**
   * 注册面板销毁与消息监听。
   * @param panel 目标面板。
   */
  private registerPanelListeners(panel: vscode.WebviewPanel): void {
    // 面板销毁监听。
    const panelDisposeDisposable = panel.onDidDispose(() => {
      this.panel = undefined;
      this.previewDocumentUriText = undefined;
      this.previewScrollPercentage = 0;
    });

    // Webview 消息监听。
    const messageDisposable = panel.webview.onDidReceiveMessage((message: unknown) => {
      // 规范化后的消息。
      const normalizedMessage = normalizeWebviewMessage(message);

      if (!normalizedMessage) {
        return;
      }

      if (normalizedMessage.type === PREVIEW_READY_MESSAGE_TYPE) {
        // Webview runtime 就绪后，补发一次当前文档内容，避免首帧竞态。
        const previewDocument = this.getPreviewDocument();

        if (previewDocument) {
          void this.renderDocumentToPanel(previewDocument);
        }

        return;
      }

      if (normalizedMessage.type === PREVIEW_SCROLL_CHANGED_MESSAGE_TYPE) {
        // 记录预览滚动比例，为后续双向同步做准备。
        const scrollPercentage = normalizedMessage.scrollPercentage ?? 0;
        this.previewScrollPercentage = clampScrollPercentage(scrollPercentage);
      }
    });

    this.disposables.push(panelDisposeDisposable, messageDisposable);
  }

  /**
   * 读取当前预览绑定文档。
   * @returns 文档对象，不存在时返回 undefined。
   */
  private getPreviewDocument(): vscode.TextDocument | undefined {
    // 当前预览绑定文档 URI。
    const previewDocumentUriText = this.previewDocumentUriText;

    if (!previewDocumentUriText) {
      return undefined;
    }

    return vscode.workspace.textDocuments.find(
      (openedDocument) => openedDocument.uri.toString() === previewDocumentUriText
    );
  }

  /**
   * 渲染文档并把结果推送给 Webview。
   * @param document 待渲染文档。
   */
  private async renderDocumentToPanel(document: vscode.TextDocument): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      // Markdown 原始文本。
      const markdownSource = document.getText();
      // 统一使用共享渲染核心执行 Markdown -> HTML。
      const renderedHtml = await renderMarkdownPreview(markdownSource);
      // 当前文档目录在 Webview 中的 base URI。
      const baseUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(document.uri, ".."));

      this.panel.title = createPreviewPanelTitle(document);

      await this.panel.webview.postMessage({
        type: RENDER_CONTENT_MESSAGE_TYPE,
        renderedHtml,
        baseHref: ensureTrailingSlash(baseUri.toString())
      });

      await this.panel.webview.postMessage({
        type: SET_PREVIEW_SCROLL_MESSAGE_TYPE,
        scrollPercentage: this.previewScrollPercentage
      });
    } catch (error) {
      // 渲染错误文本。
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 转义后的安全错误文本。
      const safeErrorMessage = escapeHtmlText(errorMessage);

      await this.panel.webview.postMessage({
        type: RENDER_CONTENT_MESSAGE_TYPE,
        renderedHtml: `<h2>渲染失败</h2><pre>${safeErrorMessage}</pre>`,
        baseHref: ""
      });
    }
  }
}

/**
 * 插件激活入口。
 * @param context VS Code 扩展上下文。
 */
export function activate(context: vscode.ExtensionContext): void {
  // 预览控制器实例。
  const previewController = new ScribdownPreviewController(context.extensionUri);
  // 打开预览命令。
  const previewCommand = vscode.commands.registerCommand(OPEN_PREVIEW_COMMAND, async () => {
    await previewController.openPreviewForActiveMarkdown();
  });

  context.subscriptions.push(previewController, previewCommand);
}

/**
 * 插件停用入口。
 */
export function deactivate(): void {
  // 当前模式下没有额外全局资源需要释放。
}

/**
 * 读取当前激活 Markdown 文档。
 * @returns 当前文档，不存在时返回 undefined。
 */
function getActiveMarkdownDocument(): vscode.TextDocument | undefined {
  // 当前激活编辑器。
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    return undefined;
  }

  // 当前编辑器文档。
  const activeDocument = activeEditor.document;

  if (activeDocument.languageId !== MARKDOWN_LANGUAGE_ID) {
    return undefined;
  }

  return activeDocument;
}

/**
 * 计算 Webview 可访问资源根目录。
 * @param documentUri 当前文档 URI。
 * @param extensionUri 当前扩展目录 URI。
 * @returns 资源根目录数组。
 */
function resolveLocalResourceRoots(documentUri: vscode.Uri, extensionUri: vscode.Uri): vscode.Uri[] {
  // 工作区根目录集合。
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  // 工作区 URI 数组。
  const workspaceUris = workspaceFolders.map((folder) => folder.uri);
  // 当前文档目录 URI。
  const documentDirectoryUri = vscode.Uri.joinPath(documentUri, "..");
  // Webview UI 目录 URI。
  const previewUiDirectoryUri = resolvePreviewUiDirectoryUri(extensionUri);

  return [...workspaceUris, documentDirectoryUri, previewUiDirectoryUri];
}

/**
 * 创建预览面板标题。
 * @param document 当前文档对象。
 * @returns 预览标题。
 */
function createPreviewPanelTitle(document: vscode.TextDocument): string {
  // 文档展示名。
  const documentDisplayName = resolveDocumentDisplayName(document);

  return `${PROJECT_NAME} Preview · ${documentDisplayName}`;
}

/**
 * 生成 Webview 固定外壳 HTML。
 * @param webview 当前 Webview。
 * @param previewStylesHref 样式地址。
 * @param previewRuntimeScriptHref 运行时脚本地址。
 * @returns HTML 字符串。
 */
function createPreviewShellHtml(
  webview: vscode.Webview,
  previewStylesHref: string,
  previewRuntimeScriptHref: string
): string {
  // 当前文档随机 nonce。
  const scriptNonce = createNonce();
  // Webview CSP 源。
  const cspSource = webview.cspSource;
  // runtime 初始化脚本文本。
  const runtimeBootstrapScript = createRuntimeBootstrapScript();

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${scriptNonce}';"
    />
    <base id="${PREVIEW_BASE_ELEMENT_ID}" href="" />
    <title>${PROJECT_NAME} Preview</title>
    <link rel="stylesheet" href="${previewStylesHref}" />
  </head>
  <body class="${SCRIBDOWN_PAGE_CLASS_NAME}">
    <main class="${SCRIBDOWN_APP_CLASS_NAME}">
      <article
        id="${PREVIEW_ROOT_ELEMENT_ID}"
        class="${SCRIBDOWN_MARKDOWN_CLASS_NAME}"
        data-preview-title="${VSCODE_PREVIEW_TITLE}"
      ></article>
    </main>
    <script src="${previewRuntimeScriptHref}"></script>
    <script nonce="${scriptNonce}">
${runtimeBootstrapScript}
    </script>
  </body>
</html>`;
}

/**
 * 生成 runtime 初始化脚本。
 * @returns 内联脚本字符串。
 */
function createRuntimeBootstrapScript(): string {
  // runtime 初始化入参。
  const runtimeBootstrapOptions = {
    previewRootElementId: PREVIEW_ROOT_ELEMENT_ID,
    previewBaseElementId: PREVIEW_BASE_ELEMENT_ID,
    renderContentMessageType: RENDER_CONTENT_MESSAGE_TYPE,
    setPreviewScrollMessageType: SET_PREVIEW_SCROLL_MESSAGE_TYPE,
    previewReadyMessageType: PREVIEW_READY_MESSAGE_TYPE,
    previewScrollChangedMessageType: PREVIEW_SCROLL_CHANGED_MESSAGE_TYPE
  };
  // JSON 序列化后的初始化入参。
  const runtimeBootstrapOptionsText = JSON.stringify(runtimeBootstrapOptions);
  // runtime 全局变量名字符串。
  const runtimeGlobalNameText = JSON.stringify(WEBVIEW_RUNTIME_GLOBAL_NAME);

  return `(() => {
  const runtimeGlobalName = ${runtimeGlobalNameText};
  const runtimeModule = globalThis[runtimeGlobalName];

  if (!runtimeModule || typeof runtimeModule.bootstrapVscodePreviewRuntime !== "function") {
    return;
  }

  runtimeModule.bootstrapVscodePreviewRuntime(${runtimeBootstrapOptionsText});
})();`;
}

/**
 * 解析 Webview UI 目录 URI。
 * @param extensionUri 当前扩展目录 URI。
 * @returns Webview UI 目录 URI。
 */
function resolvePreviewUiDirectoryUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, "dist", WEBVIEW_UI_DIRECTORY_NAME);
}

/**
 * 解析 Webview 样式资源 URI。
 * @param webview 当前 Webview。
 * @param extensionUri 当前扩展目录 URI。
 * @returns 样式资源 URI。
 */
function resolvePreviewStylesUri(webview: vscode.Webview, extensionUri: vscode.Uri): vscode.Uri {
  // Webview UI 目录 URI。
  const previewUiDirectoryUri = resolvePreviewUiDirectoryUri(extensionUri);
  // 样式文件绝对 URI。
  const previewStylesAbsoluteUri = vscode.Uri.joinPath(
    previewUiDirectoryUri,
    WEBVIEW_UI_STYLE_FILE_NAME
  );

  return webview.asWebviewUri(previewStylesAbsoluteUri);
}

/**
 * 解析 Webview runtime 资源 URI。
 * @param webview 当前 Webview。
 * @param extensionUri 当前扩展目录 URI。
 * @returns runtime 资源 URI。
 */
function resolvePreviewRuntimeScriptUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): vscode.Uri {
  // Webview UI 目录 URI。
  const previewUiDirectoryUri = resolvePreviewUiDirectoryUri(extensionUri);
  // runtime 文件绝对 URI。
  const previewRuntimeAbsoluteUri = vscode.Uri.joinPath(
    previewUiDirectoryUri,
    WEBVIEW_UI_RUNTIME_FILE_NAME
  );

  return webview.asWebviewUri(previewRuntimeAbsoluteUri);
}

/**
 * 生成随机 nonce。
 * @returns nonce 字符串。
 */
function createNonce(): string {
  // nonce 字符集。
  const nonceCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // nonce 固定长度。
  const nonceLength = 32;
  // nonce 结果累积值。
  let nonceText = "";

  for (let index = 0; index < nonceLength; index += 1) {
    // 当前字符随机索引。
    const randomIndex = Math.floor(Math.random() * nonceCharacters.length);
    nonceText += nonceCharacters[randomIndex] ?? "";
  }

  return nonceText;
}

/**
 * 规范化 Webview 消息对象。
 * @param message 原始消息。
 * @returns 规范化结果，不合法时返回 undefined。
 */
function normalizeWebviewMessage(message: unknown): PreviewMessagePayload | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  // 原始消息记录对象。
  const messageRecord = message as Record<string, unknown>;
  // 消息类型字段。
  const typeField = messageRecord.type;

  if (typeof typeField !== "string") {
    return undefined;
  }

  // 消息滚动百分比字段。
  const scrollPercentageField = messageRecord.scrollPercentage;

  return {
    type: typeField,
    scrollPercentage: typeof scrollPercentageField === "number" ? scrollPercentageField : undefined
  };
}

/**
 * 约束滚动百分比到 0~1。
 * @param value 原始值。
 * @returns 约束后的值。
 */
function clampScrollPercentage(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 确保字符串以 `/` 结尾。
 * @param value 输入字符串。
 * @returns 处理后的字符串。
 */
function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

/**
 * 转义 HTML 文本。
 * @param unsafeText 原始文本。
 * @returns 安全文本。
 */
function escapeHtmlText(unsafeText: string): string {
  return unsafeText
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * 解析文档展示名。
 * @param document 当前文档。
 * @returns 展示文件名。
 */
function resolveDocumentDisplayName(document: vscode.TextDocument): string {
  // 文档路径分段。
  const pathSegments = document.uri.path.split("/");
  // 尾段文件名。
  const tailSegment = pathSegments[pathSegments.length - 1];

  return tailSegment || "Untitled";
}
