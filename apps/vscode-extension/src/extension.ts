import * as vscode from "vscode";
import { renderMarkdown } from "@scribdown/markdown-renderer";
import {
  MARKDOWN_LANGUAGE_ID,
  OPEN_PREVIEW_COMMAND,
  PROJECT_NAME,
  SCRIBDOWN_APP_CLASS_NAME,
  SCRIBDOWN_MARKDOWN_CLASS_NAME,
  SCRIBDOWN_PAGE_CLASS_NAME,
  SOURCE_LINE_ACTIVE_CLASS_NAME,
  SOURCE_LINE_OFFSCREEN_HINT_BOTTOM_CLASS_NAME,
  SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME,
  SOURCE_LINE_OFFSCREEN_HINT_TOP_CLASS_NAME
} from "@scribdown/shared";

/** VS Code Webview 预览面板的标题文本，用于 data-preview-title 标识。 */
const PREVIEW_TITLE = "VS Code Preview";

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
 * Extension -> Webview 消息类型：按源码行号设置预览滚动位置。
 */
const SET_PREVIEW_SCROLL_MESSAGE_TYPE = "set-preview-scroll";

/**
 * Extension -> Webview 消息类型：按源码行号高亮并定位光标所在预览块。
 */
const SET_PREVIEW_CURSOR_MESSAGE_TYPE = "set-preview-cursor";

/**
 * Extension -> Webview 消息类型：清除光标定位高亮。
 */
const CLEAR_PREVIEW_CURSOR_MESSAGE_TYPE = "clear-preview-cursor";

/**
 * 滚动同步驱动方枚举。
 */
const SCROLL_SYNC_SOURCE = {
  /** 编辑器驱动预览滚动。 */
  editor: "editor",
  /** 预览驱动编辑器滚动。 */
  preview: "preview"
} as const;

/**
 * 滚动同步驱动方类型。
 */
type ScrollSyncSource = (typeof SCROLL_SYNC_SOURCE)[keyof typeof SCROLL_SYNC_SOURCE];

/**
 * 滚动同步驱动方在无新事件后保留的毫秒数，用于过滤另一侧的回声事件。
 */
const SCROLL_SYNC_SOURCE_RETENTION_MS = 250;

/**
 * 编辑器滚动同步的节流间隔（毫秒），约一帧；高频可视区变化合并到该间隔内发送。
 */
const EDITOR_SCROLL_SYNC_THROTTLE_MS = 16;

/**
 * Webview 消息最小结构。
 */
interface PreviewMessagePayload {
  type: string;
  sourceLine?: number;
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
   * 当前滚动同步驱动方，用于过滤另一侧的回声事件。
   */
  private scrollSyncSource: ScrollSyncSource | undefined;

  /**
   * 滚动同步驱动方过期重置定时器。
   */
  private scrollSyncResetTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * 编辑器滚动同步节流的尾随发送定时器。
   */
  private editorScrollThrottleTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * 编辑器滚动同步上次实际发送的时间戳（毫秒）。
   */
  private editorScrollLastSentAt = 0;

  /**
   * 编辑器滚动同步节流间隔内待发送的最新源码行号；undefined 表示无待发送值。
   */
  private editorScrollPendingLine: number | undefined;

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

    // 编辑器可视区变化监听：将编辑器滚动同步到预览。
    const changeVisibleRangesDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(
      (event) => {
        // 当前事件编辑器文档 URI。
        const editorDocumentUriText = event.textEditor.document.uri.toString();

        if (!this.panel || editorDocumentUriText !== this.previewDocumentUriText) {
          return;
        }

        this.handleEditorScroll(event);
      }
    );

    // 编辑器光标变化监听：把光标所在源码行同步为预览高亮与定位。
    const changeSelectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      // 当前事件编辑器文档 URI。
      const editorDocumentUriText = event.textEditor.document.uri.toString();

      if (!this.panel || editorDocumentUriText !== this.previewDocumentUriText) {
        return;
      }

