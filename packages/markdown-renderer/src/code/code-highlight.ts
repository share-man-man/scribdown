/**
 * 代码块语法高亮：Shiki 单例高亮器（eager + lazy grammar 加载）
 * 与渲染 HTML 字符串级别的代码块替换。
 */

import githubLightTheme from "@shikijs/themes/github-light";
import { type HighlighterCore, createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

import {
  CODE_HIGHLIGHTER_EAGER_LOADERS,
  CODE_HIGHLIGHTER_LAZY_LANGS
} from "./code-highlighter-langs";
import { MERMAID_LANGUAGE_ID } from "./mermaid";

// Shiki 高亮主题名（与 githubLightTheme 默认导出对应），用于 codeToHtml 选项。
const CODE_HIGHLIGHTER_THEME = "github-light";

// 单例 Shiki 高亮器的初始化 Promise，确保整个进程只初始化一次。
let codeHighlighterPromise: Promise<HighlighterCore> | undefined;

// 标记懒加载语言的请求去重：同一语言并发命中时复用同一 import Promise。
const codeHighlighterLazyLoadPromises = new Map<string, Promise<void>>();

// 匹配渲染后 `<pre ...><code class="language-X" ...>...</code></pre>` 的正则，用于 Shiki 替换。
// 捕获 pre 与 code（class 之后）的附加属性（如 data-source-line），替换时原样保留，
// 避免 remarkSourceLine 注入的 data-source-line 破坏匹配导致代码块不被高亮。
const CODE_BLOCK_HIGHLIGHT_PATTERN =
  /<pre([^>]*)><code class="language-([\w-]+)"([^>]*)>([\s\S]*?)<\/code><\/pre>/g;

// 提取 Shiki HTML 输出中 `<code>...</code>` 之间内容的正则。
const SHIKI_CODE_INNER_PATTERN = /<code[^>]*>([\s\S]*?)<\/code>/u;

/**
 * 取得（必要时初始化）Shiki 单例高亮器。
 * 使用 shiki/core + 显式 grammar 列表，避免默认 bundle 把 200+ 语言全部打进 dist。
 * @returns 已就绪的 Shiki 高亮器实例。
 */
async function getCodeHighlighter(): Promise<HighlighterCore> {
  if (!codeHighlighterPromise) {
    codeHighlighterPromise = createHighlighterCore({
      themes: [githubLightTheme],
      // eager loaders 通过动态 import 拆为独立 chunk，初始化时并发拉取；
      // 主 bundle 不再内联 grammar JSON，体积更小，多个 grammar 也可并行加载。
      langs: CODE_HIGHLIGHTER_EAGER_LOADERS,
      // oniguruma 引擎 + wasm；shiki/wasm 内部走 base64 内联，扩展环境无需额外资源声明。
      engine: createOnigurumaEngine(import("shiki/wasm"))
    });
  }

  return codeHighlighterPromise;
}

/**
 * 把渲染 HTML 中的代码块替换为 Shiki 高亮后的结构。
 * @param html 已渲染（可能已 sanitize）的 HTML 文本。
 * @returns 含高亮 span 的 HTML 文本。
 */
async function highlightMarkdownCodeBlocks(html: string): Promise<string> {
  if (!CODE_BLOCK_HIGHLIGHT_PATTERN.test(html)) {
    return html;
  }
  // RegExp 是 global 状态，重置 lastIndex 以保证多次调用一致。
  CODE_BLOCK_HIGHLIGHT_PATTERN.lastIndex = 0;

  // 取得 Shiki 单例高亮器。
  const highlighter = await getCodeHighlighter();
  // 替换累积器：从输入 HTML 起逐段拼接处理结果。
  let resultHtml = "";
  // 上一段未处理 HTML 的结束索引。
  let lastIndex = 0;

  for (const match of html.matchAll(CODE_BLOCK_HIGHLIGHT_PATTERN)) {
    const [matched, preAttributes, rawLanguage, codeAttributes, encodedCode] = match;
    const matchStart = match.index ?? 0;

    resultHtml += html.slice(lastIndex, matchStart);
    resultHtml += await highlightSingleCodeBlock(highlighter, {
      rawLanguage,
      encodedCode,
      matchedHtml: matched,
      preAttributes,
      codeAttributes
    });
    lastIndex = matchStart + matched.length;
  }

  resultHtml += html.slice(lastIndex);
  return resultHtml;
}

/**
 * 单个代码块的 Shiki 高亮入参。
 */
interface CodeBlockHighlightInput {
  /** 代码块标注的语言标识。 */
  rawLanguage: string;
  /** 已 HTML 转义的代码内容。 */
  encodedCode: string;
  /** 原始匹配片段，作为兜底返回值。 */
  matchedHtml: string;
  /** pre 标签上的附加属性文本，替换时原样保留。 */
  preAttributes: string;
  /** code 标签上 class 之后的附加属性文本（如 data-source-line），替换时原样保留。 */
  codeAttributes: string;
}

/**
 * 高亮单个代码块，必要时按需加载语言。
 * @param highlighter Shiki 高亮器实例。
 * @param input 代码块高亮入参。
 * @returns 高亮后的代码块 HTML。
 */
async function highlightSingleCodeBlock(
  highlighter: HighlighterCore,
  input: CodeBlockHighlightInput
): Promise<string> {
  // 代码块标注的语言标识。
  const { rawLanguage, encodedCode, matchedHtml, preAttributes, codeAttributes } = input;
  // 归一化语言标识：去除大小写差异，方便匹配 Shiki 内置名。
  const normalizedLanguage = rawLanguage.toLowerCase();

  // 关键步骤：mermaid 代码块跳过 Shiki 高亮，保留原始源码文本，
  // 后续 hydrate 阶段会读取 textContent 调用 mermaid 渲染。
  if (normalizedLanguage === MERMAID_LANGUAGE_ID) {
    return matchedHtml;
  }
  // Shiki 中真实可用的语言标识，找不到时退回 "text"。
  const resolvedLanguage = await ensureHighlighterLanguage(highlighter, normalizedLanguage);

  // 还原 HTML 转义，得到 Shiki 期望的原始代码。
  const codeText = decodeHtmlEntities(encodedCode);

  try {
    // Shiki 输出形如 `<pre class="shiki ..."><code><span class="line">...</span></code></pre>`。
    const highlightedHtml = highlighter.codeToHtml(codeText, {
      lang: resolvedLanguage,
      theme: CODE_HIGHLIGHTER_THEME
    });
    // 仅保留 `<code>` 内部内容，外层 `<pre><code>` 沿用原结构，便于 hydrate 识别。
    const innerMatch = highlightedHtml.match(SHIKI_CODE_INNER_PATTERN);
    const innerHtml = innerMatch?.[1] ?? encodedCode;

    return `<pre${preAttributes}><code class="language-${rawLanguage}"${codeAttributes}>${innerHtml}</code></pre>`;
  } catch {
    // Shiki 调用异常时（语言未注册等）原样返回，避免影响整体渲染。
    return matchedHtml;
  }
}

/**
 * 在 Shiki 高亮器里确保给定语言可用，必要时动态加载。
 * @param highlighter Shiki 高亮器实例。
 * @param normalizedLanguage 已归一化的语言标识。
 * @returns 高亮时可使用的语言标识。
 */
async function ensureHighlighterLanguage(
  highlighter: HighlighterCore,
  normalizedLanguage: string
): Promise<string> {
  if (normalizedLanguage.length === 0) {
    return "text";
  }

  // highlighter.getLoadedLanguages() 自带别名解析（grammar 自身声明的 aliases 也会被登记）。
  if (highlighter.getLoadedLanguages().includes(normalizedLanguage)) {
    return normalizedLanguage;
  }

  /** 从懒加载注册表查找对应 grammar import 函数。 */
  const lazyLoader = CODE_HIGHLIGHTER_LAZY_LANGS[normalizedLanguage];
  if (!lazyLoader) {
    return "text";
  }

  // 并发命中同一语言时复用同一 Promise，避免重复 import / loadLanguage。
  let pending = codeHighlighterLazyLoadPromises.get(normalizedLanguage);
  if (!pending) {
    pending = (async () => {
      const grammarModule = await lazyLoader();
      await highlighter.loadLanguage(grammarModule.default);
    })();
    codeHighlighterLazyLoadPromises.set(normalizedLanguage, pending);
  }

  try {
    await pending;
    return normalizedLanguage;
  } catch {
    // 关键步骤：失败的加载不留在缓存里，下次渲染可重试（与 mermaid loader 的失败重置策略一致），
    // 避免一次网络抖动后该语言永久退回纯文本。
    codeHighlighterLazyLoadPromises.delete(normalizedLanguage);
    return "text";
  }
}

// HTML 命名实体与对应字符的映射，覆盖代码块中常见的转义结果。
const HTML_NAMED_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  amp: "&"
};

