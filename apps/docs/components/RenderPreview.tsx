/**
 * 文档站内的渲染预览页主体。
 *
 * 直接消费 `@scribdown/markdown-renderer`，与浏览器插件 / VS Code Webview 走同一条
 * 「渲染 HTML → 注入容器 → 绑定交互 → 挂载工具栏」链路，因此改动 `packages/*` 源码后
 * 在本页即可看到真实效果，无需再维护单独的预览沙盒应用。
 *
 * 渲染链路依赖 DOM 与动态 import（mermaid / shiki 体积较大），故整段逻辑放在 effect 中，
 * 既跳过 SSG 阶段，也让渲染器代码从文档站主包里拆出去，只有访问本页时才加载。
 */

import { withBase } from "@rspress/core/runtime";
import { useEffect, useRef, useState } from "react";

import "@scribdown/markdown-renderer/styles.css";

/**
 * fixture Markdown 在站点静态资源中的路径。
 * 必须是站点根起算的绝对路径并经 withBase 补上 base 前缀 ——
 * 写成相对路径会按当前页面所在目录解析（如 /ui-design/），落到不存在的地址上。
 */
const FIXTURE_MARKDOWN_PATH = "/fixtures/markdown-fixture.md";

/** 预览页的加载状态。 */
type PreviewStatus = "loading" | "ready" | "error";

/**
 * 用真实渲染器渲染 fixture 文档的预览页。
 * @returns 预览页 DOM。
 */
export default function RenderPreview(): React.ReactElement {
  /** 满宽外壳节点：工具栏与目录侧栏的挂载点，与各宿主的结构保持一致。 */
  const shellRef = useRef<HTMLDivElement>(null);
  /** Markdown 渲染产物的挂载容器。 */
  const outputRef = useRef<HTMLElement>(null);
  /** 当前加载状态，用于展示占位与失败提示。 */
  const [status, setStatus] = useState<PreviewStatus>("loading");

  useEffect(() => {
    /** 组件是否仍处于挂载状态，避免异步链路回写到已卸载的 DOM。 */
    let isActive = true;

    /** 拉取 fixture 并按宿主一致的顺序完成渲染与交互绑定。 */
    const renderFixture = async (): Promise<void> => {
      const shellElement = shellRef.current;
      const outputElement = outputRef.current;
      if (!shellElement || !outputElement) {
        return;
      }

      try {
        // 关键步骤：动态 import 让渲染器（含 mermaid / shiki）单独分包，只在本页加载。
        const [{ hydrateMarkdown, mountMarkdownToolbar, renderMarkdown }, { setActiveLocaleFromHost }] =
          await Promise.all([
            import("@scribdown/markdown-renderer"),
            import("@scribdown/shared")
          ]);

        // 关键步骤：fixture 从站点静态资源读取而非打进 bundle，
        // 这样直接编辑 public 下的 Markdown 就能刷新看到效果。
        const fixtureResponse = await fetch(withBase(FIXTURE_MARKDOWN_PATH));
        if (!fixtureResponse.ok) {
          throw new Error(`fixture 加载失败：HTTP ${fixtureResponse.status}`);
        }
        // 关键步骤：路径写错时开发服务器会回落到 SPA 的 index.html 并同样返回 200，
        // 仅靠 response.ok 判断会把 HTML 外壳当 Markdown 渲染，故按 content-type 再拦一道。
        if (fixtureResponse.headers.get("content-type")?.includes("html")) {
          throw new Error(`fixture 路径未命中静态资源，收到的是 HTML：${fixtureResponse.url}`);
        }
        /** fixture 的 Markdown 源文本。 */
        const markdownSource = await fixtureResponse.text();
        if (!isActive) {
          return;
        }

        // 关键步骤：与浏览器插件一致，预览语言跟随宿主 navigator.language。
        setActiveLocaleFromHost(navigator.language);

        outputElement.innerHTML = await renderMarkdown(markdownSource);
        if (!isActive) {
          return;
        }
        hydrateMarkdown(outputElement);
        mountMarkdownToolbar(shellElement, { hostLocale: navigator.language });
        setStatus("ready");
      } catch (error) {
        if (isActive) {
          setStatus("error");
        }
        console.error("[scribdown] 渲染预览失败", error);
      }
    };

    void renderFixture();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="scribdown-page render-preview">
      {/* 关键步骤：blank 页没有 Rspress 顶栏，需自带返回入口；
          固定在左上角，与右上角的渲染器工具栏错开。 */}
      <a className="render-preview__back" href={withBase("/ui-design/overview")}>
        ← 返回文档
      </a>
      {status !== "ready" && (
        <p className="render-preview__status" role="status">
          {status === "loading" ? "正在渲染 Markdown 样例…" : "渲染失败，详情见浏览器控制台。"}
        </p>
      )}
      {/* 关键步骤：外壳与正文的层级同各宿主保持一致 —— 工具栏挂在外壳上建立 flex 布局根，
          正文单独一层，第三方临时节点（如 mermaid 测量 div）不会成为 flex item 挤压正文。 */}
      <div ref={shellRef}>
        <main className="scribdown-app">
          <article className="scribdown-markdown" ref={outputRef} />
        </main>
      </div>
    </div>
  );
}
