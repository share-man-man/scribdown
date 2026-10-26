// @vitest-environment jsdom
/** 通过真实渲染链路验证公式解析边界、错误回退、安全清洗与复制原文。 */
import {
  MARKDOWN_SOURCE_DATA_ATTRIBUTE,
  MATH_COPY_BUTTON_CLASS_NAME,
  MATH_DISPLAY_CLASS_NAME,
  MATH_ERROR_CLASS_NAME,
  MATH_INLINE_CLASS_NAME,
  MATH_MESSAGE_CLASS_NAME,
  MATH_SOURCE_CLASS_NAME,
  SOURCE_LINE_DATA_ATTRIBUTE
} from "@scribdown/shared";
import { describe, expect, it } from "vitest";
import { hydrateMarkdown, renderMarkdown } from "../index";

/**
 * 渲染 Markdown 并返回可查询的 DOM。
 * @param markdown 输入 Markdown。
 * @returns 安全清洗后的渲染容器。
 */
async function render(markdown: string): Promise<HTMLDivElement> {
  /** 测试渲染结果容器。 */
  const element = document.createElement("div");
  element.innerHTML = await renderMarkdown(markdown);
  return element;
}

describe("math", () => {
  it("typesets inline and display formulas with KaTeX", async () => {
    /** 含行内、块级与 ```math 围栏的文档。 */
    const element = await render(
      "质能方程 $E=mc^2$。\n\n$$\n\\frac{a}{b}\n$$\n\n```math\n\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}\n```"
    );
    /** 行内公式。 */
    const inline = element.querySelector(`.${MATH_INLINE_CLASS_NAME}`);
    expect(inline?.querySelector(".katex")).not.toBeNull();
    expect(inline?.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe(
      "E=mc^2"
    );
    /** 块级公式。 */
    const displays = element.querySelectorAll(`.${MATH_DISPLAY_CLASS_NAME}`);
    expect(displays).toHaveLength(2);
    displays.forEach((display) => {
      expect(display.querySelector(".katex-display")).not.toBeNull();
    });
    // 块级公式保留源码行号与原文，供滚动同步和复制使用。
    expect(displays[0].getAttribute(SOURCE_LINE_DATA_ATTRIBUTE)).toBe("3");
    expect(decodeURIComponent(displays[0].getAttribute(MARKDOWN_SOURCE_DATA_ATTRIBUTE) ?? "")).toBe(
      "$$\n\\frac{a}{b}\n$$"
    );
    expect(displays[1].getAttribute(SOURCE_LINE_DATA_ATTRIBUTE)).toBe("7");
    // 公式不再残留代码块结构，避免被 Shiki 或代码块 chrome 处理。
    expect(element.querySelector("pre")).toBeNull();
  });

  it("keeps currency, escaped dollars and code spans as text", async () => {
    /** 普通美元符号与代码内容。 */
    const element = await render(
      "价格 $5 和 $10。\n\n转义 \\$x\\$。\n\n空白 $ y $。\n\n代码 `$a$`。\n\n```\n$$b$$\n```"
    );
    expect(element.querySelector(".katex")).toBeNull();
    expect(element.textContent).toContain("价格 $5 和 $10");
    expect(element.textContent).toContain("转义 $x$");
    expect(element.textContent).toContain("空白 $ y $");
    expect(element.querySelector("p code")?.textContent).toBe("$a$");
    expect(element.querySelector("pre code")?.textContent?.trim()).toBe("$$b$$");
  });

  it("falls back to readable source on invalid formulas", async () => {
    /** 一个非法行内公式、一个非法块级公式与一个后续合法公式。 */
    const element = await render("坏 $\\frac{1}$ 好 $x$\n\n$$\n\\begin{matrix}\n$$\n");
    /** 行内错误节点。 */
    const inlineError = element.querySelector(
      `.${MATH_INLINE_CLASS_NAME}.${MATH_ERROR_CLASS_NAME}`
    );
    expect(inlineError?.textContent).toBe("$\\frac{1}$");
    expect(inlineError?.getAttribute("title")).toContain("KaTeX parse error");
    /** 块级错误节点。 */
    const displayError = element.querySelector(
      `.${MATH_DISPLAY_CLASS_NAME}.${MATH_ERROR_CLASS_NAME}`
    );
    expect(displayError?.querySelector(`.${MATH_SOURCE_CLASS_NAME}`)?.textContent).toBe(
      "\\begin{matrix}"
    );
    expect(displayError?.querySelector(`.${MATH_MESSAGE_CLASS_NAME}`)?.textContent).toContain(
      "KaTeX parse error"
    );
    // 错误公式不影响后续合法公式排版。
    expect(element.querySelectorAll(".katex")).toHaveLength(1);
  });

  it("rejects dangerous HTML and URLs inside formulas", async () => {
    /** 尝试通过公式注入链接、图片、HTML 属性与脚本。 */
    const element = await render(
      '$\\href{javascript:alert(1)}{x}$ $\\includegraphics{https://evil.test/a.png}$ $\\htmlClass{x}{y}$ $<img src=x onerror="alert(1)">$\n\n$$\n</code></pre><script>alert(1)</script>\n$$'
    );
    // 危险内容只作为 MathML annotation 中的 TeX 文本存在，不生成链接、资源或脚本。
    expect(element.querySelector("a, [href], [src]")).toBeNull();
    expect(element.querySelector("script")).toBeNull();
    expect(element.querySelector("[onerror]")).toBeNull();
  });

  it("adds a copy button that copies the original block source", async () => {
    /** 挂在 body 上的渲染容器。 */
    const element = await render("$$\na^2+b^2=c^2\n$$");
    document.body.append(element);
    hydrateMarkdown(element);
    // 重复 hydrate 不会产生多个按钮。
    hydrateMarkdown(element);
    /** 复制按钮。 */
    const buttons = element.querySelectorAll<HTMLButtonElement>(`.${MATH_COPY_BUTTON_CLASS_NAME}`);
    expect(buttons).toHaveLength(1);
    /** 剪贴板写入内容。 */
    let copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copiedText = text;
          return Promise.resolve();
        }
      }
    });
    buttons[0].click();
    await Promise.resolve();
    expect(copiedText).toBe("$$\na^2+b^2=c^2\n$$");
    element.remove();
  });

  it("copies TeX source when the selection covers formulas", async () => {
    /** 挂在 body 上的渲染容器。 */
    const element = await render("前 $x^2$ 后");
    document.body.append(element);
    hydrateMarkdown(element);
    /** 覆盖整段的选区。 */
    const range = document.createRange();
    range.selectNodeContents(element.querySelector("p") as HTMLParagraphElement);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    /** 模拟剪贴板数据容器。 */
    const clipboardData = new Map<string, string>();
    /** 模拟复制事件。 */
    const copyEvent = Object.assign(new Event("copy", { cancelable: true }), {
      clipboardData: { setData: (type: string, value: string) => clipboardData.set(type, value) }
    });
    document.dispatchEvent(copyEvent);
    expect(copyEvent.defaultPrevented).toBe(true);
    expect(clipboardData.get("text/plain")).toBe("前 $x^2$ 后");
    element.remove();
  });
});