      this.handleEditorCursorChange(event);
    });

    // 激活编辑器变化监听：光标离开绑定文档时清除高亮，切回时按光标重新高亮。
    const changeActiveEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!this.panel) {
        return;
      }

      this.handleActiveEditorChange(editor);
    });

    this.disposables.push(
      changeDocumentDisposable,
      changeVisibleRangesDisposable,
      changeSelectionDisposable,
      changeActiveEditorDisposable
    );
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

    if (!this.panel) {
      // 首次打开时创建新面板。
      this.panel = this.createPreviewPanel(activeDocument);
      this.registerPanelListeners(this.panel);
    } else {
      // 已有面板时通过命令显式打开：把焦点带到预览面板。
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    await this.bindPanelToDocument(activeDocument);
  }

  /**
   * 把当前预览面板绑定到指定 Markdown 文档：更新标题、资源根目录与渲染内容。
   * 仅更新绑定与内容，不调用 panel.reveal，避免抢占用户焦点。
   * @param document 目标 Markdown 文档。
   */
  private async bindPanelToDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.panel) {
      return;
    }

    // 关键步骤：切换绑定文档时清理滚动同步状态，避免上一个文档的驱动方残留过滤掉新文档的首次同步。
    this.clearScrollSync();

    // 记录当前预览绑定文档 URI。
    this.previewDocumentUriText = document.uri.toString();
    this.panel.title = createPreviewPanelTitle(document);
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: resolveLocalResourceRoots(document.uri, this.extensionUri)
    };

    await this.renderDocumentToPanel(document);
  }

  /**
   * 释放控制器资源。
   */
  public dispose(): void {
    this.clearScrollSync();
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
        // 启用 VS Code 内置查找控件，使 Webview 内 Cmd/Ctrl+F 可弹出搜索框。
        enableFindWidget: true,
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
      this.clearScrollSync();
      this.panel = undefined;
      this.previewDocumentUriText = undefined;
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
        // 预览上报的顶部源码行号。
        const sourceLine = normalizedMessage.sourceLine ?? 1;
        this.handlePreviewScroll(sourceLine);
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
      const renderedHtml = await renderMarkdown(markdownSource);
      // 当前文档目录在 Webview 中的 base URI。
      const baseUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(document.uri, ".."));

      this.panel.title = createPreviewPanelTitle(document);

      await this.panel.webview.postMessage({
        type: RENDER_CONTENT_MESSAGE_TYPE,
        renderedHtml,
        baseHref: ensureTrailingSlash(baseUri.toString())
      });

      // 关键步骤：morphdom 增量更新会原地保留预览滚动位置，重渲染后无需再恢复滚动。
      // 首次打开预览时需把预览对齐到编辑器顶部可见行，并按光标位置重新应用高亮。
      const previewEditor = this.getPreviewEditor();

      if (previewEditor) {
        this.postEditorScrollSync(resolveEditorTopLine(previewEditor));
        this.postPreviewCursorSync(resolveCursorSourceLine(previewEditor));
      }
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

  /**
   * 处理编辑器可视区变化，按顶部可视行把编辑器滚动同步到预览。
   * @param event 编辑器可视区变化事件。
   */
  private handleEditorScroll(event: vscode.TextEditorVisibleRangesChangeEvent): void {
    // 预览驱动滚动时，编辑器侧变化属于回声，跳过以避免循环。
    if (this.scrollSyncSource === SCROLL_SYNC_SOURCE.preview) {
      return;
    }

    // 首个可视行范围。
    const firstVisibleRange = event.visibleRanges[0];

    if (!firstVisibleRange) {
      return;
    }

    // 顶部可视行对应的源码行号（编辑器行号 0-based，源码行号 1-based）。
    const sourceLine = firstVisibleRange.start.line + 1;

    this.scheduleEditorScrollSync(sourceLine);
  }

  /**
   * 以节流方式把编辑器滚动同步到预览：节流间隔外立即发送（leading），
   * 间隔内仅记录最新行号并安排一次尾随发送（trailing），避免拖动时高频发消息。
   * @param sourceLine 顶部可视行对应的源码行号（1-based）。
   */
  private scheduleEditorScrollSync(sourceLine: number): void {
    // 当前时间戳。
    const nowMs = Date.now();
    // 距上次实际发送经过的毫秒数。
    const elapsedMs = nowMs - this.editorScrollLastSentAt;

    if (elapsedMs >= EDITOR_SCROLL_SYNC_THROTTLE_MS) {
      // 已超出节流间隔，立即发送并清理待发送状态。
      this.editorScrollLastSentAt = nowMs;
      this.editorScrollPendingLine = undefined;

      if (this.editorScrollThrottleTimer) {
        clearTimeout(this.editorScrollThrottleTimer);
        this.editorScrollThrottleTimer = undefined;
      }

      this.postEditorScrollSync(sourceLine);
      return;
    }

    // 处于节流间隔内：记录最新行号，已有尾随定时器则复用。
    this.editorScrollPendingLine = sourceLine;

    if (this.editorScrollThrottleTimer) {
      return;
    }

    // 关键步骤：安排一次尾随发送，确保停止滚动后预览停在最终位置。
    this.editorScrollThrottleTimer = setTimeout(() => {
      this.editorScrollThrottleTimer = undefined;

      // 尾随发送时的待发送行号。
      const pendingLine = this.editorScrollPendingLine;
      this.editorScrollPendingLine = undefined;

      if (pendingLine !== undefined) {
        this.editorScrollLastSentAt = Date.now();
        this.postEditorScrollSync(pendingLine);
      }
    }, EDITOR_SCROLL_SYNC_THROTTLE_MS - elapsedMs);
  }

  /**
   * 实际向预览发送编辑器滚动同步消息，并标记编辑器为当前驱动方。
   * @param sourceLine 顶部可视行对应的源码行号（1-based）。
   */
  private postEditorScrollSync(sourceLine: number): void {
    // 关键步骤：标记编辑器为当前驱动方，过滤预览侧回声。
    this.markScrollSyncSource(SCROLL_SYNC_SOURCE.editor);

    void this.panel?.webview.postMessage({
      type: SET_PREVIEW_SCROLL_MESSAGE_TYPE,
      sourceLine
    });
  }

  /**
   * 处理编辑器光标变化，把光标所在源码行同步到预览高亮。
   * @param event 编辑器选区变化事件。
   */
  private handleEditorCursorChange(event: vscode.TextEditorSelectionChangeEvent): void {
    this.postPreviewCursorSync(resolveCursorSourceLine(event.textEditor));
  }

  /**
   * 向预览发送光标高亮消息。
   * 仅更新光标所在块的高亮浮层，不触发滚动；滚动统一由编辑器可视区同步处理。
   * @param sourceLine 光标所在源码行号（1-based）。
   */
  private postPreviewCursorSync(sourceLine: number): void {
    void this.panel?.webview.postMessage({
      type: SET_PREVIEW_CURSOR_MESSAGE_TYPE,
      sourceLine
    });
  }

  /**
   * 处理激活编辑器变化：切到其他 Markdown 文档时自动重新绑定预览；
   * 切回当前绑定文档时按光标重新高亮；切到非 Markdown 文档时清除高亮。
   * @param activeEditor 当前激活编辑器，可能为 undefined。
   */
  private handleActiveEditorChange(activeEditor: vscode.TextEditor | undefined): void {
    if (
      activeEditor &&
      activeEditor.document.uri.toString() === this.previewDocumentUriText
    ) {
      // 切回绑定文档，按顶部可视行重新对齐预览，并按光标位置重新高亮。
      this.postEditorScrollSync(resolveEditorTopLine(activeEditor));
      this.postPreviewCursorSync(resolveCursorSourceLine(activeEditor));
      return;
    }

    if (activeEditor && activeEditor.document.languageId === MARKDOWN_LANGUAGE_ID) {
      // 关键步骤：切到其他 Markdown 文档时，自动把预览重新绑定到新文档。
      void this.bindPanelToDocument(activeEditor.document);
      return;
    }

    // 光标离开绑定文档且未切到其他 Markdown 文档，清除预览高亮。
    this.postClearPreviewCursor();
  }

  /**
   * 通知预览清除光标定位高亮。
   */
  private postClearPreviewCursor(): void {
    void this.panel?.webview.postMessage({ type: CLEAR_PREVIEW_CURSOR_MESSAGE_TYPE });
  }

  /**
   * 读取当前预览绑定文档对应的可见编辑器。
   * @returns 对应可见编辑器；不存在时返回 undefined。
   */
  private getPreviewEditor(): vscode.TextEditor | undefined {
    return vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === this.previewDocumentUriText
    );
  }

  /**
   * 处理预览滚动上报，按源码行号把预览滚动同步到编辑器。
   * @param sourceLine 预览顶部对应的源码行号（1-based，可能为小数）。
   */
  private handlePreviewScroll(sourceLine: number): void {
    // 编辑器驱动滚动时，预览侧上报属于回声，跳过以避免循环。
    if (this.scrollSyncSource === SCROLL_SYNC_SOURCE.editor) {
      return;
    }

    // 当前预览绑定文档对应的可见编辑器。
    const previewEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === this.previewDocumentUriText
    );

    if (!previewEditor) {
      return;
    }

    // 文档总行数。
    const lineCount = previewEditor.document.lineCount;
    // 目标顶部行号（源码行号 1-based 转编辑器行号 0-based 并约束到有效区间）。
    const targetLine = Math.min(lineCount - 1, Math.max(0, Math.round(sourceLine) - 1));
    // 目标行区间。
    const targetRange = new vscode.Range(targetLine, 0, targetLine, 0);

    // 关键步骤：标记预览为当前驱动方，过滤编辑器侧回声。
    this.markScrollSyncSource(SCROLL_SYNC_SOURCE.preview);
    previewEditor.revealRange(targetRange, vscode.TextEditorRevealType.AtTop);
  }

  /**
   * 标记当前滚动同步驱动方，并在静默一段时间后自动释放。
   * @param source 当前驱动方。
   */
  private markScrollSyncSource(source: ScrollSyncSource): void {
    this.scrollSyncSource = source;

    if (this.scrollSyncResetTimer) {
      clearTimeout(this.scrollSyncResetTimer);
    }

    // 关键步骤：驱动方在静默后释放，允许另一侧重新接管滚动。
    this.scrollSyncResetTimer = setTimeout(() => {
      this.scrollSyncSource = undefined;
      this.scrollSyncResetTimer = undefined;
    }, SCROLL_SYNC_SOURCE_RETENTION_MS);
  }

  /**
   * 清理滚动同步状态与定时器。
   */
  private clearScrollSync(): void {
    if (this.scrollSyncResetTimer) {
      clearTimeout(this.scrollSyncResetTimer);
      this.scrollSyncResetTimer = undefined;
    }

    if (this.editorScrollThrottleTimer) {
      clearTimeout(this.editorScrollThrottleTimer);
      this.editorScrollThrottleTimer = undefined;
    }

    this.scrollSyncSource = undefined;
    this.editorScrollPendingLine = undefined;
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
 * 计算编辑器光标所在源码行号。
 * @param editor 目标编辑器。
 * @returns 光标所在源码行号（1-based）。
 */
function resolveCursorSourceLine(editor: vscode.TextEditor): number {
  return editor.selection.active.line + 1;
}

/**
 * 计算编辑器顶部可视行对应的源码行号。
 * @param editor 目标编辑器。
 * @returns 顶部可视行源码行号（1-based）；无可视范围时回退到光标行。
 */
function resolveEditorTopLine(editor: vscode.TextEditor): number {
  // 首个可视行范围。
  const visibleRange = editor.visibleRanges[0];

  return (visibleRange ? visibleRange.start.line : editor.selection.active.line) + 1;
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
      content="default-src 'none'; img-src ${cspSource} https: data:; media-src ${cspSource} https: data: blob:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${scriptNonce}';"
    />
    <base id="${PREVIEW_BASE_ELEMENT_ID}" href="" />
    <title>${PROJECT_NAME} Preview</title>
    <link rel="stylesheet" href="${previewStylesHref}" />
    <style>
      .${SOURCE_LINE_ACTIVE_CLASS_NAME} {
        position: absolute;
        z-index: 2147483646;
        pointer-events: none;
        border-radius: 4px;
        background-color: rgba(255, 184, 0, 0.4);
        box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.4);
        /* 高亮仅出现 1s 后淡出，提示当前光标所在源码行 */
        animation: ${SOURCE_LINE_ACTIVE_CLASS_NAME}-flash 1s ease-out forwards;
      }
      @keyframes ${SOURCE_LINE_ACTIVE_CLASS_NAME}-flash {
        0%,
        70% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }
      .${SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME} {
        position: fixed;
        left: 0;
        right: 0;
        height: 28px;
        z-index: 2147483646;
        pointer-events: none;
        opacity: 0;
      }
      /* 高亮块在视口上方：顶部弧形辉光闪一下，提示向上 */
      .${SOURCE_LINE_OFFSCREEN_HINT_TOP_CLASS_NAME} {
        top: 0;
        background: radial-gradient(
          ellipse 100% 100% at 50% 0%,
          rgba(255, 184, 0, 0.55),
          transparent 72%
        );
        animation: ${SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME}-flash 0.8s ease-out forwards;
      }
      /* 高亮块在视口下方：底部弧形辉光闪一下，提示向下 */
      .${SOURCE_LINE_OFFSCREEN_HINT_BOTTOM_CLASS_NAME} {
        bottom: 0;
        background: radial-gradient(
          ellipse 100% 100% at 50% 100%,
          rgba(255, 184, 0, 0.55),
          transparent 72%
        );
        animation: ${SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME}-flash 0.8s ease-out forwards;
      }
      @keyframes ${SOURCE_LINE_OFFSCREEN_HINT_CLASS_NAME}-flash {
        0% {
          opacity: 0;
        }
        35% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }
    </style>
  </head>
  <body class="${SCRIBDOWN_PAGE_CLASS_NAME}">
    <main class="${SCRIBDOWN_APP_CLASS_NAME}">
      <article
        id="${PREVIEW_ROOT_ELEMENT_ID}"
        class="${SCRIBDOWN_MARKDOWN_CLASS_NAME}"
        data-preview-title="${PREVIEW_TITLE}"
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
    setPreviewCursorMessageType: SET_PREVIEW_CURSOR_MESSAGE_TYPE,
    clearPreviewCursorMessageType: CLEAR_PREVIEW_CURSOR_MESSAGE_TYPE,
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

  // 消息源码行号字段。
  const sourceLineField = messageRecord.sourceLine;

  return {
    type: typeField,
    sourceLine: typeof sourceLineField === "number" ? sourceLineField : undefined
  };
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
