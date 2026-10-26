/**
 * 数学公式：remark-math 解析后的边界校验、清洗后 KaTeX 排版与块级公式复制控件。
 * KaTeX 在 sanitize 之后执行（与 Shiki 高亮相同），输出由 KaTeX 在 `trust: false` 下生成，
 * 不放行 \href / \includegraphics / \htmlClass 等可引入 URL 或任意属性的命令。
 */

import {
  MATH_CLASS_NAME,
  MATH_COPY_BUTTON_CLASS_NAME,
  MATH_DISPLAY_CLASS_NAME,
  MATH_DISPLAY_DELIMITER,
  MATH_ERROR_CLASS_NAME,
  MATH_INLINE_CLASS_NAME,
  MATH_INLINE_DELIMITER,
  MATH_LANGUAGE_ID,
  MATH_MESSAGE_CLASS_NAME,
  MATH_SCROLL_CLASS_NAME,
  MATH_SOURCE_CLASS_NAME,
  t
} from "@scribdown/shared";
import katex from "katex";
import type { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";

import { decodeHtmlEntities } from "../code/code-highlight";
import {
  copyMarkdownTextWithFeedback,
  createMarkdownCopyButton,
  readMarkdownSource
} from "../core/copy-control";

// 清洗后块级公式（`$$…$$` 与 ```math）的 HTML 形态。
// 捕获 pre 与 code 上的源码行号等属性：`$$` 公式挂在 pre 上，```math 围栏挂在 code 上。
const MATH_DISPLAY_PATTERN = new RegExp(
  `<pre([^>]*)><code class="language-${MATH_LANGUAGE_ID}"([^>]*)>([\\s\\S]*?)</code></pre>`,
  "gu"
);

// 清洗后行内公式的 HTML 形态；块级公式已先行替换，剩余匹配均为行内。
const MATH_INLINE_PATTERN = new RegExp(
  `<code class="language-${MATH_LANGUAGE_ID}"[^>]*>([\\s\\S]*?)</code>`,
  "gu"
);

// 判断字符是否为空白，用于行内公式定界符边界校验。
const WHITESPACE_PATTERN = /\s/u;

// 判断字符是否为数字，`$5 and $10` 中闭合 `$` 后紧跟数字时视为货币。
const DIGIT_PATTERN = /\d/u;

// 需要转义的 HTML 特殊字符。
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

// 已绑定复制事件的块级公式复制按钮；WeakSet 不会把 detached 节点的状态误带到 clone。
const boundMathCopyButtonElements = new WeakSet<HTMLButtonElement>();

// 已注册选区复制监听的 document，每个 document 只注册一次。
const boundMathCopyDocuments = new WeakSet<Document>();

// KaTeX MathML 中保存 TeX 原文的 annotation 选择器。
const MATH_TEX_ANNOTATION_SELECTOR = 'annotation[encoding="application/x-tex"]';

/**
 * remark 插件：按 Pandoc 规则校验单个 `$` 包裹的行内公式，避免把货币金额误判为公式。
 * 开头 `$` 后、结尾 `$` 前不能是空白，结尾 `$` 后不能紧跟数字；不满足时还原为原文。
 * @param markdownText 完整 Markdown 原文，用于读取定界符和闭合符后的字符。
 * @returns Markdown AST 转换器。
 */
function remarkMathBoundaries(markdownText: string): (tree: Root) => void {
  return (tree) => {
    visit(tree, "inlineMath", (node, index, parent) => {
      /** 节点在原文中的起止偏移。 */
      const startOffset = node.position?.start.offset;
      /** 节点在原文中的结束偏移（不含）。 */
      const endOffset = node.position?.end.offset;
      if (!parent || index === undefined || startOffset === undefined || endOffset === undefined) {
        return;
      }
      /** 含定界符的原文。 */
      const rawText = markdownText.slice(startOffset, endOffset);
      // `$$…$$` 行内写法语义明确，不做货币判断。
      if (rawText.startsWith(MATH_DISPLAY_DELIMITER)) {
        return;
      }
      /** 闭合 `$` 之后的首个字符。 */
      const nextCharacter = markdownText.charAt(endOffset);
      /** 是否违反 Pandoc 行内公式边界规则。 */
      const isInvalidBoundary =
        WHITESPACE_PATTERN.test(rawText.charAt(MATH_INLINE_DELIMITER.length)) ||
        WHITESPACE_PATTERN.test(
          rawText.charAt(rawText.length - MATH_INLINE_DELIMITER.length - 1)
        ) ||
        DIGIT_PATTERN.test(nextCharacter);
      if (!isInvalidBoundary) {
        return;
      }
      // 关键步骤：还原为原文文本，保留美元符号与中间内容。
      parent.children[index] = { type: "text", value: rawText, position: node.position };
      return SKIP;
    });
  };
}

/**
 * 转义 HTML 特殊字符。
 * @param text 原始文本。
 * @returns 可安全插入 HTML 文本或属性值的字符串。
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/gu, (character) => HTML_ESCAPE_MAP[character] ?? character);
}

/**
 * 使用 KaTeX 排版单个公式。
 * @param texSource 公式 TeX 原文。
 * @param displayMode 是否为块级公式。
 * @returns 排版后的 HTML，或解析失败时的错误信息。
 */
function typesetMath(
  texSource: string,
  displayMode: boolean
): { html: string; error?: undefined } | { html?: undefined; error: string } {
  try {
    return {
      html: katex.renderToString(texSource, {
        displayMode,
        // 关键步骤：错误时抛出并由调用方回退为原文，避免 KaTeX 的红色半成品替代可读原文。
        throwOnError: true,
        // 不信任文档内容：禁用 \href、\url、\includegraphics、\html* 等命令。
        trust: false,
        // 中文等非 ASCII 字符在数学模式下仅影响字形度量，不输出控制台警告。
        strict: "ignore",
        output: "htmlAndMathml"
      })
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 把清洗后的块级公式节点替换为 KaTeX 排版结果。
 * @param preAttributes pre / code 标签上保留的属性文本（源码行号、Markdown 原文）。
 * @param encodedSource HTML 转义后的公式原文。
 * @returns 块级公式 HTML。
 */
function renderDisplayMath(preAttributes: string, encodedSource: string): string {
  /** 公式 TeX 原文。 */
  const texSource = decodeHtmlEntities(encodedSource);
  /** KaTeX 排版结果。 */
  const result = typesetMath(texSource, true);
  if (result.html !== undefined) {
    return `<div class="${MATH_CLASS_NAME} ${MATH_DISPLAY_CLASS_NAME}"${preAttributes}><div class="${MATH_SCROLL_CLASS_NAME}">${result.html}</div></div>`;
  }
  // 关键步骤：解析失败时展示原文与局部错误提示，不影响文档其余部分。
  return (
    `<div class="${MATH_CLASS_NAME} ${MATH_DISPLAY_CLASS_NAME} ${MATH_ERROR_CLASS_NAME}" role="note"${preAttributes}>` +
    `<div class="${MATH_SCROLL_CLASS_NAME}"><code class="${MATH_SOURCE_CLASS_NAME}">${encodedSource}</code></div>` +
    `<p class="${MATH_MESSAGE_CLASS_NAME}">${escapeHtml(result.error)}</p></div>`
  );
}

/**
 * 把清洗后的行内公式节点替换为 KaTeX 排版结果。
 * @param encodedSource HTML 转义后的公式原文。
 * @returns 行内公式 HTML。
 */
function renderInlineMath(encodedSource: string): string {
  /** KaTeX 排版结果。 */
  const result = typesetMath(decodeHtmlEntities(encodedSource), false);
  if (result.html !== undefined) {
    return `<span class="${MATH_CLASS_NAME} ${MATH_INLINE_CLASS_NAME}">${result.html}</span>`;
  }
  // 行内错误以带定界符的原文展示，悬停 title 查看错误原因。
  return `<span class="${MATH_CLASS_NAME} ${MATH_INLINE_CLASS_NAME} ${MATH_ERROR_CLASS_NAME}" title="${escapeHtml(result.error)}">${MATH_INLINE_DELIMITER}${encodedSource}${MATH_INLINE_DELIMITER}</span>`;
}

/**
 * 把渲染 HTML 中的公式节点替换为 KaTeX 排版结果，须在 sanitize 之后、Shiki 高亮之前调用。
 * @param html 已清洗的 HTML 文本。
 * @returns 含公式排版的 HTML 文本。
 */
function typesetMarkdownMath(html: string): string {
  if (!html.includes(`language-${MATH_LANGUAGE_ID}`)) {
    return html;
  }
  return html
    .replace(
      MATH_DISPLAY_PATTERN,
      (_matched, preAttributes: string, codeAttributes: string, encodedSource: string) =>
        renderDisplayMath(`${preAttributes}${codeAttributes}`, encodedSource)
    )
    .replace(MATH_INLINE_PATTERN, (_matched, encodedSource: string) =>
      renderInlineMath(encodedSource)
    );
}

/**
 * 为根节点内的块级公式挂载复制按钮，并启用选区复制 TeX 原文。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMathBlocks(rootElement: ParentNode): void {
  // 当前根节点内的块级公式。
  const displayElements = rootElement.querySelectorAll<HTMLElement>(`.${MATH_DISPLAY_CLASS_NAME}`);
  displayElements.forEach(ensureMathCopyButton);

  // 关键步骤：存在公式时注册选区复制监听，选中公式复制时写入 TeX 原文而非排版字形。
  /** 首个公式节点，用于取得所属 document。 */
  const firstMathElement = rootElement.querySelector(`.${MATH_CLASS_NAME}`);
  /** 公式所属 document。 */
  const ownerDocument = firstMathElement?.ownerDocument;
  if (ownerDocument && !boundMathCopyDocuments.has(ownerDocument)) {
    ownerDocument.addEventListener("copy", handleMathSelectionCopy);
    boundMathCopyDocuments.add(ownerDocument);
  }
}

/**
 * 选区复制：选区端点落在公式内时扩展到整条公式，并把纯文本中的公式替换为带定界符的 TeX 原文。
 * 行为与 KaTeX contrib/copy-tex 一致，在此内联实现以避免其导入时绑定全局 document。
 * @param event 复制事件。
 */
function handleMathSelectionCopy(event: ClipboardEvent): void {
  /** 事件所属 document。 */
  const ownerDocument = (event.currentTarget as Document | null) ?? document;
  /** 当前选区。 */
  const selection = ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !event.clipboardData) {
    return;
  }
  /** 选区范围。 */
  const range = selection.getRangeAt(0);
  /** 选区起点所在公式。 */
  const startKatex = closestKatexElement(range.startContainer);
  /** 选区终点所在公式。 */
  const endKatex = closestKatexElement(range.endContainer);
  if (startKatex) range.setStartBefore(startKatex);
  if (endKatex) range.setEndAfter(endKatex);

  /** 选区内容副本。 */
  const fragment = range.cloneContents();
  if (!fragment.querySelector(MATH_TEX_ANNOTATION_SELECTOR)) {
    return;
  }
  /** 保留常规富文本粘贴行为的 HTML。 */
  const container = ownerDocument.createElement("div");
  container.append(fragment.cloneNode(true));
  event.clipboardData.setData("text/html", container.innerHTML);

  // 关键步骤：用 annotation 中的 TeX 替换整条 KaTeX 输出，块级加 `$$`、行内加 `$`。
  fragment.querySelectorAll<HTMLElement>(".katex").forEach((katexElement) => {
    /** 公式 TeX 原文。 */
    const texSource = katexElement.querySelector(MATH_TEX_ANNOTATION_SELECTOR)?.textContent;
    if (texSource === null || texSource === undefined) return;
    /** 是否为块级公式。 */
    const isDisplay = katexElement.parentElement?.classList.contains("katex-display") ?? false;
    /** 公式定界符。 */
    const delimiter = isDisplay ? MATH_DISPLAY_DELIMITER : MATH_INLINE_DELIMITER;
    katexElement.replaceWith(ownerDocument.createTextNode(`${delimiter}${texSource}${delimiter}`));
  });
  event.clipboardData.setData("text/plain", fragment.textContent ?? "");
  event.preventDefault();
}

/**
 * 查找节点所在的 KaTeX 公式根节点。
 * @param node 选区端点节点。
 * @returns KaTeX 根节点；不在公式内时为 null。
 */
function closestKatexElement(node: Node): Element | null {
  /** 文本节点向上取父元素后再查找。 */
  const element = node.nodeType === node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest(".katex") ?? null;
}

/**
 * 确保块级公式右上角存在已绑定事件的复制按钮。
 * @param displayElement 块级公式根节点。
 */
function ensureMathCopyButton(displayElement: HTMLElement): void {
  // 已存在的复制按钮（morphdom 更新后可能保留）。
  let copyButtonElement = displayElement.querySelector<HTMLButtonElement>(
    `:scope > .${MATH_COPY_BUTTON_CLASS_NAME}`
  );
  if (!copyButtonElement) {
    copyButtonElement = createMarkdownCopyButton(displayElement.ownerDocument, t("math.copy"));
    copyButtonElement.classList.add(MATH_COPY_BUTTON_CLASS_NAME);
    displayElement.append(copyButtonElement);
  }
  if (boundMathCopyButtonElements.has(copyButtonElement)) {
    return;
  }
  copyButtonElement.addEventListener("click", handleMathCopyClick);
  boundMathCopyButtonElements.add(copyButtonElement);
}

/**
 * 处理块级公式复制按钮点击，复制解析阶段保存的 Markdown 原文。
 * @param event 复制按钮点击事件。
 */
function handleMathCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 按钮所属块级公式。
  const displayElement = copyButtonElement.closest<HTMLElement>(`.${MATH_DISPLAY_CLASS_NAME}`);
  if (!displayElement) {
    return;
  }
  /** 公式原文；缺失时退回 MathML annotation 中的 TeX。 */
  const mathText =
    readMarkdownSource(displayElement) ??
    displayElement.querySelector(MATH_TEX_ANNOTATION_SELECTOR)?.textContent ??
    "";
  void copyMarkdownTextWithFeedback(copyButtonElement, mathText, t("math.copy"));
}

export { hydrateMathBlocks, remarkMathBoundaries, typesetMarkdownMath };
