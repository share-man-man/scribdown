/**
 * 视频渲染：rehype 插件把 <video> 包装为与图片一致的 figure 结构（含失败态占位），
 * hydrate 阶段绑定加载完成与失败回退状态机。
 */

import {
  VIDEO_ELEMENT_CLASS_NAME,
  VIDEO_FALLBACK_CLASS_NAME,
  VIDEO_FALLBACK_ICON_CLASS_NAME,
  VIDEO_FALLBACK_SOURCE_CLASS_NAME,
  VIDEO_FALLBACK_TEXT_CLASS_NAME,
  VIDEO_FIGURE_CLASS_NAME,
  VIDEO_FRAME_CLASS_NAME,
  VIDEO_FRAME_FAILED_CLASS_NAME,
  VIDEO_FRAME_LOADED_CLASS_NAME,
  t
} from "@scribdown/shared";

import type { Element, ElementContent, Root } from "hast";
import { classnames } from "hast-util-classnames";
import { SKIP, visit } from "unist-util-visit";

// 视频运行时已绑定标记的 dataset 键。
const VIDEO_HYDRATED_DATA_KEY = "scribdownVideoHydrated";

/**
 * rehype 插件：把渲染后的 <video> 元素包装为 figure 结构，
 * 与图片 figure 保持视觉与失败回退状态机一致。
 * 该插件运行在 rehype-raw 之后、rehype-sanitize 之前，结构清洗在后兜底。
 * @returns hast 转换器。
 */
function rehypeVideoFigures(): (tree: Root) => void {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (parent === undefined || index === undefined) {
        return;
      }

      if (isHastVideoElement(node)) {
        parent.children[index] = createVideoFigureHast(node);
        // 关键步骤：figure 内部无需再遍历，跳过并从替换节点之后继续。
        return SKIP;
      }

      // <p><video/></p> 形式（行内 HTML 解析的常见结果）：把整段替换为 figure。
      /** 仅包含单个 video 的段落剥离结果。 */
      const standaloneVideo = extractStandaloneParagraphVideo(node);
      if (standaloneVideo) {
        parent.children[index] = createVideoFigureHast(standaloneVideo);
        return SKIP;
      }
    });
  };
}

/**
 * 判断 hast 节点是否为 <video> 元素。
 * @param node 待判断的 hast 节点。
 * @returns 是否为 video 元素。
 */
function isHastVideoElement(node: ElementContent): node is Element {
  return node.type === "element" && node.tagName === "video";
}

/**
 * 尝试从只包含单个 <video> 的 <p> 段落中剥离出该 video 节点。
 * @param node 待检查的 hast 元素。
 * @returns 剥离出的 video 节点；不匹配则返回 undefined。
 */
function extractStandaloneParagraphVideo(node: Element): Element | undefined {
  if (node.tagName !== "p") {
    return undefined;
  }

  /** 段落内忽略纯空白文本节点后的有效子节点列表。 */
  const significantChildren = node.children.filter((childNode) => {
    if (childNode.type === "text") {
      return childNode.value.trim().length > 0;
    }
    return true;
  });

  if (significantChildren.length === 1 && isHastVideoElement(significantChildren[0])) {
    return significantChildren[0];
  }

  return undefined;
}

/**
 * 把 video 节点装饰类名后包装为 figure + frame + fallback 的 hast 结构。
 * @param videoNode 原始 video 节点。
 * @returns 新的 figure hast 节点。
 */
function createVideoFigureHast(videoNode: Element): Element {
  decorateHastVideoElement(videoNode);

  /** 用于失败态展示的源 URL。 */
  const sourceUrl = readHastVideoSourceUrl(videoNode);

  return {
    type: "element",
    tagName: "figure",
    properties: { className: [VIDEO_FIGURE_CLASS_NAME] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FRAME_CLASS_NAME] },
        children: [videoNode, createVideoFallbackHast(sourceUrl)]
      }
    ]
  };
}

/**
 * 给 video 节点追加统一类名（hast-util-classnames 保留原有 class 并去重）。
 * @param videoNode 待装饰的 video 节点。
 */
function decorateHastVideoElement(videoNode: Element): void {
  classnames(videoNode, VIDEO_ELEMENT_CLASS_NAME);
}

/**
 * 读取 video 节点的源 URL，优先使用 src 属性，其次回退到首个 <source> 子节点。
 * @param videoNode video 节点。
 * @returns 源 URL，未找到时返回空串。
 */
function readHastVideoSourceUrl(videoNode: Element): string {
  if (typeof videoNode.properties.src === "string") {
    return videoNode.properties.src;
  }

  for (const childNode of videoNode.children) {
    if (
      childNode.type === "element" &&
      childNode.tagName === "source" &&
      typeof childNode.properties.src === "string"
    ) {
      return childNode.properties.src;
    }
  }

  return "";
}

/**
 * 构造视频失败态占位 hast 节点。
 * @param sourceUrl 视频源 URL，用于失败态尾部展示。
 * @returns 失败态占位 hast 节点。
 */
