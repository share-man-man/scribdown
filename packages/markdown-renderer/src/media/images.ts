/**
 * 图片渲染：remark 插件把独占段落的图片转换为 figure 结构（含失败态占位），
 * hydrate 阶段为图片绑定加载/失败状态类与全图查看入口。
 */

import {
  IMAGE_CAPTION_CLASS_NAME,
  IMAGE_ELEMENT_CLASS_NAME,
  IMAGE_FALLBACK_CLASS_NAME,
  IMAGE_FALLBACK_ICON_CLASS_NAME,
  IMAGE_FALLBACK_SOURCE_CLASS_NAME,
  IMAGE_FALLBACK_TEXT_CLASS_NAME,
  IMAGE_FIGURE_CLASS_NAME,
  IMAGE_FRAME_CLASS_NAME,
  IMAGE_FRAME_FAILED_CLASS_NAME,
  IMAGE_FRAME_LOADED_CLASS_NAME
} from "@scribdown/shared";

import type { Image, ImageReference, Paragraph, Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";

import {
  isImageNode,
  type ImageFallback,
  type ImageFigure,
  type ImageFrame,
  type ImageCaption
} from "../core/ast";
import { bindMarkdownImageViewer } from "./image-viewer";

// 图片运行时已绑定标记的 dataset 键。
const IMAGE_HYDRATED_DATA_KEY = "scribdownImageHydrated";

/**
 * remark 插件：把独占段落的图片转换为 figure 结构。
 * @returns Markdown AST 转换器。
 */
function remarkImageFigures(): (tree: Root) => void {
  return (tree: Root) => {
    // 关键步骤：先把独占图片段落整体替换为 figure（跳过内部，避免重复装饰），
    // 再为剩余的行内图片补统一 class。
    visit(tree, "paragraph", (node, index, parent) => {
      if (parent === undefined || index === undefined) {
        return;
      }

      // 当前图片段落转换出的 figure 节点。
      const imageFigureNode = createImageFigureNode(node);

      if (imageFigureNode) {
        parent.children[index] = imageFigureNode;
        return SKIP;
      }
    });

    visit(tree, isImageNode, (node) => {
      decorateImageNode(node);
    });
  };
}

/**
 * 尝试把独占图片段落转换为 figure 节点。
 * @param node 待转换的段落节点。
 * @returns 转换后的 figure 节点，不匹配时返回 undefined。
 */
function createImageFigureNode(node: Paragraph): ImageFigure | undefined {
  if (node.children.length !== 1) {
    return undefined;
  }

  // 段落内唯一的行内节点。
  const onlyChild = node.children[0];

  if (!isImageNode(onlyChild)) {
    return undefined;
  }

  decorateImageNode(onlyChild);

  return {
    type: "imageFigure",
    // 关键步骤：保留原段落源码位置，使 remarkSourceLine 能为 figure 标注 data-source-line。
    position: node.position,
    data: {
      hName: "figure",
      hProperties: {
        className: [IMAGE_FIGURE_CLASS_NAME]
      }
    },
    children: [createImageFrameNode(onlyChild), ...createImageCaptionNodes(onlyChild)]
  };
}

/**
 * 给图片节点写入统一 class。
 * @param imageNode 图片节点。
 */
function decorateImageNode(imageNode: Image | ImageReference): void {
  imageNode.data = {
    ...imageNode.data,
    hProperties: {
      ...imageNode.data?.hProperties,
      className: [IMAGE_ELEMENT_CLASS_NAME]
    }
  };
}

/**
 * 创建图片边框容器节点。
 * @param imageNode 图片节点。
 * @returns 图片边框容器节点。
 */
function createImageFrameNode(imageNode: Image | ImageReference): ImageFrame {
  return {
    type: "imageFrame",
    data: {
      hName: "span",
      hProperties: {
        className: [IMAGE_FRAME_CLASS_NAME]
      }
    },
    children: [imageNode, createImageFallbackNode(imageNode)]
  };
}

/**
 * 创建图片标题节点列表。
 * @param imageNode 图片节点。
 * @returns 图片标题节点列表。
 */
function createImageCaptionNodes(imageNode: Image | ImageReference): ImageCaption[] {
  // 图片 title 属性文本，用于生成 figcaption；引用式图片的 title 在定义节点上，此处无 caption。
  const imageTitle =
    imageNode.type === "image" && typeof imageNode.title === "string"
      ? imageNode.title.trim()
      : "";

  if (imageTitle.length === 0) {
    return [];
  }

  return [
    {
      type: "imageCaption",
      data: {
        hName: "figcaption",
        hProperties: {
          className: [IMAGE_CAPTION_CLASS_NAME]
        }
      },
      children: [{ type: "text", value: imageTitle }]
    }
  ];
}

/**
 * 创建图片失败态占位节点。
 * @param imageNode 图片节点。
 * @returns 图片失败态占位节点。
 */
function createImageFallbackNode(imageNode: Image | ImageReference): ImageFallback {
  // 图片失败态展示的 alt 文本。
  const fallbackText = imageNode.alt?.trim() || "图片加载失败";
  // 图片失败态展示的来源路径：直接图片取 url，引用式图片取引用标识。
  const fallbackSource = imageNode.type === "image" ? imageNode.url : imageNode.identifier;

  return {
    type: "imageFallback",
    data: {
      hName: "span",
      hProperties: {
        className: [IMAGE_FALLBACK_CLASS_NAME]
      }
    },
    children: [
      {
        type: "imageFallbackIcon",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_ICON_CLASS_NAME]
          }
        }
      },
      {
        type: "imageFallbackText",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_TEXT_CLASS_NAME]
          }
        },
        children: [{ type: "text", value: fallbackText }]
      },
      {
        type: "imageFallbackSource",
        data: {
          hName: "span",
          hProperties: {
            className: [IMAGE_FALLBACK_SOURCE_CLASS_NAME]
          }
        },
        children: [{ type: "text", value: fallbackSource }]
      }
    ]
  };
}

