import { ChangeEvent, ReactElement, useEffect, useState } from "react";
import { PROJECT_NAME } from "@scribdown/shared";
import "@scribdown/ui-handdrawn/styles.css";
import {
  DEFAULT_REFRESH_INTERVAL_SEC,
  EXTENSION_ENABLED_STORAGE_KEY,
  MAX_REFRESH_INTERVAL_SEC,
  MIN_REFRESH_INTERVAL_SEC,
  REFRESH_ENABLED_STORAGE_KEY,
  REFRESH_INTERVAL_STORAGE_KEY
} from "./constants";

/**
 * popup 初次挂载时读取到的扩展配置。
 */
interface PopupInitialState {
  /** 扩展当前是否启用。 */
  enabled: boolean;
  /** 自动刷新开关是否开启。 */
  refreshEnabled: boolean;
  /** 内容刷新间隔（秒），已 clamp 到合法范围。 */
  intervalSec: number;
}

/**
 * 将任意输入值 clamp 到允许的刷新间隔范围内。
 * 非法值（NaN / 非数字）回落到默认值。
 * @param value 原始输入值。
 * @returns 合法范围内的整数秒数。
 */
function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REFRESH_INTERVAL_SEC;
  /** 向下取整后的秒数，避免小数引入显示歧义。 */
  const integer = Math.floor(value);
  return Math.min(
    MAX_REFRESH_INTERVAL_SEC,
    Math.max(MIN_REFRESH_INTERVAL_SEC, integer)
  );
}

/**
 * 从 chrome.storage.local 读取扩展启用状态与刷新间隔。
 * 未设置项分别回落到「启用 / 默认间隔」。
 * @returns 初始化 popup 所需的状态快照。
 */
async function readInitialState(): Promise<PopupInitialState> {
  /** storage 一次性读取结果。 */
  const result = await chrome.storage.local.get([
    EXTENSION_ENABLED_STORAGE_KEY,
    REFRESH_ENABLED_STORAGE_KEY,
    REFRESH_INTERVAL_STORAGE_KEY
  ]);
  /** 解析后的启用状态，未显式置 false 视为启用。 */
  const enabled = result[EXTENSION_ENABLED_STORAGE_KEY] !== false;
  /** 解析后的自动刷新开关，未显式置 false 视为启用。 */
  const refreshEnabled = result[REFRESH_ENABLED_STORAGE_KEY] !== false;
  /** storage 中原始间隔值。 */
  const rawInterval = result[REFRESH_INTERVAL_STORAGE_KEY];
  /** 解析后的间隔秒数。 */
  const intervalSec =
    typeof rawInterval === "number"
      ? clampInterval(rawInterval)
      : DEFAULT_REFRESH_INTERVAL_SEC;
  return { enabled, refreshEnabled, intervalSec };
}

/**
 * 扩展 popup 配置页面。
 * 提供整体启用/关闭开关、源文件刷新间隔配置。
 * @returns React 元素。
 */
