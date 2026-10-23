/** 冒号容器的 micromark 语法与 mdast 桥接；正文直接复用标准 document tokenizer。 */
import {
  CALLOUT_CONTAINER_KINDS,
  CALLOUT_FENCE_PATTERN,
  CalloutToken,
  DETAILS_CONTAINER_NAME
} from "@scribdown/shared";
import type { CompileContext, Extension as FromMarkdownExtension } from "mdast-util-from-markdown";
import { markdownLineEnding, markdownSpace } from "micromark-util-character";
import { codes, constants, types } from "micromark-util-symbol";
import type { Code, Effects, Extension, State, Token, TokenizeContext } from "micromark-util-types";
import type { CalloutContainer } from "../core/ast";

// 关键步骤：注册自定义 token，使 micromark 与 mdast 桥接共享同一组名称。
declare module "micromark-util-types" {
  interface TokenTypeMap {
    calloutContainer: CalloutToken.Container;
    calloutFence: CalloutToken.Fence;
  }
}

/**
 * 创建块级容器语法扩展，代码块与 HTML 块中的文本不会进入此 tokenizer。
 * @returns micromark flow 扩展。
 */
export function calloutSyntax(): Extension {
  return {
    flow: {
      [codes.colon]: { name: CalloutToken.Container, concrete: true, tokenize: tokenizeContainer }
    }
  };
}

/**
 * 创建容器 token 到 mdast 的转换规则，位置直接继承原始 token。
 * @returns mdast 解析扩展。
 */
export function calloutFromMarkdown(): FromMarkdownExtension {
  return {
    enter: { [CalloutToken.Container]: enterContainer },
    exit: { [CalloutToken.Fence]: exitFence, [CalloutToken.Container]: exitContainer }
  };
}

/**
 * 在原始输入流中解析成对围栏，并逐行向子 document tokenizer 传递正文。
 * @param effects token 创建、消费与回退接口。
 * @param ok 成对容器解析成功的后续状态。
 * @param nok 未闭合或不支持时恢复普通 Markdown 的后续状态。
 */
function tokenizeContainer(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  return createContainerTokenizer(this, effects, ok, nok);
}

/**
 * 为单个容器创建独立状态，嵌套解析时不共享围栏和正文进度。
 * @param context 外层解析上下文，保留原始源码位置。
 * @param effects token 创建、消费与回退接口。
 * @param ok 成对容器解析成功的后续状态。
 * @param nok 容器解析失败的后续状态。
 * @returns 开启围栏的起始状态。
 */
