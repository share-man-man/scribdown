import {
  hydrateMarkdown,
  mountMarkdownToolbar,
  renderMarkdown
} from "@scribdown/markdown-renderer";
import "@scribdown/markdown-renderer/styles.css";
import markdownSource from "../../docs/ui-design/markdown-fixture.md?raw";
import "./styles.css";

/** Markdown 渲染产物的挂载容器，必须带 `scribdown-markdown` 类名。 */
const outputElement = document.getElementById("scribdown-output") as HTMLElement;

// 关键步骤：第三方接入只需三步 —— 渲染 HTML、注入容器、绑定交互；工具栏按需挂载。
outputElement.innerHTML = await renderMarkdown(markdownSource);
hydrateMarkdown(outputElement);
mountMarkdownToolbar(document.body);
