import { CONSUME_BYPASS_MESSAGE } from "../messages/runtime";

/**
 * http(s):// 场景将当前页替换为扩展 viewer，由 viewer 在 chrome-extension:// origin 下
 * 重新发起带凭证的 fetch 并渲染，规避源站 CSP / sandbox 等约束。
 *
 * 本模块刻意只依赖 runtime 消息常量：渲染核心留在 viewer 页面里按需分包加载，
 * 保证 http(s) 的 content script 始终是薄壳。
 */
export async function redirectToViewer(): Promise<void> {
  // 关键步骤：先消费一次性 bypass，避免「查看原始链接」回到原 URL 后又被拦回 viewer。
  /** background 维护的 bypass 标记消费结果。 */
  const bypassResult = (await chrome.runtime.sendMessage({
    type: CONSUME_BYPASS_MESSAGE,
    url: location.href
  })) as { bypassed?: boolean } | undefined;
  if (bypassResult?.bypassed) return;

  /** 扩展 viewer 页面的目标 URL，src 参数携带原始资源地址。 */
  const viewerUrl = chrome.runtime.getURL(`viewer.html?src=${encodeURIComponent(location.href)}`);
  window.location.replace(viewerUrl);
}