function createVideoFallbackHast(sourceUrl: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { className: [VIDEO_FALLBACK_CLASS_NAME] },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_ICON_CLASS_NAME] },
        children: []
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_TEXT_CLASS_NAME] },
        children: [{ type: "text", value: t("video.loadFailed") }]
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: [VIDEO_FALLBACK_SOURCE_CLASS_NAME] },
        children: [{ type: "text", value: sourceUrl }]
      }
    ]
  };
}

/**
 * 给渲染后的视频绑定加载/失败状态类名。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMarkdownVideos(rootElement: ParentNode): void {
  // 当前根节点内的所有视频元素。
  const videoElements = rootElement.querySelectorAll<HTMLVideoElement>(
    `video.${VIDEO_ELEMENT_CLASS_NAME}`
  );

  videoElements.forEach(bindMarkdownVideoState);
}

/**
 * 给单个视频元素绑定加载完成与失败回退状态机。
 * @param videoElement 待绑定状态的视频元素。
 */
function bindMarkdownVideoState(videoElement: HTMLVideoElement): void {
  updateMarkdownVideoState(videoElement);

  if (videoElement.dataset[VIDEO_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  videoElement.dataset[VIDEO_HYDRATED_DATA_KEY] = "true";
  videoElement.addEventListener("loadeddata", handleMarkdownVideoLoaded);
  videoElement.addEventListener("error", handleMarkdownVideoError);

  // 关键步骤：同时监听内部 <source> 的 error，覆盖多源视频在最后一个源失败后才能确认失败的场景。
  videoElement.querySelectorAll<HTMLSourceElement>("source").forEach((sourceElement) => {
    sourceElement.addEventListener("error", handleMarkdownVideoSourceError);
  });
}

/**
 * 处理视频可播放数据就绪事件，刷新 frame 状态类。
 * @param event 视频加载事件。
 */
function handleMarkdownVideoLoaded(event: Event): void {
  // 触发就绪事件的视频元素。
  const videoElement = event.currentTarget as HTMLVideoElement;

  updateMarkdownVideoState(videoElement);
}

/**
 * 处理视频本体加载失败事件。
 * @param event 视频失败事件。
 */
function handleMarkdownVideoError(event: Event): void {
  // 触发失败事件的视频元素。
  const videoElement = event.currentTarget as HTMLVideoElement;

  markMarkdownVideoFailed(videoElement);
}

/**
 * 处理视频内部 <source> 的失败事件。
 * 仅当 networkState 进入 NETWORK_NO_SOURCE，意味着所有候选源均不可用时，才标记失败。
 * @param event source 失败事件。
 */
function handleMarkdownVideoSourceError(event: Event): void {
  // 触发失败事件的 source 元素。
  const sourceElement = event.currentTarget as HTMLElement;
  // 关联的视频宿主元素。
  const videoElement = sourceElement.closest<HTMLVideoElement>(`video.${VIDEO_ELEMENT_CLASS_NAME}`);

  if (!videoElement) {
    return;
  }
  if (videoElement.networkState !== videoElement.NETWORK_NO_SOURCE) {
    return;
  }

  markMarkdownVideoFailed(videoElement);
}

/**
 * 根据视频当前播放状态刷新 frame 状态类。
 * @param videoElement 待更新状态的视频元素。
 */
function updateMarkdownVideoState(videoElement: HTMLVideoElement): void {
  // 视频外层 frame 元素。
  const frameElement = videoElement.closest<HTMLElement>(`.${VIDEO_FRAME_CLASS_NAME}`);

  if (!frameElement) {
    return;
  }

  // 当前视频是否已确认加载失败：本体 error 非空，或没有可用源。
  const isFailed =
    videoElement.error !== null || videoElement.networkState === videoElement.NETWORK_NO_SOURCE;
  // 当前视频是否已确认拿到首帧。
  const isLoaded = videoElement.readyState >= videoElement.HAVE_CURRENT_DATA;

  frameElement.classList.toggle(VIDEO_FRAME_FAILED_CLASS_NAME, isFailed);
  frameElement.classList.toggle(VIDEO_FRAME_LOADED_CLASS_NAME, isLoaded && !isFailed);
}

/**
 * 把视频 frame 强制切到失败态，并清除可能已存在的 loaded 标记。
 * @param videoElement 触发失败的视频元素。
 */
function markMarkdownVideoFailed(videoElement: HTMLVideoElement): void {
  // 视频外层 frame 元素。
  const frameElement = videoElement.closest<HTMLElement>(`.${VIDEO_FRAME_CLASS_NAME}`);

  if (!frameElement) {
    return;
  }

  frameElement.classList.add(VIDEO_FRAME_FAILED_CLASS_NAME);
  frameElement.classList.remove(VIDEO_FRAME_LOADED_CLASS_NAME);
}

export { rehypeVideoFigures, hydrateMarkdownVideos };