/**
 * 给渲染后的图片绑定加载状态类名。
 * @param rootElement 包含 Markdown 渲染结果的根节点。
 */
function hydrateMarkdownImages(rootElement: ParentNode): void {
  // 当前根节点内的所有图片元素。
  const imageElements = rootElement.querySelectorAll<HTMLImageElement>(
    `img.${IMAGE_ELEMENT_CLASS_NAME}`
  );

  imageElements.forEach(bindMarkdownImageState);
}

/**
 * 给单个图片元素绑定加载、失败状态与全图查看行为。
 * @param imageElement 待绑定状态的图片元素。
 */
function bindMarkdownImageState(imageElement: HTMLImageElement): void {
  updateMarkdownImageState(imageElement);

  if (imageElement.dataset[IMAGE_HYDRATED_DATA_KEY] === "true") {
    return;
  }

  imageElement.dataset[IMAGE_HYDRATED_DATA_KEY] = "true";
  imageElement.addEventListener("load", handleMarkdownImageLoad);
  imageElement.addEventListener("error", handleMarkdownImageError);
  bindMarkdownImageViewer(imageElement);
}

/**
 * 处理图片加载成功事件。
 * @param event 图片加载事件。
 */
function handleMarkdownImageLoad(event: Event): void {
  // 触发加载事件的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  updateMarkdownImageState(imageElement);
}

/**
 * 处理图片加载失败事件。
 * @param event 图片加载失败事件。
 */
function handleMarkdownImageError(event: Event): void {
  // 触发失败事件的图片元素。
  const imageElement = event.currentTarget as HTMLImageElement;

  updateMarkdownImageState(imageElement);
}

/**
 * 根据图片当前加载结果更新 frame 状态类。
 * @param imageElement 待更新状态的图片元素。
 */
function updateMarkdownImageState(imageElement: HTMLImageElement): void {
  // 图片外层 frame 元素。
  const frameElement = imageElement.closest<HTMLElement>(`.${IMAGE_FRAME_CLASS_NAME}`);

  if (!frameElement) {
    return;
  }

  // 当前图片是否已确认加载失败。
  const isFailed = imageElement.complete && imageElement.naturalWidth === 0;
  // 当前图片是否已确认加载完成。
  const isLoaded = imageElement.complete && imageElement.naturalWidth > 0;

  frameElement.classList.toggle(IMAGE_FRAME_FAILED_CLASS_NAME, isFailed);
  frameElement.classList.toggle(IMAGE_FRAME_LOADED_CLASS_NAME, isLoaded);
}

export { remarkImageFigures, hydrateMarkdownImages };