export function Popup(): ReactElement {
  /** 扩展当前是否启用。 */
  const [enabled, setEnabled] = useState<boolean>(true);
  /**
   * 是否展示「刷新页面以生效」提示。
   * 仅在用户本次会话内手动切换过开关后出现，避免初次打开 popup 就误导用户。
   */
  const [showRefreshTip, setShowRefreshTip] = useState<boolean>(false);
  /** 当前显示的刷新间隔（秒），与 storage 双向绑定。 */
  const [intervalSec, setIntervalSec] = useState<number>(
    DEFAULT_REFRESH_INTERVAL_SEC
  );
  /** 自动刷新开关当前状态。 */
  const [refreshEnabled, setRefreshEnabled] = useState<boolean>(true);

  useEffect(() => {
    void readInitialState().then((state) => {
      setEnabled(state.enabled);
      setRefreshEnabled(state.refreshEnabled);
      setIntervalSec(state.intervalSec);
    });

    /**
     * 监听 storage 变化，保证多窗口/外部更新时 popup 状态同步。
     * @param changes 变化集合。
     * @param area 变化所属 storage 区域。
     */
    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName
    ): void => {
      if (area !== "local") return;
      if (EXTENSION_ENABLED_STORAGE_KEY in changes) {
        setEnabled(changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false);
      }
      if (REFRESH_ENABLED_STORAGE_KEY in changes) {
        setRefreshEnabled(
          changes[REFRESH_ENABLED_STORAGE_KEY].newValue !== false
        );
      }
      if (REFRESH_INTERVAL_STORAGE_KEY in changes) {
        /** 外部写入的新间隔值。 */
        const nextRaw = changes[REFRESH_INTERVAL_STORAGE_KEY].newValue;
        setIntervalSec(
          typeof nextRaw === "number"
            ? clampInterval(nextRaw)
            : DEFAULT_REFRESH_INTERVAL_SEC
        );
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  /**
   * 切换扩展启用状态并写回 storage。
   */
  const handleToggle = (): void => {
    /** 切换后的启用状态。 */
    const next = !enabled;
    setEnabled(next);
    // 关键步骤：content script 已经注入的页面不会回头执行，需要用户刷新一次才能让新状态生效。
    setShowRefreshTip(true);
    void chrome.storage.local.set({ [EXTENSION_ENABLED_STORAGE_KEY]: next });
  };

  /**
   * 切换自动刷新开关并写回 storage。
   */
  const handleRefreshToggle = (): void => {
    /** 切换后的自动刷新状态。 */
    const next = !refreshEnabled;
    setRefreshEnabled(next);
    void chrome.storage.local.set({ [REFRESH_ENABLED_STORAGE_KEY]: next });
  };

  /**
   * 处理刷新间隔输入框变化：clamp 后写回 storage。
   * @param event input change 事件。
   */
  const handleIntervalChange = (event: ChangeEvent<HTMLInputElement>): void => {
    /** 用户输入解析后的秒数。 */
    const parsed = Number(event.target.value);
    /** clamp 到允许范围后的最终值。 */
    const next = clampInterval(parsed);
    setIntervalSec(next);
    void chrome.storage.local.set({ [REFRESH_INTERVAL_STORAGE_KEY]: next });
  };

  return (
    <main className="scribdown-popup">
      <header className="scribdown-popup__header">
        <span className="scribdown-popup__logo">✏️</span>
        <h1 className="scribdown-popup__title">{PROJECT_NAME}</h1>
      </header>

      <div className="scribdown-popup__toggle">
        <div className="scribdown-popup__toggle-meta">
          <span className="scribdown-popup__toggle-label">启用 Scribdown</span>
          <span className="scribdown-popup__toggle-hint">
            {enabled ? "已启用：自动接管 .md 文件预览" : "已关闭：访问 .md 不再被接管"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="启用 Scribdown"
          className={
            enabled
              ? "scribdown-popup__switch scribdown-popup__switch--on"
              : "scribdown-popup__switch"
          }
          onClick={handleToggle}
        >
          <span className="scribdown-popup__switch-knob" />
        </button>
      </div>

      <div className="scribdown-popup__toggle">
        <div className="scribdown-popup__toggle-meta">
          <span className="scribdown-popup__toggle-label">本地文件自动刷新</span>
          <span className="scribdown-popup__toggle-hint">
            {refreshEnabled
              ? `已开启：每 ${intervalSec} 秒回拉一次本地 .md 文件`
              : "已关闭：本地 .md 更新后需手动刷新页面"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={refreshEnabled}
          aria-label="本地文件自动刷新"
          className={
            refreshEnabled
              ? "scribdown-popup__switch scribdown-popup__switch--on"
              : "scribdown-popup__switch"
          }
          onClick={handleRefreshToggle}
        >
          <span className="scribdown-popup__switch-knob" />
        </button>
      </div>

      {refreshEnabled && (
        <div className="scribdown-popup__field">
          <div className="scribdown-popup__field-meta">
            <label
              className="scribdown-popup__field-label"
              htmlFor="scribdown-refresh-interval"
            >
              刷新间隔
            </label>
            <span className="scribdown-popup__field-hint">
              {MIN_REFRESH_INTERVAL_SEC} – {MAX_REFRESH_INTERVAL_SEC} 秒之间
            </span>
          </div>
          <div className="scribdown-popup__field-input">
            <input
              id="scribdown-refresh-interval"
              type="number"
              inputMode="numeric"
              min={MIN_REFRESH_INTERVAL_SEC}
              max={MAX_REFRESH_INTERVAL_SEC}
              step={1}
              value={intervalSec}
              onChange={handleIntervalChange}
              className="scribdown-popup__field-number"
            />
            <span className="scribdown-popup__field-unit">秒</span>
          </div>
        </div>
      )}

      {showRefreshTip && (
        <p className="scribdown-popup__tip" role="status">
          切换已保存，刷新当前页面后生效。
        </p>
      )}
    </main>
  );
}
