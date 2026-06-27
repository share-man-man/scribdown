/**
 * content script 请求 background 消费一次性 viewer bypass 的消息类型。
 */
export const CONSUME_BYPASS_MESSAGE = "scribdown:consume-bypass";

/**
 * viewer 请求 background 注册一次性 viewer bypass 的消息类型。
 */
export const BYPASS_ONCE_MESSAGE = "scribdown:bypass-once";

/**
 * popup 请求 background 立即刷新工具栏徽标的消息类型。
 */
export const REFRESH_BADGE_MESSAGE = "scribdown:refresh-badge";

/**
 * file:// content script 请求 background 代理读取本地文件的消息类型。
 */
export const FETCH_FILE_MESSAGE = "scribdown:fetch-file";

/**
 * 运行时消息的基础结构。
 */
interface RuntimeMessageBase {
  /** 消息类型。 */
  type: string;
}

/**
 * 携带 URL 的运行时消息结构。
 */
interface UrlRuntimeMessage extends RuntimeMessageBase {
  /** 消息作用的源 URL。 */
  url: string;
}

/**
 * 请求刷新徽标的消息。
 */
export interface RefreshBadgeMessage extends RuntimeMessageBase {
  /** 消息类型。 */
  type: typeof REFRESH_BADGE_MESSAGE;
}

/**
 * 请求 background 代理拉取 file:// 内容的消息。
 */
export interface FetchFileMessage extends UrlRuntimeMessage {
  /** 消息类型。 */
  type: typeof FETCH_FILE_MESSAGE;
}

/**
 * 请求注册一次性 viewer bypass 的消息。
 */
export interface BypassOnceMessage extends UrlRuntimeMessage {
  /** 消息类型。 */
  type: typeof BYPASS_ONCE_MESSAGE;
}

/**
 * 请求消费一次性 viewer bypass 的消息。
 */
export interface ConsumeBypassMessage extends UrlRuntimeMessage {
  /** 消息类型。 */
  type: typeof CONSUME_BYPASS_MESSAGE;
}

/**
 * 需要 background 处理的运行时消息。
 */
export type ScribdownRuntimeMessage =
  | RefreshBadgeMessage
  | FetchFileMessage
  | BypassOnceMessage
  | ConsumeBypassMessage;

/**
 * 从未知消息中读取消息类型。
 * @param message 运行时传入的未知消息。
 * @returns 消息类型；不存在或类型不符时返回 undefined。
 */
export function getRuntimeMessageType(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  /** 消息上的原始类型字段。 */
  const type = (message as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

/**
 * 从未知消息中读取 URL 字段。
 * @param message 运行时传入的未知消息。
 * @returns URL 字符串；不存在或类型不符时返回 undefined。
 */
export function getRuntimeMessageUrl(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  /** 消息上的原始 URL 字段。 */
  const url = (message as { url?: unknown }).url;
  return typeof url === "string" ? url : undefined;
}
