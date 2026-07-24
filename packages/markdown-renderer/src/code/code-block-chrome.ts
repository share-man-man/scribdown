/**
 * 代码块 chrome hydration：把渲染后的 pre 包装为带语言标签、
 * 复制按钮与固定行号列的 figure 结构。
 */

import {
  CODE_BLOCK_BODY_CLASS_NAME,
  CODE_BLOCK_CHROME_CLASS_NAME,
  CODE_BLOCK_CLASS_NAME,
  CODE_BLOCK_COPY_CLASS_NAME,
  CODE_BLOCK_COPY_ICON_CHECK_CLASS_NAME,
  CODE_BLOCK_COPY_ICON_CLASS_NAME,
  CODE_BLOCK_COPY_ICON_COPY_CLASS_NAME,
  CODE_BLOCK_GUTTER_CLASS_NAME,
  CODE_BLOCK_GUTTER_LINE_CLASS_NAME,
  CODE_BLOCK_LANG_CLASS_NAME,
  CODE_BLOCK_LINE_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE,
  t
} from "@scribdown/shared";

// 代码块空行占位文本，避免空 span 被浏览器完全折叠。
const CODE_BLOCK_EMPTY_LINE_PLACEHOLDER = "\u200b";

// 代码块运行时已绑定标记的 dataset 键。
const CODE_BLOCK_HYDRATED_DATA_KEY = "scribdownCodeBlockHydrated";

// 代码语言标识 → 展示标签的映射。
const CODE_LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  graphql: "GraphQL",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kotlin: "Kotlin",
  less: "Less",
  markdown: "Markdown",
  md: "Markdown",
  php: "PHP",
  python: "Python",
  py: "Python",
  ruby: "Ruby",
  rust: "Rust",
  rs: "Rust",
  sass: "Sass",
  scss: "SCSS",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  swift: "Swift",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  vue: "Vue",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  zsh: "Zsh"
};

// 代码块语言标识缺省值。
const CODE_LANGUAGE_DEFAULT_LABEL = "Text";

// 代码块复制按钮已复制状态恢复延迟，单位毫秒。
const CODE_BLOCK_COPY_RESTORE_DELAY_MS = 1600;

/**
 * 把渲染后的代码块包装为带语言标签、复制按钮与行号的 chrome 结构。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateCodeBlocks(rootElement: ParentNode): void {
  // 当前根节点内的所有未绑定 chrome 的 pre 元素。
  const preElements = rootElement.querySelectorAll<HTMLPreElement>("pre");

  preElements.forEach(decorateCodeBlock);
}

/**
 * 给单个 pre 元素加上 chrome 结构与复制行为。
 * @param preElement 渲染产出的 pre 元素。
 */
