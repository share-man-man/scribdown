import { ReactElement, useEffect, useState } from "react";
import { renderMarkdown } from "@scribdown/markdown-renderer";
import { BROWSER_PREVIEW_TITLE, PROJECT_NAME } from "@scribdown/shared";
import { HanddrawnCard } from "@scribdown/ui-handdrawn";
import "@scribdown/ui-handdrawn/styles.css";

/**
 * 浏览器插件主页面。
 * @returns React 元素。
 */
export function App(): ReactElement {
  // 存储渲染后的 HTML 结果。
  const [htmlText, setHtmlText] = useState<string>("");

  useEffect(() => {
    /**
     * 执行示例 Markdown 渲染流程。
     * @returns Promise。
     */
    async function runPreviewRender(): Promise<void> {
      // 示例 Markdown 内容，统一使用共享项目名常量。
      const markdownSample = `# ${PROJECT_NAME}\n\n- Browser Extension\n- VS Code Extension`;

      // 关键步骤：执行 Markdown -> HTML 渲染。
      const nextHtmlText = await renderMarkdown(markdownSample, {
        sanitizeHtml: true
      });

      setHtmlText(nextHtmlText);
    }

    void runPreviewRender();
  }, []);

  return (
    <main className="scribdown-app">
      <HanddrawnCard title={BROWSER_PREVIEW_TITLE}>
        <article dangerouslySetInnerHTML={{ __html: htmlText }} />
      </HanddrawnCard>
    </main>
  );
}