function createContainerTokenizer(
  context: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State
): State {
  /** 当前开启围栏的 token。 */
  let opening: Token;
  /** 开启围栏长度，用于判断关闭围栏。 */
  let size = 0;
  /** 解析正文的标准 Markdown document tokenizer。 */
  let document: TokenizeContext | undefined;
  /** 上一行正文 token，供 micromark 子解析阶段复用已解析事件。 */
  let previous: Token | undefined;
  return start;

  /**
   * 开始解析围栏；段落内部的行内代码不应被新容器中断。
   * @param code 当前字符码。
   */
  function start(code: Code): State | undefined {
    return context.interrupt ? checkCodeSpan(context, effects, nok, begin)(code) : begin(code);
  }

  /**
   * 确认不是行内代码后，创建容器与开启围栏 token。
   * @param code 当前字符码。
   */
  function begin(code: Code): State | undefined {
    effects.enter(CalloutToken.Container);
    opening = effects.enter(CalloutToken.Fence);
    return openingLine(code);
  }

  /**
   * 读取完整开启行，以共享规则提取容器名称与纯文本标题。
   * @param code 当前字符码。
   */
  function openingLine(code: Code): State | undefined {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(CalloutToken.Fence);
      /** 标题保留原始字符，不经过行内 Markdown 或实体解码。 */
      const match = CALLOUT_FENCE_PATTERN.exec(context.sliceSerialize(opening));
      if (
        !match?.[2] ||
        (!Object.hasOwn(CALLOUT_CONTAINER_KINDS, match[2]) &&
          match[2] !== DETAILS_CONTAINER_NAME) ||
        code === codes.eof
      ) {
        return nok(code);
      }
      size = match[1].length;
      // 中断检查只确认开启行；正式解析仍要求找到配对的关闭围栏。
      if (context.interrupt) return ok(code);
      effects.enter(types.lineEnding);
      effects.consume(code);
      effects.exit(types.lineEnding);
      return lineStart;
    }
    effects.consume(code);
    return openingLine;
  }

  /**
   * 尝试关闭容器；代码、HTML 和仍打开的内层容器优先消费正文中的围栏。
   * @param code 当前字符码。
   */
  function lineStart(code: Code): State | undefined {
    if (code === codes.eof || context.parser.lazy[context.now().line]) return nok(code);
    if (markdownLineEnding(code) || hasConcreteContent(document)) return chunkStart(code);
    return effects.attempt({ partial: true, tokenize: closingFence }, closed, chunkStart)(code);
  }

  /**
   * 创建一行正文，并将其与前一行连接；不修改原文或补造字符偏移。
   * @param code 当前字符码。
   */
  function chunkStart(code: Code): State | undefined {
    document ??= context.parser.document(context.now());
    /** 交给 micromark 子解析阶段的正文片段。 */
    const chunk = effects.enter(types.chunkDocument, {
      contentType: constants.contentTypeDocument,
      _tokenizer: document,
      previous
    });
    if (previous) previous.next = chunk;
    previous = chunk;
    return chunkInside(code);
  }

  /**
   * 将完整行喂给正文解析器；源码中的代码、列表、引用和嵌套容器由它识别。
   * @param code 当前字符码。
   */
  function chunkInside(code: Code): State | undefined {
    if (code === codes.eof) return nok(code);
    effects.consume(code);
    if (markdownLineEnding(code)) {
      /** 刚完成的原始正文行。 */
      const chunk = effects.exit(types.chunkDocument);
      document!.defineSkip(chunk.start);
      document!.write(context.sliceStream(chunk));
      return lineStart;
    }
    return chunkInside;
  }

  /**
   * 检测独占一行且足够长的关闭围栏；失败时将整行交回正文解析器。
   * @param closeEffects 此次尝试的 token 操作接口。
   * @param closeOk 关闭成功的后续状态。
   * @param closeNok 非关闭行的后续状态。
   */
  function closingFence(
    this: TokenizeContext,
    closeEffects: Effects,
    closeOk: State,
    closeNok: State
  ): State {
    /** 候选关闭围栏，用于按原始字符检查缩进和尾随空白。 */
    const fence = closeEffects.enter(CalloutToken.Fence);
    return inside;

    /**
     * 消费候选行，并复用共享围栏规则判断是否闭合。
     * @param code 当前字符码。
     */
    function inside(code: Code): State | undefined {
      if (code === codes.eof || markdownLineEnding(code)) {
        closeEffects.exit(CalloutToken.Fence);
        /** 关闭围栏不得带有容器名称或标题。 */
        const match = CALLOUT_FENCE_PATTERN.exec(context.sliceSerialize(fence));
        if (!match || match[2] || match[1].length < size) return closeNok(code);
        /** 仅在候选闭合行探测行内代码，避免逐行重复扫描长段落。 */
        const flow = document?.events.at(-1)?.[1]._tokenizer;
        return flow ? checkCodeSpan(flow, closeEffects, closeNok, closeOk)(code) : closeOk(code);
      }
      closeEffects.consume(code);
      return inside;
    }
  }

  /**
   * 完成正文解析并关闭容器；micromark 随后将已解析子事件插入当前位置。
   * @param code 关闭围栏后的换行或文件结束。
   */
  function closed(code: Code): State | undefined {
    document?.write([codes.eof]);
    effects.exit(CalloutToken.Container);
    return ok(code);
  }
}

/**
 * 检查标准 document tokenizer 当前是否处于不能被外层围栏打断的块中。
 * @param document 正文的 document tokenizer；空容器时尚未创建。
 * @returns 是否存在活动的具体块（代码、HTML 或内层容器）。
 */
