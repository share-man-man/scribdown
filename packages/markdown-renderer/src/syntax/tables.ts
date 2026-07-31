/**
 * 表格 hydration：为渲染后的表格增加右上角复制按钮。
 */

import { TABLE_COPY_BUTTON_CLASS_NAME, TABLE_WRAPPER_CLASS_NAME, t } from "@scribdown/shared";

import { copyMarkdownTextWithFeedback, createMarkdownCopyButton } from "../core/copy-control";

// 表格已 hydrate 的 dataset 键。
const TABLE_HYDRATED_DATA_KEY = "scribdownTableHydrated";

// 已绑定复制事件的真实按钮节点集合；WeakSet 不会把 detached 节点的状态误带到 clone。
const boundTableCopyButtonElements = new WeakSet<HTMLButtonElement>();

/**
 * 为根节点内的表格挂载复制控件。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMarkdownTables(rootElement: ParentNode): void {
  // 当前根节点内的所有表格。
  const tableElements = rootElement.querySelectorAll<HTMLTableElement>("table");
  tableElements.forEach(decorateMarkdownTable);
}

/**
 * 为单个表格创建交互壳层。
 * @param tableElement 待增强的表格。
 */
function decorateMarkdownTable(tableElement: HTMLTableElement): void {
  if (tableElement.parentElement?.classList.contains(TABLE_WRAPPER_CLASS_NAME)) {
    ensureMarkdownTableCopyBinding(tableElement.parentElement);
    return;
  }

  tableElement.dataset[TABLE_HYDRATED_DATA_KEY] = "true";

  // 表格所属 document。
  const ownerDocument = tableElement.ownerDocument;
  // 固定复制按钮的交互壳层。
  const wrapperElement = ownerDocument.createElement("div");
  // 表格复制按钮。
  const copyButtonElement = createMarkdownCopyButton(ownerDocument, t("table.copy"));

  wrapperElement.className = TABLE_WRAPPER_CLASS_NAME;
  copyButtonElement.classList.add(TABLE_COPY_BUTTON_CLASS_NAME);
  bindMarkdownTableCopyButton(copyButtonElement);

  tableElement.replaceWith(wrapperElement);
  wrapperElement.append(tableElement, copyButtonElement);
}

/**
 * 为已存在的表格壳层恢复复制事件。
 * @param wrapperElement 表格交互壳层。
 */
function ensureMarkdownTableCopyBinding(wrapperElement: Element): void {
  // 壳层内的表格复制按钮。
  const copyButtonElement = wrapperElement.querySelector<HTMLButtonElement>(
    `:scope > .${TABLE_COPY_BUTTON_CLASS_NAME}`
  );
  if (!copyButtonElement) {
    return;
  }
  bindMarkdownTableCopyButton(copyButtonElement);
}

/**
 * 为真实复制按钮节点绑定一次点击事件。
 * @param copyButtonElement 表格复制按钮。
 */
function bindMarkdownTableCopyButton(copyButtonElement: HTMLButtonElement): void {
  if (boundTableCopyButtonElements.has(copyButtonElement)) {
    return;
  }
  copyButtonElement.addEventListener("click", handleMarkdownTableCopyClick);
  boundTableCopyButtonElements.add(copyButtonElement);
}

/**
 * 处理表格复制按钮点击。
 * @param event 复制按钮点击事件。
 */
function handleMarkdownTableCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 按钮所属表格壳层。
  const wrapperElement = copyButtonElement.closest<HTMLElement>(`.${TABLE_WRAPPER_CLASS_NAME}`);
  // 壳层内的原始表格。
  const tableElement = wrapperElement?.querySelector<HTMLTableElement>(":scope > table");
  if (!tableElement) {
    return;
  }

  // 关键步骤：用 TSV 保留行列结构，粘贴到 Excel / Sheets / 文本编辑器均可用。
  const tableText = serializeMarkdownTableAsTsv(tableElement);
  void copyMarkdownTextWithFeedback(copyButtonElement, tableText, t("table.copy"));
}

/**
 * 把表格可见文本序列化为制表符分隔内容。
 * @param tableElement 待序列化表格。
 * @returns TSV 文本。
 */
function serializeMarkdownTableAsTsv(tableElement: HTMLTableElement): string {
  // 表格行数组。
  const tableRows = Array.from(tableElement.rows);
  return tableRows
    .map((rowElement) => {
      // 当前行的单元格文本。
      const cellTexts = Array.from(rowElement.cells).map((cellElement) =>
        (cellElement.innerText || cellElement.textContent || "")
          .replace(/\s*\n+\s*/gu, " ")
          .replace(/\t/gu, " ")
          .trim()
      );
      return cellTexts.join("\t");
    })
    .join("\n");
}

export { hydrateMarkdownTables, serializeMarkdownTableAsTsv, TABLE_HYDRATED_DATA_KEY };
