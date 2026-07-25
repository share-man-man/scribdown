import { defineContentScript } from "wxt/utils/define-content-script";
import { startContentScript } from "../content/content-script";

/** Markdown 文件的 document_start content script 入口。 */
export default defineContentScript({
  matches: ["file:///*.md", "http://*/*.md", "https://*/*.md"],
  runAt: "document_start",
  main(): void {
    void startContentScript();
  }
});