function hasConcreteContent(document: TokenizeContext | undefined): boolean {
  /** document 的最后一个 flow 片段保存当前块级解析器。 */
  const flow = document?.events.at(-1)?.[1]._tokenizer;
  return Boolean(flow?.currentConstruct?.concrete);
}

/**
 * 使用标准行内 tokenizer 检查围栏是否落在成对的跨行代码标记之间。
 * @param context 当前块级解析器，只检查尚未完成的段落内容。
 * @param effects 用于不消费原文的前瞻检查。
 * @param literal 围栏属于行内代码时的后续状态。
 * @param normal 围栏可以作为容器语法时的后续状态。
 * @returns 判定行内代码后的状态。
 */
function checkCodeSpan(
  context: TokenizeContext,
  effects: Effects,
  literal: State,
  normal: State
): State {
  /** 尚未闭合的块；包含 GFM 尚在尝试识别表头的普通文本首行。 */
  const content = context.events.find((event) => event[0] === "enter" && !event[1].end)?.[1];
  if (!content) return normal;
  /** 当前段落的原始输入片段；不含反引号时无需进行行内探测。 */
  const stream = context.sliceStream({ start: content.start, end: context.now() });
  if (!stream.some((chunk) => typeof chunk === "string" && chunk.includes("`"))) return normal;
  /** 仅探测当前段落的行内状态，不重新解析文档或修改原始事件。 */
  const text = context.parser.text(content.start);
  text.write([...stream, codes.lineFeed]);
  /** 尚未完成的代码片段；只有后续出现配对反引号才应阻止容器识别。 */
  const pending = text.events.find(
    (event) => event[0] === "enter" && event[1].type === types.codeText && !event[1].end
  )?.[1];
  if (!pending) return normal;
  return effects.check({ partial: true, tokenize: continuation }, literal, normal);

  /**
   * 前瞻至代码闭合或段落结束，未配对反引号仍按普通文字处理。
   * @param lookaheadEffects 临时输入消费接口，check 结束后自动回退。
   * @param matched 找到配对反引号后的状态。
   * @param unmatched 段落结束仍未闭合的状态。
   */
  function continuation(lookaheadEffects: Effects, matched: State, unmatched: State): State {
    /** 当前行是否已有非空白字符，空行会结束 Markdown 段落。 */
    let nonBlank = true;
    lookaheadEffects.enter(types.data);
    return scan;

    /**
     * 向独立的行内 tokenizer 传入前瞻字符，原文与主解析器事件保持不变。
     * @param code 当前字符码。
     */
    function scan(code: Code): State | undefined {
      text.write([code !== null && code >= 0 ? String.fromCharCode(code) : code]);
      if (pending!.end) {
        lookaheadEffects.exit(types.data);
        return matched(code);
      }
      if (code === codes.eof || (markdownLineEnding(code) && !nonBlank)) return unmatched(code);
      if (markdownLineEnding(code)) nonBlank = false;
      else if (!markdownSpace(code)) nonBlank = true;
      lookaheadEffects.consume(code);
      return scan;
    }
  }
}

/**
 * 开始构建容器 AST，正文由标准 mdast handlers 自动添加。
 * @param token 带原始位置的容器 token。
 */
function enterContainer(this: CompileContext, token: Token): void {
  this.enter({ type: CalloutToken.Container, name: "", title: "", children: [] }, token);
}

/**
 * 从开启围栏提取名称和纯文本标题；关闭围栏没有名称，直接忽略。
 * @param token 开启或关闭围栏 token。
 */
function exitFence(this: CompileContext, token: Token): void {
  /** 与 tokenizer 一致的围栏匹配结果。 */
  const match = CALLOUT_FENCE_PATTERN.exec(this.sliceSerialize(token));
  if (!match?.[2]) return;
  /** 当前正在构建的容器节点。 */
  const node = this.stack.at(-1) as CalloutContainer;
  node.name = match[2];
  node.title = match[3] ?? "";
}

/**
 * 结束 AST 容器并记录原始闭合位置。
 * @param token 已闭合的容器 token。
 */
function exitContainer(this: CompileContext, token: Token): void {
  this.exit(token);
}
