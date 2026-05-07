import { renderMarkdown } from "@scribdown/markdown-renderer";
import { MARKDOWN_FIXTURE_PREVIEW_TITLE, PROJECT_NAME } from "@scribdown/shared";
import "@scribdown/ui-handdrawn/styles.css";
import fixtureMarkdown from "../../docs/ui-design/markdown-fixture.md?raw";
import "./styles.css";

/**
 * Markdown fixture 预览挂载点集合。
 */
interface PreviewMounts {
  previewOutput: HTMLElement;
  productName: HTMLElement;
  sourceOutput: HTMLElement;
  statusText: HTMLElement;
  titleText: HTMLElement;
  updatedAt: HTMLTimeElement;
}

/**
 * 开发预览根节点 ID。
 */
const PREVIEW_ROOT_ID = "markdown-fixture-preview-root";

/**
 * 从页面中读取必需挂载节点。
 * @param elementId 页面元素 ID。
 * @returns 已确认存在的 HTMLElement。
 */
function getRequiredElement<TElement extends HTMLElement>(elementId: string): TElement {
  /** 页面中查询得到的元素。 */
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`Unable to find preview element: ${elementId}`);
  }

  return element as TElement;
}

/**
 * 读取预览页面的所有挂载点。
 * @returns 挂载点集合。
 */
function getPreviewMounts(): PreviewMounts {
  return {
    previewOutput: getRequiredElement("fixture-preview-output"),
    productName: getRequiredElement("fixture-preview-product"),
    sourceOutput: getRequiredElement("fixture-preview-source"),
    statusText: getRequiredElement("fixture-preview-status"),
    titleText: getRequiredElement("fixture-preview-title"),
    updatedAt: getRequiredElement("fixture-preview-updated-at")
  };
}

/**
 * 渲染固定 Markdown fixture。
 * @param markdownText 用于开发预览的 Markdown 原文。
 * @param mounts 预览页面挂载点集合。
 */
async function renderFixture(markdownText: string, mounts: PreviewMounts): Promise<void> {
  // 使用真实渲染链路，避免设计预览与宿主预览出现实现偏差。
  /** Markdown 转换后的安全 HTML。 */
  const renderedHtml = await renderMarkdown(markdownText, { sanitizeHtml: true });

  /** 当前渲染完成时间。 */
  const renderedAt = new Date();

  mounts.productName.textContent = PROJECT_NAME;
  mounts.titleText.textContent = MARKDOWN_FIXTURE_PREVIEW_TITLE;
  mounts.sourceOutput.textContent = markdownText;
  mounts.previewOutput.innerHTML = renderedHtml;
  mounts.statusText.textContent = "Ready";
  mounts.updatedAt.dateTime = renderedAt.toISOString();
  mounts.updatedAt.textContent = renderedAt.toLocaleTimeString();
}

/**
 * 启动 Markdown fixture 开发预览。
 * @param rootElementId 开发预览根节点 ID。
 */
function bootstrapPreview(rootElementId: string): void {
  /** 开发预览根节点。 */
  const rootElement = getRequiredElement(rootElementId);

  rootElement.dataset.ready = "false";

  void renderFixture(fixtureMarkdown, getPreviewMounts()).then(() => {
    rootElement.dataset.ready = "true";
  });
}

bootstrapPreview(PREVIEW_ROOT_ID);
