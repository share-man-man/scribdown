/** 提示块的语义类型；两种 Markdown 写法共用同一套视觉映射。 */
export enum CalloutKind {
  Note = "note",
  Tip = "tip",
  Important = "important",
  Warning = "warning",
  Caution = "caution"
}

/** 提示块根节点类名。 */
export const CALLOUT_CLASS_NAME = "scribdown-callout";
/** 提示块标题类名。 */
export const CALLOUT_TITLE_CLASS_NAME = "scribdown-callout__title";
/** 每种提示块的修饰类名与默认标题。 */
export const CALLOUT_META = {
  [CalloutKind.Note]: { className: "scribdown-callout--note", title: "Note" },
  [CalloutKind.Tip]: { className: "scribdown-callout--tip", title: "Tip" },
  [CalloutKind.Important]: { className: "scribdown-callout--important", title: "Important" },
  [CalloutKind.Warning]: { className: "scribdown-callout--warning", title: "Warning" },
  [CalloutKind.Caution]: { className: "scribdown-callout--caution", title: "Caution" }
} as const;
/** 容器名称到统一提示类型的映射，兼容 VitePress 的 info / danger。 */
export const CALLOUT_CONTAINER_KINDS: Readonly<Record<string, CalloutKind>> = {
  note: CalloutKind.Note,
  info: CalloutKind.Note,
  tip: CalloutKind.Tip,
  important: CalloutKind.Important,
  warning: CalloutKind.Warning,
  caution: CalloutKind.Caution,
  danger: CalloutKind.Caution
};
/** 原生折叠容器名称。 */
export const DETAILS_CONTAINER_NAME = "details";
/** 未指定折叠标题时的显示文本。 */
export const DETAILS_CONTAINER_TITLE = "Details";
/** GitHub 提示标记；允许自定义行内标题，但标记必须在引用第一行。 */
export const CALLOUT_MARKER_PATTERN =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[\t ]+([^\n]*))?(?:\n|$)/u;
/** 容器围栏；必须独占一行，最多三个前导空格。 */
export const CALLOUT_FENCE_PATTERN = /^ {0,3}(:{3,})(?:[\t ]*([a-z]+)(?:[\t ]+(.*?))?)?[\t ]*$/u;

/** 容器解析器的 token 与 AST 节点名称。 */
export enum CalloutToken {
  Container = "calloutContainer",
  Fence = "calloutFence"
}
