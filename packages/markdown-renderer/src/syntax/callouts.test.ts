// @vitest-environment jsdom
/** 通过真实渲染链路验证提示语法、源码定位和安全边界。 */
import {
  CALLOUT_CLASS_NAME,
  CALLOUT_META,
  CALLOUT_TITLE_CLASS_NAME,
  MARKDOWN_SOURCE_DATA_ATTRIBUTE,
  CalloutKind,
  CalloutToken
} from "@scribdown/shared";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../index";
import { remarkCallouts } from "./callouts";

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

describe("callouts", () => {
  it("creates containers and original source positions during parsing", () => {
    /** 无需运行 AST transformer 即可得到容器及标准 Markdown 子树。 */
    const source = ":::tip 🎉\r\n正文 **强调**\r\n:::";
    /** 仅执行解析阶段，验证语法扩展没有依赖全文重解析。 */
    const tree = unified().use(remarkParse).use(remarkCallouts, source).parse(source);
    /** 解析阶段直接生成的容器。 */
    const container = tree.children[0];
    expect(container.type).toBe(CalloutToken.Container);
    expect(container.position?.end.offset).toBe(source.length);
    if (container.type !== CalloutToken.Container) throw new Error("Expected parsed container");
    expect(container.name).toBe("tip");
    expect(container.title).toBe("🎉");
    expect(container.children[0].position?.start).toEqual({ line: 2, column: 1, offset: 11 });
    expect(container.children[0].type).toBe("paragraph");
  });

  it.each([
    "前文\n:::tip\n正文\n:::\n后文",
    "> :::tip\n> 正文\n> :::",
    "- 列表项\n\n  :::tip\n  正文\n  :::",
    "   :::tip\n正文\n   :::"
  ])("parses containers in block context: %s", async (markdown) => {
    /** 覆盖段落中断、引用、列表和允许的围栏缩进。 */
    const element = await render(markdown);
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(1);
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)?.textContent).toContain("正文");
    expect(element.textContent).not.toContain(":::");
  });

  it("keeps equal-length nested fences and quoted alerts inside containers", async () => {
    /** 嵌套容器优先消费自己的关闭行，外层容器继续保留后续正文。 */
    const element = await render(
      ":::tip\n前文\n:::warning\n内部\n:::\n> [!NOTE]\n> 引用提示\n\n外层末尾\n:::"
    );
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(3);
    expect(element.firstElementChild?.textContent).toContain("外层末尾");
    expect(
      element.querySelector(`.${CALLOUT_META[CalloutKind.Warning].className}`)?.textContent
    ).not.toContain("外层末尾");
  });

  it("ignores closing fences inside multiline inline code", async () => {
    /** 行内代码中的冒号行必须留在代码内，真正关闭后才出现外部段落。 */
    const element = await render(":::tip\n`literal\n:::\nend`\n\n正文\n:::\n外部");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} code`)?.textContent).toContain(":::");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)?.textContent).toContain("正文");
    expect(element.lastElementChild?.textContent).toBe("外部");
  });

  it.each(["`未配对", "`完整代码`", "正文 \\`转义"])(
    "does not let ordinary backticks hide closing fences: %s",
    async (body) => {
      /** 未配对、完整和转义反引号都不能让容器吞掉外部正文。 */
      const element = await render(`:::tip\n${body}\n:::\n外部`);
      expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(1);
      expect(element.lastElementChild?.textContent).toBe("外部");
    }
  );

  it("keeps fences inside HTML blocks and real thematic breaks", async () => {
    /** HTML 注释中的围栏不可关闭容器，用户写入的分隔线也不能被删除。 */
    const element = await render(":::tip\n<!--\n:::\n-->\n\n***\n\n正文\n:::\n***");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)?.textContent).toContain("正文");
    expect(element.querySelectorAll("hr")).toHaveLength(2);
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME} hr`)).toHaveLength(1);
  });

  it("does not close a container with a shorter fence", async () => {
    /** 较短围栏属于正文，最终使用足够长的围栏关闭。 */
    const element = await render("::::tip\n正文\n:::\n继续\n:::::\n外部");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)?.textContent).toContain("继续");
    expect(element.lastElementChild?.textContent).toBe("外部");
  });

  it.each(Object.values(CalloutKind))("renders the %s GitHub alert", async (kind) => {
    /** 五种提示都应保留富文本正文。 */
    const element = await render(
      `> [!${kind.toUpperCase()}]\n> 正文 **强调** 与 [链接](https://example.com)`
    );
    expect(element.querySelector(`.${CALLOUT_META[kind].className}`)).not.toBeNull();
    expect(element.querySelector(`.${CALLOUT_TITLE_CLASS_NAME}`)?.textContent).toBe(
      CALLOUT_META[kind].title
    );
    expect(element.querySelector("strong")?.textContent).toBe("强调");
    expect(element.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(element.textContent).not.toContain("[!");
  });

  it("keeps multiple blocks, source anchors, empty alerts and custom titles", async () => {
    /** 覆盖列表、代码块、自定义标题与空提示块。 */
    const element = await render(
      "> [!WARNING] 发布前检查\n>\n> - 检查配置\n>\n> ```text\n> example\n> ```\n\n> [!TIP]"
    );
    expect(element.querySelector(`.${CALLOUT_TITLE_CLASS_NAME}`)?.textContent).toBe("发布前检查");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)?.getAttribute("data-source-line")).toBe(
      "1"
    );
    expect(element.querySelector("li")?.getAttribute("data-source-line")).toBe("3");
    expect(element.querySelector("code")?.textContent).toContain("example");
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(2);
  });

  it.each([
    "> ordinary quote",
    "> **Note**\n> ordinary quote",
    "> [!UNKNOWN]\n> body",
    "> \\[!NOTE]\n> literal",
    "> `[!NOTE]`\n> literal",
    "> intro\n> [!NOTE]\n> literal",
    "> [!NOTE]suffix\n> literal",
    "```md\n> [!NOTE]\n> literal\n```"
  ])("leaves non-alert syntax unchanged: %s", async (markdown) => {
    /** 不符合首行提示语法的输入。 */
    const element = await render(markdown);
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)).toBeNull();
  });

  it.each(["note", "info", "tip", "important", "warning", "caution", "danger"])(
    "renders %s containers without blank lines",
    async (name) => {
      /** 容器语法与紧邻正文、关闭后的文本。 */
      const element = await render(`::: ${name} 自定义标题\n正文 **强调**\n:::\n容器外文本`);
      expect(element.querySelector(`.${CALLOUT_TITLE_CLASS_NAME}`)?.textContent).toBe("自定义标题");
      expect(element.querySelector(`.${CALLOUT_CLASS_NAME} strong`)?.textContent).toBe("强调");
      expect(element.lastElementChild?.textContent).toBe("容器外文本");
      expect(element.lastElementChild?.getAttribute("data-source-line")).toBe("4");
    }
  );

  it("supports nested containers, details, CRLF and source offsets", async () => {
    /** 嵌套提示内有带原始 Markdown 信息的表格。 */
    const element = await render(
      [
        ":::: tip 外层",
        "",
        "::: warning 内层",
        "",
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        ":::",
        "",
        "::: details 展开详情",
        "",
        "正文",
        "",
        ":::",
        "",
        "::::"
      ].join("\r\n")
    );
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(2);
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} .${CALLOUT_CLASS_NAME}`)).not.toBeNull();
    expect(element.querySelector("summary")?.textContent).toBe("展开详情");
    expect(element.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(element.querySelector("table")?.getAttribute("data-source-line")).toBe("5");
  });

  it("preserves Markdown headings, code, references and closing fences inside code", async () => {
    /** 代码中的闭合标记不可提前结束外层容器。 */
    const element = await render(
      "::: info\n\n## 标题\n\n```text\n:::\n```\n\n[引用][ref]\n\n:::\n\n[ref]: https://example.com"
    );
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} h2`)?.textContent).toBe("标题");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} code`)?.textContent).toContain(":::");
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} a`)?.getAttribute("href")).toBe(
      "https://example.com"
    );
  });

  it.each([
    "::: tip\n未闭合",
    "::: unknown\n正文\n:::",
    "\\::: tip\n正文\n:::",
    "```md\n::: tip\n正文\n:::\n```",
    "`literal\n::: tip\ntext\n:::\nend`"
  ])("preserves unsupported or literal containers: %s", async (markdown) => {
    /** 未闭合、不支持和代码中的容器语法。 */
    const element = await render(markdown);
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME}`)).toBeNull();
    expect(element.textContent).toContain(":::");
  });

  it("keeps consecutive empty containers separate from surrounding text", async () => {
    /** 空容器与普通正文不能相互吞并。 */
    const element = await render("前文\n\n::: tip\n:::\n::: warning\n:::\n后文");
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME}`)).toHaveLength(2);
    expect(element.firstElementChild?.textContent).toBe("前文");
    expect(element.lastElementChild?.textContent).toBe("后文");
  });

  it("closes containers after lists without requiring a blank line", async () => {
    /** 闭合围栏初次解析时可能属于列表的惰性续行。 */
    const element = await render("::: tip\n- 第一项\n- 第二项\n:::\n后文");
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME} li`)).toHaveLength(2);
    expect(element.lastElementChild?.textContent).toBe("后文");
  });

  it("does not merge lists across container boundaries", async () => {
    /** 同种列表标记在容器内外必须维持独立列表。 */
    const element = await render("- 前文\n\n::: tip\n- 内部\n:::\n- 外部");
    expect(element.querySelectorAll(`.${CALLOUT_CLASS_NAME} li`)).toHaveLength(1);
    expect(element.querySelector(`.${CALLOUT_CLASS_NAME} li`)?.textContent).toBe("内部");
    expect(element.lastElementChild?.textContent?.trim()).toBe("外部");
  });

  it("keeps UTF-16 source offsets intact after an emoji title", async () => {
    /** 非 BMP 字符占两个源码偏移，解析器必须保留这个长度。 */
    const element = await render("::: tip 🎉 提示\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n:::");
    expect(
      decodeURIComponent(
        element.querySelector("table")?.getAttribute(MARKDOWN_SOURCE_DATA_ATTRIBUTE) ?? ""
      )
    ).toBe("| A | B |\n| - | - |\n| 1 | 2 |");
  });

  it("keeps custom alert titles as plain text and hard breaks out of the body", async () => {
    /** 标题中的格式标记按文字保留，显式换行不应成为正文首项。 */
    const element = await render("> [!NOTE] **标题** 与 `代码`  \n> 正文 **强调**");
    expect(element.querySelector(`.${CALLOUT_TITLE_CLASS_NAME}`)?.textContent).toBe(
      "**标题** 与 `代码`"
    );
    expect(element.querySelector("strong")?.textContent).toBe("强调");
    expect(element.querySelector("br")).toBeNull();
  });

  it("retains safe styling while sanitizing untrusted content and titles", async () => {
    /** 恶意标题应转义，正文仍走完整清洗链。 */
    const element = await render(
      '::: warning <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n<img src="x" onerror="alert(1)">\n\n:::'
    );
    expect(element.querySelector(`.${CALLOUT_TITLE_CLASS_NAME}`)?.textContent).toBe(
      "<img src=x onerror=alert(1)>"
    );
    expect(element.querySelector("script, [onerror], [href^='javascript:']")).toBeNull();
    expect(element.querySelector(`.${CALLOUT_META[CalloutKind.Warning].className}`)).not.toBeNull();
  });
});
