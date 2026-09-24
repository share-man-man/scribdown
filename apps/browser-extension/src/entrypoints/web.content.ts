import { defineContentScript } from "wxt/utils/define-content-script";
import { shouldTakeOverPage } from "../content/preflight";
import { redirectToViewer } from "../content/redirect-to-viewer";

/**
 * http(s):// Markdown 的 document_start content script 入口。
 *
 * 与 file.content.ts 拆开注册，是因为 MV3 声明式 content script 只能是 classic script，
 * 打包器必然产出单文件、无法按需分包。合并注册会让每个 http(s) 的 .md 页面
 * 都下载并解析整份渲染核心（约 7.7MB），而这条路径实际只需要一次跳转。
 */
export default defineContentScript({
  matches: ["http://*/*.md", "https://*/*.md"],
  runAt: "document_start",
  main(): void {
    void (async () => {
      if (!(await shouldTakeOverPage())) return;
      await redirectToViewer();
    })();
  }
});
