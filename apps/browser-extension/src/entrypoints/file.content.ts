import { defineContentScript } from "wxt/utils/define-content-script";
import { shouldTakeOverPage } from "../content/preflight";
import { renderFileUrlInPlace } from "../content/render-in-place";

/**
 * file:// Markdown 的 document_start content script 入口。
 *
 * 只有这条路径会把渲染核心打进 content script：扩展 viewer 不能以 file: 作为 src，
 * 因此本地文件只能就地渲染。详见 render-in-place.ts。
 */
export default defineContentScript({
  matches: ["file:///*.md"],
  runAt: "document_start",
  main(): void {
    void (async () => {
      if (!(await shouldTakeOverPage())) return;
      await renderFileUrlInPlace();
    })();
  }
});