// 匹配命名 / 十进制 / 十六进制三种字符实体；hex / dec 大小写均兼容。
const HTML_ENTITY_PATTERN = /&(?:(lt|gt|quot|apos|amp)|#x([0-9a-fA-F]+)|#(\d+));/g;

/**
 * 还原 HTML 文本中的字符实体（命名 + 十进制 + 十六进制）。
 *
 * 关键步骤：单次左到右扫描，避免“先解 `&amp;` 再解 `&lt;`”导致的二次解码漏洞，
 * 同时识别 `&#x3C;` 等十六进制实体（hast-util-to-html 在 Node 环境下会输出该形式）。
 *
 * @param encodedText HTML 转义后的文本。
 * @returns 还原后的原始文本。
 */
function decodeHtmlEntities(encodedText: string): string {
  return encodedText.replace(
    HTML_ENTITY_PATTERN,
    (matched, namedEntity?: string, hexCodePoint?: string, decimalCodePoint?: string) => {
      if (namedEntity) {
        return HTML_NAMED_ENTITIES[namedEntity] ?? matched;
      }
      if (hexCodePoint) {
        return safeFromCodePoint(parseInt(hexCodePoint, 16), matched);
      }
      if (decimalCodePoint) {
        return safeFromCodePoint(parseInt(decimalCodePoint, 10), matched);
      }
      return matched;
    }
  );
}

/**
 * 安全地把 Unicode 码点转成字符，越界 / NaN 时回退原始片段，避免抛错。
 * @param codePoint Unicode 码点（10/16 进制解析后的数值）。
 * @param fallback 解析失败时返回的原始 HTML 片段。
 * @returns 对应字符或原始片段。
 */
function safeFromCodePoint(codePoint: number, fallback: string): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

export { highlightMarkdownCodeBlocks };
