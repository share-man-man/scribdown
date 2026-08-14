import { describe, expect, it } from "vitest";

import {
  getMarkdownViewerAnchoredScrollOffset,
  getMarkdownViewerWheelZoom,
  getMarkdownViewerZoomStep,
  readMarkdownViewerViewportSize,
  shouldZoomMarkdownViewerWheel,
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

  it("always zooms wheel events in drag mode", () => {
    /** 拖拽模式下的滚轮事件。 */
    const dragWheelIntent = {
      isDragMode: true,
      ctrlKey: false,
      metaKey: false
    };

    expect(shouldZoomMarkdownViewerWheel(dragWheelIntent)).toBe(true);
  });

  it("keeps unmodified selection-mode scrolling and supports explicit modifier zoom", () => {
    /** 选择模式下未按修饰键的滚轮事件。 */
    const selectionWheelIntent = {
      isDragMode: false,
      ctrlKey: false,
      metaKey: false
    };

    expect(shouldZoomMarkdownViewerWheel(selectionWheelIntent)).toBe(false);
    expect(shouldZoomMarkdownViewerWheel({ ...selectionWheelIntent, ctrlKey: true })).toBe(true);
    expect(shouldZoomMarkdownViewerWheel({ ...selectionWheelIntent, metaKey: true })).toBe(true);
  });

  it("keeps the content coordinate under the pointer stable after zoom", () => {
    // 缩放后内容实际左边界为 40，指针下 50% 内容要求左边界为 -80。
    expect(getMarkdownViewerAnchoredScrollOffset(200, 40, 320, 0.5, 800)).toBe(320);
    // 应用新增的 120 滚动量后，内容左边界恰好移动到目标 -80。
    expect(40 - (320 - 200)).toBe(-80);
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
