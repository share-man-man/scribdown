import {
  hydrateMarkdown,
  mountMarkdownToolbar,
  renderMarkdown
} from "@scribdown/markdown-renderer";
import "@scribdown/markdown-renderer/styles.css";
import markdownSource from "../../docs/ui-design/markdown-fixture.md?raw";

/** Markdown 渲染产物的挂载容器，必须带 `scribdown-markdown` 类名。 */
const outputElement = document.getElementById("scribdown-output") as HTMLElement;

/** 满宽外壳节点：工具栏与目录侧栏的挂载点，由它（而非 body）承载 flex 布局根。 */
const shellElement = document.getElementById("scribdown-shell") as HTMLElement;

// 关键步骤：渲染流程与各宿主一致 —— 渲染 HTML、注入容器、绑定交互、挂载工具栏。
// 工具栏挂在满宽外壳上（非 body），与 VS Code / 浏览器宿主结构对齐，避免把 body 变成 flex 根。
outputElement.innerHTML = await renderMarkdown(markdownSource);
hydrateMarkdown(outputElement);
mountMarkdownToolbar(shellElement);
