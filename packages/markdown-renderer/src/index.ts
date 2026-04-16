import DOMPurify from "dompurify";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighter } from "shiki";
import { unified } from "unified";

/**
 * Markdown 渲染参数。
 */
export interface RenderMarkdownOptions {
  sanitizeHtml?: boolean;
  sanitize?: (unsafeHtml: string) => string;
}

/**
 * 将 Markdown 文本转换为 HTML。
 * @param markdownText 输入的 Markdown 文本。
 * @param options 渲染控制参数。
 * @returns 渲染后的 HTML 文本。
 */
export async function renderMarkdown(markdownText: string, options: RenderMarkdownOptions = {}): Promise<string> {
  // 渲染流水线：先解析 Markdown，再转换为 HTML AST。
  const processor = unified().use(remarkParse).use(remarkRehype);

  if (options.sanitizeHtml) {
    // 关键步骤：在输出前执行 rehype 结构清洗。
    processor.use(rehypeSanitize);
  }

  processor.use(rehypeStringify);

  // 渲染输出 HTML 文本。
  const renderedHtml = String(await processor.process(markdownText));

  if (!options.sanitizeHtml) {
    return renderedHtml;
  }

  if (options.sanitize) {
    return options.sanitize(renderedHtml);
  }

  return sanitizeHtmlWithDomPurify(renderedHtml);
}

/**
 * 将代码片段渲染为高亮 HTML。
 * @param codeText 代码文本。
 * @param language 代码语言。
 * @returns 高亮后的 HTML 字符串。
 */
export async function renderCodeToHtml(codeText: string, language: string): Promise<string> {
  // 创建一次性高亮器用于最小可运行示例。
  const highlighter = await createHighlighter({
    themes: ["github-light"],
    langs: ["typescript", "javascript", "json", "bash", language]
  });

  return highlighter.codeToHtml(codeText, {
    lang: language,
    theme: "github-light"
  });
}

/**
 * 使用 DOMPurify 清洗 HTML。
 * @param unsafeHtml 未清洗的 HTML。
 * @returns 清洗后的 HTML。
 */
export function sanitizeHtmlWithDomPurify(unsafeHtml: string): string {
  return DOMPurify.sanitize(unsafeHtml);
}
