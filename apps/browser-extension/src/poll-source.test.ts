import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REFRESH_INTERVAL_SEC,
  EXTENSION_ENABLED_STORAGE_KEY,
  REFRESH_ENABLED_STORAGE_KEY,
  REFRESH_INTERVAL_STORAGE_KEY
} from "./constants";
import { startPollingSource } from "./poll-source";

describe("startPollingSource", () => {
  /** 当前测试用的 storage 状态。 */
  let storageState: Record<string, unknown>;
  /** 当前注册到 chrome.storage.onChanged 的监听器。 */
  let storageListener:
    | ((
        changes: Record<string, chrome.storage.StorageChange>,
        area: chrome.storage.AreaName
      ) => void)
    | undefined;

  beforeEach(() => {
    storageState = {
      [EXTENSION_ENABLED_STORAGE_KEY]: true,
      [REFRESH_ENABLED_STORAGE_KEY]: true,
      [REFRESH_INTERVAL_STORAGE_KEY]: 1
    };
    storageListener = undefined;
    vi.useFakeTimers();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => storageState)
        },
        onChanged: {
          addListener: vi.fn(
            (
              listener: (
                changes: Record<string, chrome.storage.StorageChange>,
                area: chrome.storage.AreaName
              ) => void
            ) => {
              storageListener = listener;
            }
          ),
          removeListener: vi.fn()
        }
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls after the configured interval and rerenders changed content", async () => {
    /** 拉取最新内容的测试替身。 */
    const fetchLatest = vi.fn(async () => "updated");
    /** 内容变化回调的测试替身。 */
    const onChange = vi.fn();

    startPollingSource({
      initialContent: "initial",
      fetchLatest,
      onChange
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchLatest).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("updated");
  });

  it("does not schedule polling when refresh is disabled", async () => {
    storageState = {
      [EXTENSION_ENABLED_STORAGE_KEY]: true,
      [REFRESH_ENABLED_STORAGE_KEY]: false,
      [REFRESH_INTERVAL_STORAGE_KEY]: DEFAULT_REFRESH_INTERVAL_SEC
    };
    /** 拉取最新内容的测试替身。 */
    const fetchLatest = vi.fn(async () => "updated");
    /** 内容变化回调的测试替身。 */
    const onChange = vi.fn();

    startPollingSource({
      initialContent: "initial",
      fetchLatest,
      onChange
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_REFRESH_INTERVAL_SEC * 1000);

    expect(fetchLatest).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops scheduling after storage disables the extension", async () => {
    /** 拉取最新内容的测试替身。 */
    const fetchLatest = vi.fn(async () => "initial");
    /** 内容变化回调的测试替身。 */
    const onChange = vi.fn();

    startPollingSource({
      initialContent: "initial",
      fetchLatest,
      onChange
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(storageListener).toBeDefined();
    storageState = {
      [EXTENSION_ENABLED_STORAGE_KEY]: false,
      [REFRESH_ENABLED_STORAGE_KEY]: true,
      [REFRESH_INTERVAL_STORAGE_KEY]: 1
    };
    storageListener?.(
      {
        [EXTENSION_ENABLED_STORAGE_KEY]: {
          oldValue: true,
          newValue: false
        }
      },
      "local"
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchLatest).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
