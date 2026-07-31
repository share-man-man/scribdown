/**
 * Markdown 内容复制控件：统一复制图标、剪贴板兼容逻辑与成功反馈。
 */

import {
  CONTENT_COPY_BUTTON_CLASS_NAME,
  CONTENT_COPY_ICON_CHECK_CLASS_NAME,
  CONTENT_COPY_ICON_CLASS_NAME,
  CONTENT_COPY_ICON_COPY_CLASS_NAME,
  t
} from "@scribdown/shared";

// 复制成功状态恢复延迟，单位毫秒。
const CONTENT_COPY_RESTORE_DELAY_MS = 1600;

// 复制按钮默认图标路径。
const CONTENT_COPY_ICON_PATHS =
  '<path d="M8.4 6.8 C10.4 6.5 12.6 6.7 14.6 6.6 C16 6.6 16.5 7.2 16.6 8.6 C16.7 10.8 16.6 13.2 16.6 15.4 C16.5 16.6 15.8 17.2 14.6 17.2 C12.4 17.3 10.2 17.2 8 17.2 C6.6 17.2 6.2 16.6 6.2 15.4 C6.2 13.2 6.2 11 6.2 8.8 C6.2 7.4 6.8 6.8 8.4 6.8 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M3.6 12.8 C3.4 11 3.4 9 3.5 7 C3.5 5 3.4 3.6 5.2 3.4 C7.2 3.2 9.2 3.4 11.2 3.4 C12.6 3.4 13.2 4 13.3 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';

// 复制成功图标路径。
const CONTENT_COPY_CHECK_PATHS =
  '<path d="M4.2 10.6 C5.6 11.8 6.8 13.2 8.2 14.6 C10.4 11.6 13 8.6 16 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M4.6 11.4 C5.6 12.4 6.8 13.6 7.8 14.6 C10.2 12.2 12.6 9.6 15.2 7" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>';

/**
 * 创建通用内容复制按钮。
 * @param ownerDocument 当前内容所属 document。
 * @param ariaLabel 默认可访问名称。
 * @returns 已配置图标与类型的按钮。
 */
function createMarkdownCopyButton(
  ownerDocument: Document,
  ariaLabel: string = t("content.copy")
): HTMLButtonElement {
  // 复制按钮。
  const buttonElement = ownerDocument.createElement("button");
  // 默认复制图标。
  const copyIconElement = createMarkdownCopyIcon(
    ownerDocument,
    CONTENT_COPY_ICON_COPY_CLASS_NAME,
    CONTENT_COPY_ICON_PATHS
  );
  // 复制成功图标。
  const checkIconElement = createMarkdownCopyIcon(
    ownerDocument,
    CONTENT_COPY_ICON_CHECK_CLASS_NAME,
    CONTENT_COPY_CHECK_PATHS
  );

  buttonElement.type = "button";
  buttonElement.className = CONTENT_COPY_BUTTON_CLASS_NAME;
  buttonElement.setAttribute("aria-label", ariaLabel);
  buttonElement.append(copyIconElement, checkIconElement);
  return buttonElement;
}

/**
 * 创建复制按钮内的 SVG 图标。
 * @param ownerDocument 当前内容所属 document。
 * @param modifierClassName 图标状态修饰类名。
 * @param iconPaths 图标 path 字符串。
 * @returns SVG 图标元素。
 */
function createMarkdownCopyIcon(
  ownerDocument: Document,
  modifierClassName: string,
  iconPaths: string
): SVGSVGElement {
  // SVG 图标节点。
  const iconElement = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  iconElement.setAttribute("class", `${CONTENT_COPY_ICON_CLASS_NAME} ${modifierClassName}`);
  iconElement.setAttribute("viewBox", "0 0 20 20");
  iconElement.setAttribute("aria-hidden", "true");
  iconElement.setAttribute("focusable", "false");
  iconElement.innerHTML = iconPaths;
  return iconElement;
}

/**
 * 复制文本，并在成功时短暂切换按钮状态。
 * @param buttonElement 触发复制的按钮。
 * @param text 待复制文本。
 * @param defaultAriaLabel 成功反馈结束后恢复的可访问名称。
 * @returns 是否复制成功。
 */
async function copyMarkdownTextWithFeedback(
  buttonElement: HTMLButtonElement,
  text: string,
  defaultAriaLabel: string = t("content.copy")
): Promise<boolean> {
  // 剪贴板写入结果。
  const isSucceeded = await writeMarkdownTextToClipboard(buttonElement.ownerDocument, text);
  if (!isSucceeded) {
    return false;
  }

  buttonElement.dataset.scribdownCopied = "true";
  buttonElement.setAttribute("aria-label", t("content.copied"));

  // 按钮所属窗口，用于隔离 iframe / Webview 的定时器环境。
  const ownerWindow = buttonElement.ownerDocument.defaultView;
  ownerWindow?.setTimeout(() => {
    delete buttonElement.dataset.scribdownCopied;
    buttonElement.setAttribute("aria-label", defaultAriaLabel);
  }, CONTENT_COPY_RESTORE_DELAY_MS);
  return true;
}

/**
 * 把文本写入剪贴板，兼容不支持 Clipboard API 的宿主。
 * @param ownerDocument 当前内容所属 document。
 * @param text 待复制文本。
 * @returns 是否复制成功。
 */
async function writeMarkdownTextToClipboard(
  ownerDocument: Document,
  text: string
): Promise<boolean> {
  // 当前 document 对应的 navigator。
  const ownerNavigator = ownerDocument.defaultView?.navigator;
  if (ownerNavigator?.clipboard?.writeText) {
    try {
      await ownerNavigator.clipboard.writeText(text);
      return true;
    } catch {
      // 非安全上下文可能拒绝 Clipboard API，继续使用 execCommand 兜底。
    }
  }

  // 临时 textarea，用于兼容旧浏览器与部分 Webview。
  const fallbackTextarea = ownerDocument.createElement("textarea");
  fallbackTextarea.value = text;
  fallbackTextarea.setAttribute("readonly", "");
  fallbackTextarea.style.position = "fixed";
  fallbackTextarea.style.opacity = "0";
  fallbackTextarea.style.pointerEvents = "none";
  ownerDocument.body.append(fallbackTextarea);
  fallbackTextarea.select();

  // execCommand 的布尔返回值表示宿主是否接受复制命令。
  const isSucceeded = ownerDocument.execCommand("copy");
  fallbackTextarea.remove();
  return isSucceeded;
}

export { copyMarkdownTextWithFeedback, createMarkdownCopyButton };
