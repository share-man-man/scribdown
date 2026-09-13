// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  t,
  MERMAID_BODY_CLASS_NAME,
  MERMAID_ZOOM_VALUE_CLASS_NAME,
  MARKDOWN_SOURCE_DATA_ATTRIBUTE,
  MERMAID_CANVAS_CLASS_NAME,
  MERMAID_FULLSCREEN_BUTTON_CLASS_NAME,
  MERMAID_VIEWER_CANVAS_CLASS_NAME
} from "@scribdown/shared";
import { hydrateMarkdown, renderMarkdown } from "../index";

// 捕获真实 hydration 链路交给 Mermaid 的渲染参数。
const render = vi.hoisted(() => vi.fn(async () => ({ svg: '<svg viewBox="0 0 100 100"></svg>' })));
vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render } }));

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Mermaid Markdown source", () => {
  it.each([
    "```mermaid\ngraph TD\n  A-->B\n```",
    "~~~~mermaid\ngraph TD\n  A-->B\n~~~~",
    "> ```mermaid\n> graph TD\n>   A-->B\n> ```",
    "- ```mermaid\n  graph TD\n    A-->B\n  ```"
  ])("renders cloned figures using only their Markdown attribute: %s", async (markdown) => {
    // detached 阶段只构建结构，不启动渲染。
    const container = document.createElement("div");
    container.innerHTML = await renderMarkdown(markdown);
    hydrateMarkdown(container);
    // 克隆会丢失 WeakMap 状态与原节点事件，模拟宿主 DOM 合并。
    const clone = container.cloneNode(true) as HTMLDivElement;
    // 完整 Markdown 是唯一的源码属性。
    const figure = clone.querySelector("figure");
    expect(figure?.hasAttribute("data-scribdown-mermaid-source-text")).toBe(false);
    expect(decodeURIComponent(figure?.getAttribute(MARKDOWN_SOURCE_DATA_ATTRIBUTE) ?? "")).toBe(
      markdown
    );
    document.body.append(clone);
    hydrateMarkdown(clone);
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(render.mock.calls[0]).toEqual([expect.any(String), "graph TD\n  A-->B"]);
    hydrateMarkdown(clone);
    expect(render).toHaveBeenCalledTimes(1);
    expect(figure?.hasAttribute("data-scribdown-mermaid-source")).toBe(false);
    // 渲染后修改画布，验证全屏使用当前 SVG 而非渲染时的旧缓存。
    const svg = figure?.querySelector<SVGSVGElement>(`.${MERMAID_CANVAS_CLASS_NAME} > svg`);
    svg?.setAttribute("viewBox", "0 0 240 120");
    figure?.querySelector<HTMLButtonElement>(`.${MERMAID_FULLSCREEN_BUTTON_CLASS_NAME}`)?.click();
    // 全屏拿到独立副本，同时保留画布中的最新内容。
    const fullscreenSvg = document.querySelector(`.${MERMAID_VIEWER_CANVAS_CLASS_NAME} > svg`);
    expect(fullscreenSvg?.getAttribute("viewBox")).toBe("0 0 240 120");
    expect(fullscreenSvg).not.toBe(svg);
    expect(svg?.isConnected).toBe(true);
  });
});

/**
 * 创建已渲染的正文图表，供两个宿主场景复用。
 * @returns 已就绪的正文图表。
 */
async function mountInlineFigure(): Promise<HTMLElement> {
  // 承载正文图表的容器。
  const container = document.createElement("div");
  container.innerHTML = await renderMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
  document.body.append(container);
  hydrateMarkdown(container);
  // 等待异步 Mermaid 渲染完成后再操作控件。
  const figure = container.querySelector<HTMLElement>("figure")!;
  await vi.waitFor(() => expect(figure.classList.contains("scribdown-mermaid--loaded")).toBe(true));
  return figure;
}

/**
 * 按本地化名称获取图表内的按钮。
 * @param figure 当前图表实例。
 * @param label 按钮可访问名称。
 * @returns 对应按钮。
 */
function button(figure: HTMLElement, label: string): HTMLButtonElement {
  return figure.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)!;
}

/**
 * 创建可取消的滚轮输入。
 * @param deltaY 垂直滚轮位移。
 * @param ctrlKey 是否按下缩放修饰键。
 * @returns 滚轮事件。
 */
function wheel(deltaY: number, ctrlKey = false): WheelEvent {
  return new WheelEvent("wheel", { deltaY, ctrlKey, bubbles: true, cancelable: true });
}

