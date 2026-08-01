import { describe, expect, it } from "vitest";

import {
  clampMarkdownMermaidZoom,
  getMarkdownMermaidZoomBounds
} from "./mermaid-zoom-geometry";

describe("getMarkdownMermaidZoomBounds", () => {
  it("derives the maximum zoom from the median rendered text height", () => {
    /** 文字中位高度为 20px 时，放大到目标 80px 需要四倍缩放。 */
    const zoomBounds = getMarkdownMermaidZoomBounds({
      currentZoom: 1,
      fitScale: 0.5,
      naturalWidth: 1200,
      naturalHeight: 800,
      textHeights: [10, 20, 30]
    });

    expect(zoomBounds).toEqual({ min: 1, max: 4 });
  });

  it("changes the maximum zoom when diagram text size changes", () => {
    /** 小字号图表需要更大的最大缩放倍数。 */
    const smallTextBounds = getMarkdownMermaidZoomBounds({
      currentZoom: 1,
      fitScale: 0.5,
      naturalWidth: 1200,
      naturalHeight: 800,
      textHeights: [10]
    });
    /** 大字号图表更早达到检查高度。 */
    const largeTextBounds = getMarkdownMermaidZoomBounds({
      currentZoom: 1,
      fitScale: 0.5,
      naturalWidth: 1200,
      naturalHeight: 800,
      textHeights: [40]
    });

    expect(smallTextBounds.max).toBe(8);
    expect(largeTextBounds.max).toBe(2);
  });

  it("falls back to diagram dimensions when no text can be measured", () => {
    /** 无文字图表按固有尺寸和适配比例计算动态兜底上限。 */
    const zoomBounds = getMarkdownMermaidZoomBounds({
      currentZoom: 1,
      fitScale: 0.5,
      naturalWidth: 1600,
      naturalHeight: 900,
      textHeights: []
    });

    expect(zoomBounds).toEqual({ min: 1, max: 80 });
  });
});

describe("clampMarkdownMermaidZoom", () => {
  it("clamps zoom values to the current diagram bounds", () => {
    /** 当前图表的内容自适应缩放边界。 */
    const zoomBounds = { min: 1, max: 2.5 };

    expect(clampMarkdownMermaidZoom(0.5, zoomBounds)).toBe(1);
    expect(clampMarkdownMermaidZoom(2, zoomBounds)).toBe(2);
    expect(clampMarkdownMermaidZoom(4, zoomBounds)).toBe(2.5);
  });
});
