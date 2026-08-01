import { describe, expect, it } from "vitest";

import {
  getMarkdownViewerWheelZoom,
  getMarkdownViewerZoomStep,
  readMarkdownViewerViewportSize,
  shouldSkipMarkdownViewerAnchoredZoom
} from "./viewer-shared";

describe("viewer zoom geometry", () => {
  it("scales button steps with the current zoom value", () => {
    expect(getMarkdownViewerZoomStep(1)).toBe(0.25);
    expect(getMarkdownViewerZoomStep(4)).toBe(1);
  });

  it("scales wheel deltas with the current zoom value", () => {
    expect(getMarkdownViewerWheelZoom(1, -5)).toBe(1.05);
    expect(getMarkdownViewerWheelZoom(4, -5)).toBe(4.2);
    expect(getMarkdownViewerWheelZoom(4, -100)).toBe(4.4);
  });

  it("skips anchored focal-point updates after zoom reaches a boundary", () => {
    /** 模拟触控板缩放时的光标锚点。 */
    const zoomAnchor = { x: 320, y: 240 };

    expect(shouldSkipMarkdownViewerAnchoredZoom(4, 4, zoomAnchor)).toBe(true);
    expect(shouldSkipMarkdownViewerAnchoredZoom(3.9, 4, zoomAnchor)).toBe(false);
    expect(shouldSkipMarkdownViewerAnchoredZoom(4, 4)).toBe(false);
  });
});

describe("readMarkdownViewerViewportSize", () => {
  it("uses the layout box instead of the scrollbar-sensitive client box", () => {
    /** 模拟滚动条已占用 15px 内容区的查看器视口。 */
    const viewportElement = {
      offsetWidth: 800,
      offsetHeight: 600,
      clientWidth: 785,
      clientHeight: 585,
      getBoundingClientRect: () => ({ width: 800, height: 600 })
    } as HTMLElement;

    expect(readMarkdownViewerViewportSize(viewportElement)).toEqual({
      width: 800,
      height: 600
    });
  });

  it("falls back to the client rectangle before layout offsets are available", () => {
    /** 模拟 offset 尺寸尚不可用但客户端矩形已经可测量的宿主。 */
    const viewportElement = {
      offsetWidth: 0,
      offsetHeight: 0,
      clientWidth: 585,
      clientHeight: 385,
      getBoundingClientRect: () => ({ width: 600, height: 400 })
    } as HTMLElement;

    expect(readMarkdownViewerViewportSize(viewportElement)).toEqual({
      width: 600,
      height: 400
    });
  });
});