describe("shared Mermaid renderer interactions", () => {
  it.each([false, true])(
    "uses the same selection, wheel and reset behavior (fullscreen=%s)",
    async (fullscreen) => {
      // 正文实例是全屏宿主的数据来源，状态不会传递给全屏。
      const inline = await mountInlineFigure();
      if (fullscreen) button(inline, t("mermaid.fullscreenButton")).click();
      // 两种场景内部是同一个图表结构。
      const figure = fullscreen ? document.querySelector<HTMLElement>("dialog figure")! : inline;
      // 当前实例视口与缩放显示。
      const viewport = figure.querySelector<HTMLElement>(`.${MERMAID_BODY_CLASS_NAME}`)!;
      // 缩放百分比节点。
      const zoom = figure.querySelector(`.${MERMAID_ZOOM_VALUE_CLASS_NAME}`)!;
      expect(button(figure, t("mermaid.switchToDrag")).getAttribute("aria-pressed")).toBe("false");
      // 选择模式普通滚轮保留滚动，修饰键滚轮缩放。
      const selectionWheel = wheel(-100);
      viewport.dispatchEvent(selectionWheel);
      expect(selectionWheel.defaultPrevented).toBe(false);
      expect(zoom.textContent).toBe("100%");
      // 明确缩放手势由实例接管。
      const zoomWheel = wheel(-100, true);
      viewport.dispatchEvent(zoomWheel);
      expect(zoomWheel.defaultPrevented).toBe(true);
      expect(parseInt(zoom.textContent ?? "")).toBeGreaterThan(100);
      button(figure, t("mermaid.zoomReset")).click();
      expect(zoom.textContent).toBe("100%");
      button(figure, t("mermaid.switchToDrag")).click();
      // 拖拽模式普通滚轮缩放，达到下限时也不向外传播。
      const outerWheel = vi.fn();
      figure.addEventListener("wheel", outerWheel);
      // 下限处仍要拦截滚轮。
      const boundaryWheel = wheel(100000);
      viewport.dispatchEvent(boundaryWheel);
      expect(boundaryWheel.defaultPrevented).toBe(true);
      expect(outerWheel).not.toHaveBeenCalled();
      viewport.dispatchEvent(wheel(-100));
      expect(parseInt(zoom.textContent ?? "")).toBeGreaterThan(100);
      // 键盘重置也走同一个实例。
      figure.dispatchEvent(
        new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true })
      );
      expect(zoom.textContent).toBe("100%");
      // 模拟可滚动视口，验证拖拽结束与模式切换会释放捕获。
      Object.defineProperties(viewport, {
        clientWidth: { value: 200, configurable: true },
        scrollWidth: { value: 1000, configurable: true },
        clientHeight: { value: 200, configurable: true },
        scrollHeight: { value: 1000, configurable: true }
      });
      // 指针捕获由浏览器提供，此处只替代 jsdom 缺失的接口。
      const releasePointerCapture = vi.fn();
      Object.assign(viewport, {
        setPointerCapture: vi.fn(),
        hasPointerCapture: () => true,
        releasePointerCapture
      });
      viewport.dispatchEvent(pointer("pointerdown", 100, 100));
      viewport.dispatchEvent(pointer("pointermove", 70, 60));
      expect(viewport.scrollLeft).toBe(30);
      expect(viewport.scrollTop).toBe(40);
      button(figure, t("mermaid.switchToSelect")).click();
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
      viewport.dispatchEvent(pointer("pointermove", 20, 20));
      expect(viewport.scrollLeft).toBe(30);
      expect(figure.classList.contains("scribdown-mermaid--dragging")).toBe(false);
      // 两个场景共用复制实现，输出完整 Markdown。
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      button(figure, t("content.copy")).click();
      expect(writeText).toHaveBeenCalledWith("```mermaid\ngraph TD\n  A-->B\n```");
    }
  );

  it("keeps modes independent and creates fresh state each time fullscreen opens", async () => {
    // 正文先进入拖拽模式。
    const inline = await mountInlineFigure();
    button(inline, t("mermaid.switchToDrag")).click();
    button(inline, t("mermaid.fullscreenButton")).click();
    // 全屏从默认选择模式开始，不继承正文状态。
    const fullscreen = document.querySelector<HTMLElement>("dialog figure")!;
    expect(button(fullscreen, t("mermaid.switchToDrag"))).not.toBeNull();
    button(fullscreen, t("mermaid.switchToDrag")).click();
    button(fullscreen, t("mermaid.close")).click();
    expect(fullscreen.isConnected).toBe(false);
    expect(button(inline, t("mermaid.switchToSelect"))).not.toBeNull();
    button(inline, t("mermaid.fullscreenButton")).click();
    // 重新打开创建新实例，上次的模式与缩放不会残留。
    const reopened = document.querySelector<HTMLElement>("dialog figure")!;
    expect(reopened).not.toBe(fullscreen);
    expect(button(reopened, t("mermaid.switchToDrag"))).not.toBeNull();
    expect(reopened.querySelector(`.${MERMAID_ZOOM_VALUE_CLASS_NAME}`)?.textContent).toBe("100%");
    button(reopened, t("mermaid.close")).click();
  });
});

/**
 * 创建用于拖拽回归验证的指针事件。
 * @param type 指针阶段。
 * @param clientX 客户端横坐标。
 * @param clientY 客户端纵坐标。
 * @returns 带固定指针编号的事件。
 */
function pointer(type: string, clientX: number, clientY: number): MouseEvent {
  return Object.assign(
    new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true, cancelable: true }),
    { pointerId: 1 }
  );
}