function decorateCodeBlock(preElement: HTMLPreElement): void {
  // 已经包裹过 figure 时直接跳过，避免重复 hydrate。
  if (preElement.parentElement?.classList.contains(CODE_BLOCK_CLASS_NAME)) {
    return;
  }

  if (preElement.dataset[CODE_BLOCK_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  // pre 内部的 code 元素，无 code 子节点时认定为非代码块。
  const codeElement = preElement.querySelector<HTMLElement>(":scope > code");

  if (!codeElement) {
    return;
  }

  preElement.dataset[CODE_BLOCK_HYDRATED_DATA_KEY] = "true";

  // 当前 pre 所属的 document，用于创建子节点。
  const ownerDocument = preElement.ownerDocument;
  // 代码块语言标识。
  const languageId = resolveCodeBlockLanguageId(codeElement);
  // 语言展示标签。
  const languageLabel = resolveCodeBlockLanguageLabel(languageId);

  // 关键步骤：在替换 DOM 前抓取原始代码文本，便于复制按钮使用。
  const originalCodeText = codeElement.textContent ?? "";

  // 把代码内容按行拆分为带类名的 span，并得到总行数用于固定行号列。
  const codeLineCount = rewriteCodeBlockLines(codeElement, ownerDocument);

  // 顶部 chrome 区域，承载语言标签与复制按钮。
  const chromeElement = ownerDocument.createElement("div");
  chromeElement.className = CODE_BLOCK_CHROME_CLASS_NAME;

  // 语言标签元素。
  const langElement = ownerDocument.createElement("span");
  langElement.className = CODE_BLOCK_LANG_CLASS_NAME;
  langElement.textContent = languageLabel;
  chromeElement.append(langElement);

  // 复制按钮元素。
  const copyButtonElement = createCodeBlockCopyButton(ownerDocument);
  chromeElement.append(copyButtonElement);

  // 外层 figure 容器，让 chrome 与 pre 在同一手绘边框内。
  const figureElement = ownerDocument.createElement("figure");
  figureElement.className = CODE_BLOCK_CLASS_NAME;
  figureElement.dataset.scribdownCodeLang = languageId;

  // 正文容器，用于独立绘制代码区分隔线和纸面。
  const bodyElement = ownerDocument.createElement("div");
  bodyElement.className = CODE_BLOCK_BODY_CLASS_NAME;

  // 固定宽度行号列，作为 pre 的兄弟节点独立布局，不跟随代码横向滚动。
  const gutterElement = createCodeBlockLineNumberGutter(ownerDocument, codeLineCount);

  // 把 pre 替换为 figure，再把 chrome + body + 原 pre 放进 figure。
  preElement.replaceWith(figureElement);
  bodyElement.append(gutterElement, preElement);
  figureElement.append(chromeElement, bodyElement);

  // 关键步骤：把源码行锚点从内层 code 迁移到最外层 figure，
  // 使编辑器光标定位的高亮能覆盖整个代码块（含顶部 chrome）。
  // remark-rehype 把 code 节点的 data-source-line 落在 code 元素上，而非 pre。
  const codeBlockSourceLine = codeElement.getAttribute(SOURCE_LINE_DATA_ATTRIBUTE);

  if (codeBlockSourceLine !== null) {
    figureElement.setAttribute(SOURCE_LINE_DATA_ATTRIBUTE, codeBlockSourceLine);
    codeElement.removeAttribute(SOURCE_LINE_DATA_ATTRIBUTE);
  }

  // 在按钮上记录原始代码文本，复制时直接读取，无需再走 DOM。
  copyButtonElement.dataset.scribdownCodeSource = originalCodeText;
  copyButtonElement.addEventListener("click", handleCodeBlockCopyClick);
}

/**
 * 解析 pre > code 节点的语言标识。
 * @param codeElement pre 内部的 code 元素。
 * @returns 语言标识，未识别时返回空字符串。
 */
function resolveCodeBlockLanguageId(codeElement: HTMLElement): string {
  // class 列表中以 language- 开头的类名记录了语言标识。
  const languageClassName = Array.from(codeElement.classList).find((className) =>
    className.startsWith("language-")
  );

  if (!languageClassName) {
    return "";
  }

  return languageClassName.slice("language-".length).toLowerCase();
}

/**
 * 把语言标识转换为可读展示标签。
 * @param languageId 语言标识。
 * @returns 用于 chrome 的语言展示文本。
 */
function resolveCodeBlockLanguageLabel(languageId: string): string {
  if (!languageId) {
    return CODE_LANGUAGE_DEFAULT_LABEL;
  }

  // 优先使用预定义映射，未命中时退化为首字母大写。
  const mappedLabel = CODE_LANGUAGE_DISPLAY_NAMES[languageId];

  if (mappedLabel) {
    return mappedLabel;
  }

  return languageId.charAt(0).toUpperCase() + languageId.slice(1);
}

/**
 * 把代码内容按行拆分为带类名的 span。
 * Shiki 已经输出 `<span class="line">` 时直接复用并补充类名，否则做纯文本拆分。
 * @param codeElement pre 内部的 code 元素。
 * @param ownerDocument 当前 document。
 * @returns 当前代码块拆分后的总行数。
 */
function rewriteCodeBlockLines(codeElement: HTMLElement, ownerDocument: Document): number {
  // Shiki 高亮输出的行 span 列表。
  const shikiLineElements = codeElement.querySelectorAll<HTMLElement>(":scope > span.line");

  if (shikiLineElements.length > 0) {
    // Shiki 行节点数组，用于重排 code 子节点并移除行间格式化换行。
    const shikiLineNodes = Array.from(shikiLineElements);

    shikiLineElements.forEach((lineElement) => {
      lineElement.classList.add(CODE_BLOCK_LINE_CLASS_NAME);
      // 空行使用零宽占位，行高统一继承 pre 的设置。
      if (lineElement.textContent === "") {
        lineElement.textContent = CODE_BLOCK_EMPTY_LINE_PLACEHOLDER;
      }
    });

    // 关键步骤：删除 Shiki 在行 span 之间输出的换行文本节点，避免 pre 把它们渲染成额外行距。
    codeElement.replaceChildren(...shikiLineNodes);
    return shikiLineNodes.length;
  }

  // 代码块的全部文本内容。
  const codeText = codeElement.textContent ?? "";
  // 去掉结尾多余换行，避免最后多出一个空行号。
  const trimmedCodeText = codeText.replace(/\n+$/u, "");
  // 按换行符切分得到每一行原文。
  const codeLines = trimmedCodeText.split("\n");

  // 清空 code 现有子节点，重新生成行容器。
  while (codeElement.firstChild) {
    codeElement.removeChild(codeElement.firstChild);
  }

  codeLines.forEach((lineText) => {
    // 当前行的 span 容器，依赖 CSS `display: block` 提供视觉换行。
    const lineElement = ownerDocument.createElement("span");
    lineElement.className = CODE_BLOCK_LINE_CLASS_NAME;
    // 空行使用零宽占位，行高统一继承 pre 的设置。
    if (lineText.length === 0) {
      lineElement.textContent = CODE_BLOCK_EMPTY_LINE_PLACEHOLDER;
    } else {
      lineElement.textContent = lineText;
    }
    codeElement.append(lineElement);
  });

  return codeLines.length;
}

/**
 * 创建代码块左侧固定行号列，保证行号区不参与横向滚动。
 * @param ownerDocument 当前 document。
 * @param lineCount 代码总行数。
 * @returns 已填充行号文本的固定列容器。
 */
function createCodeBlockLineNumberGutter(
  ownerDocument: Document,
  lineCount: number
): HTMLDivElement {
  // 行号固定列容器。
  const gutterElement = ownerDocument.createElement("div");
  gutterElement.className = CODE_BLOCK_GUTTER_CLASS_NAME;

  // 当前循环行索引（0-based），用于生成 1-based 行号文本。
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    // 当前行号文本（1-based）。
    const lineNumberText = String(lineIndex + 1);
    // 单行行号节点。
    const lineNumberElement = ownerDocument.createElement("span");
    lineNumberElement.className = CODE_BLOCK_GUTTER_LINE_CLASS_NAME;
    lineNumberElement.textContent = lineNumberText;
    gutterElement.append(lineNumberElement);
  }

  return gutterElement;
}

/**
 * "复制"态图标的 SVG 内部路径（双层叠放的矩形 + 复笔），
 * 直接内嵌以便用 currentColor 跟随按钮 hover / focus 颜色。
 */
const CODE_BLOCK_COPY_ICON_COPY_PATHS =
  '<path d="M8.4 6.8 C10.4 6.5 12.6 6.7 14.6 6.6 C16 6.6 16.5 7.2 16.6 8.6 C16.7 10.8 16.6 13.2 16.6 15.4 C16.5 16.6 15.8 17.2 14.6 17.2 C12.4 17.3 10.2 17.2 8 17.2 C6.6 17.2 6.2 16.6 6.2 15.4 C6.2 13.2 6.2 11 6.2 8.8 C6.2 7.4 6.8 6.8 8.4 6.8 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M8.6 7.4 C10.6 7.2 12.6 7.4 14.4 7.3" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>' +
  '<path d="M3.6 12.8 C3.4 11.0 3.4 9.0 3.5 7.0 C3.5 5.0 3.4 3.6 5.2 3.4 C7.2 3.2 9.2 3.4 11.2 3.4 C12.6 3.4 13.2 4.0 13.3 5.0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M4.4 12.4 C4.2 10.6 4.2 8.8 4.2 7.0" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>';

/**
 * "已复制"态图标的 SVG 内部路径（对勾 + 复笔），currentColor 由按钮状态控制。
 */
const CODE_BLOCK_COPY_ICON_CHECK_PATHS =
  '<path d="M4.2 10.6 C5.6 11.8 6.8 13.2 8.2 14.6 C10.4 11.6 13.0 8.6 16.0 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M4.6 11.4 C5.6 12.4 6.8 13.6 7.8 14.6 C10.2 12.2 12.6 9.6 15.2 7.0" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.42"/>';

/**
 * 创建代码块复制按钮节点，仅包含图标，无文字标签。
 * @param ownerDocument 当前 document。
 * @returns 已配置类名与 aria 信息的按钮元素。
 */
function createCodeBlockCopyButton(ownerDocument: Document): HTMLButtonElement {
  // 复制按钮元素。
  const copyButtonElement = ownerDocument.createElement("button");
  copyButtonElement.type = "button";
  copyButtonElement.className = CODE_BLOCK_COPY_CLASS_NAME;
  copyButtonElement.setAttribute("aria-label", t("code.copy"));

  // 默认 "copy" 状态图标。
  const copyIconElement = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  copyIconElement.setAttribute(
    "class",
    `${CODE_BLOCK_COPY_ICON_CLASS_NAME} ${CODE_BLOCK_COPY_ICON_COPY_CLASS_NAME}`
  );
  copyIconElement.setAttribute("viewBox", "0 0 20 20");
  copyIconElement.setAttribute("aria-hidden", "true");
  copyIconElement.setAttribute("focusable", "false");
  copyIconElement.innerHTML = CODE_BLOCK_COPY_ICON_COPY_PATHS;
  copyButtonElement.append(copyIconElement);

  // "已复制" 状态图标，初始隐藏，由 CSS 根据 data 属性切换显示。
  const checkIconElement = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  checkIconElement.setAttribute(
    "class",
    `${CODE_BLOCK_COPY_ICON_CLASS_NAME} ${CODE_BLOCK_COPY_ICON_CHECK_CLASS_NAME}`
  );
  checkIconElement.setAttribute("viewBox", "0 0 20 20");
  checkIconElement.setAttribute("aria-hidden", "true");
  checkIconElement.setAttribute("focusable", "false");
  checkIconElement.innerHTML = CODE_BLOCK_COPY_ICON_CHECK_PATHS;
  copyButtonElement.append(checkIconElement);

  return copyButtonElement;
}

/**
 * 处理代码块复制按钮点击事件。
 * @param event 复制按钮点击事件。
 */
function handleCodeBlockCopyClick(event: MouseEvent): void {
  // 被点击的复制按钮元素。
  const copyButtonElement = event.currentTarget as HTMLButtonElement;
  // 待复制的代码文本。
  const codeText = copyButtonElement.dataset.scribdownCodeSource ?? "";

  void writeCodeBlockTextToClipboard(codeText).then((isSucceeded) => {
    if (isSucceeded) {
      flashCodeBlockCopyButton(copyButtonElement);
    }
  });
}

/**
 * 把代码文本写入剪贴板，兼容不支持 navigator.clipboard 的环境。
 * @param codeText 待复制的代码文本。
 * @returns 是否复制成功。
 */
async function writeCodeBlockTextToClipboard(codeText: string): Promise<boolean> {
  // 现代浏览器优先使用 navigator.clipboard。
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(codeText);
      return true;
    } catch {
      // 安全上下文外可能会抛出，回落到 execCommand 兜底。
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  // 兜底：用临时 textarea + execCommand 完成复制。
  const fallbackTextarea = document.createElement("textarea");
  fallbackTextarea.value = codeText;
  fallbackTextarea.setAttribute("readonly", "");
  fallbackTextarea.style.position = "fixed";
  fallbackTextarea.style.opacity = "0";
  fallbackTextarea.style.pointerEvents = "none";
  document.body.append(fallbackTextarea);
  fallbackTextarea.select();

  // 兼容旧浏览器的 execCommand 返回值。
  const isSucceeded = document.execCommand("copy");

  fallbackTextarea.remove();
  return isSucceeded;
}

/**
 * 让复制按钮短暂显示已复制状态。
 * @param copyButtonElement 被点击的复制按钮。
 */
function flashCodeBlockCopyButton(copyButtonElement: HTMLButtonElement): void {
  // 切换 data 属性 + aria-label，CSS 会根据 data 属性切换两张 SVG 图标。
  copyButtonElement.dataset.scribdownCodeCopied = "true";
  copyButtonElement.setAttribute("aria-label", t("code.copied"));

  // 延迟恢复初始状态，给用户一个肉眼可见的反馈窗口。
  window.setTimeout(() => {
    delete copyButtonElement.dataset.scribdownCodeCopied;
    copyButtonElement.setAttribute("aria-label", t("code.copy"));
  }, CODE_BLOCK_COPY_RESTORE_DELAY_MS);
}

export { hydrateCodeBlocks, CODE_BLOCK_HYDRATED_DATA_KEY };
