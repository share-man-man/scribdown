import { FETCH_FILE_MESSAGE } from "../messages/runtime";
import { renderMarkdownToDocument } from "../rendering/render-markdown";
import { startPollingSource } from "./poll-source";

/**
 * 等待 DOM 解析到 body 阶段，便于读取浏览器为纯文本 `.md` 自动包装的 `<pre>` 内容。
 * @returns DOMContentLoaded 触发后 resolve。
 */
function waitForDom(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

/**
 * file:// 场景就地渲染：扩展 viewer 不允许以 file: 作为 src，
 * 因此只能在原页面取 `<pre>` 文本后调用渲染核心。
 *
 * 本模块会把渲染核心（shiki grammar、mermaid 等）整体打进 file:// 的
 * content script bundle，因此只被 file.content.ts 引用，
 * 不可在 http(s) 入口中导入。
 */
export async function renderFileUrlInPlace(): Promise<void> {
  await waitForDom();

  /** Chrome 打开 file://*.md 时，body 内会有一个 <pre> 节点承载原始文本。 */
  const preElement = document.querySelector<HTMLPreElement>("pre");
  /** 提取出的 Markdown 原文。 */
  const rawMarkdown = preElement?.innerText ?? document.body.innerText;
  if (!rawMarkdown.trim()) return;

  /** 当前文件的展示名，用于页面标题。 */
  const filename = decodeURIComponent(window.location.pathname.split("/").pop() ?? "Markdown");

  // 代码高亮在 file:// 下同样可用：MV3 声明式 content script 走 IIFE 单文件打包，
  // shiki grammar 与 wasm 引擎已全部内联进本 bundle，运行期不再发起跨源请求，
  // 因此不受 file:// 的 CORS 限制。
  await renderMarkdownToDocument(rawMarkdown, filename, window.location.href);

  // 关键步骤：启动文件轮询，磁盘内容更新后无需手动刷新即可看到最新版本。
  // 注意：content script 在 file:// 页面里的 origin 是 null，直接 fetch 会被 CORS 拦掉，
  // 因此改走 background service worker 代理（chrome-extension origin），
  // 依赖 manifest 中的 `file:///*` host permission + 用户在扩展详情页开启
  // 「允许访问文件网址」。popup 内提供了开启入口。
  //
  // DevTools 可见性说明：background SW 发起的 fetch(file://...) 请求，Chrome 只展示在
  // 同属 chrome-extension:// origin 的页面（如 viewer.html）的网络面板里。
  // 在 file:// 标签页自己的网络面板中看不到这些请求，但轮询实际仍在运行。
  // 如需观察轮询活动，可在 chrome://extensions → Scribdown → Service Worker 处打开
  // background SW 的专属 DevTools 查看。
  startPollingSource({
    initialContent: rawMarkdown,
    fetchLatest: async () => {
      /** background 代理拉取的响应；ok=false 时附带 error 描述。 */
      const response = (await chrome.runtime.sendMessage({
        type: FETCH_FILE_MESSAGE,
        url: window.location.href
      })) as { ok?: boolean; text?: string; error?: string } | undefined;
      if (!response?.ok || typeof response.text !== "string") {
        throw new Error(response?.error ?? "fetch via background failed");
      }
      return response.text;
    },
    onChange: async (latest) => {
      // 关键步骤：shiki 实例在初次渲染后已完成初始化，后续重渲染复用同一实例，
      // 开销可忽略，无需禁用代码高亮。
      // renderMarkdownToDocument 内部走 morphdom 增量合并，滚动容器不会被重建，
      // 阅读位置原地保留，这里无需再手动保存 / 恢复滚动。
      await renderMarkdownToDocument(latest, filename, window.location.href);
    }
  });
}
