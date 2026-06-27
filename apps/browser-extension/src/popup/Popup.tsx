import { ChangeEvent, ReactElement, useEffect, useRef, useState } from "react";
import { PROJECT_NAME } from "@scribdown/shared";
import "@scribdown/ui-handdrawn/styles.css";
import {
  DEFAULT_REFRESH_INTERVAL_SEC,
  EXTENSION_ENABLED_STORAGE_KEY,
  MAX_REFRESH_INTERVAL_SEC,
  MIN_REFRESH_INTERVAL_SEC,
  clampRefreshIntervalSec,
  parseRefreshIntervalSec,
  REFRESH_ENABLED_STORAGE_KEY,
  REFRESH_INTERVAL_STORAGE_KEY
} from "../config/storage";
import { REFRESH_BADGE_MESSAGE } from "../messages/runtime";

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
  /** 解析后的间隔秒数。 */
  const intervalSec = parseRefreshIntervalSec(result[REFRESH_INTERVAL_STORAGE_KEY]);
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
  /**
   * 当前扩展是否被授予「允许访问文件网址」。
   * null 表示尚未读取完成（避免文案在加载瞬间从「未开启」跳到「已开启」）。
   */
  const [fileAccessAllowed, setFileAccessAllowed] = useState<boolean | null>(
    null
  );
  /**
   * 当前展开的说明气泡 id。同时只允许展开一个，避免气泡相互遮挡。
   * - "refresh"：自动刷新开关行的说明
   * - "interval"：刷新间隔行的说明
   * - null：全部收起
   */
  const [openTip, setOpenTip] = useState<"refresh" | "interval" | null>(null);
  /** 自动刷新行说明气泡的锚定容器引用，用于检测点击是否在其外部。 */
  const refreshTipAnchorRef = useRef<HTMLSpanElement>(null);
  /** 刷新间隔行说明气泡的锚定容器引用，用于检测点击是否在其外部。 */
  const intervalTipAnchorRef = useRef<HTMLSpanElement>(null);

  // 关键步骤：气泡展开时监听全局 mousedown / Escape，点击外部或按 Esc 关闭。
  useEffect(() => {
    if (!openTip) return;
    /** 当前展开气泡对应的锚点引用，用于命中测试。 */
    const activeAnchorRef =
      openTip === "refresh" ? refreshTipAnchorRef : intervalTipAnchorRef;
    /**
     * 点击锚定容器外部时收起气泡。
     * @param event 全局 mousedown 事件。
     */
    const handlePointerDown = (event: MouseEvent): void => {
      if (activeAnchorRef.current?.contains(event.target as Node)) return;
      setOpenTip(null);
    };
    /**
     * 按下 Escape 时收起气泡。
     * @param event 键盘事件。
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpenTip(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openTip]);

  useEffect(() => {
    void readInitialState().then((state) => {
      setEnabled(state.enabled);
      setRefreshEnabled(state.refreshEnabled);
      setIntervalSec(state.intervalSec);
    });

    /**
     * 同步「允许访问文件网址」状态。
     * Chrome 没有提供该开关的变化事件，需要在 popup 打开 / 重新聚焦时主动重查；
     * 同时让 background 重查一次徽标，确保用户从扩展详情页切回时图标 ! 能及时消失。
     */
    const refreshFileAccess = (): void => {
      void chrome.extension.isAllowedFileSchemeAccess().then((allowed) => {
        setFileAccessAllowed(allowed);
      });
      void chrome.runtime.sendMessage({ type: REFRESH_BADGE_MESSAGE });
    };
    refreshFileAccess();

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
        setIntervalSec(parseRefreshIntervalSec(nextRaw));
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    // 关键步骤：用户从扩展详情页切回 popup 时（focus），重新查一遍开关状态。
    window.addEventListener("focus", refreshFileAccess);
    return () => {
      chrome.storage.onChanged.removeListener(handleChange);
      window.removeEventListener("focus", refreshFileAccess);
    };
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
    const next = clampRefreshIntervalSec(parsed);
    setIntervalSec(next);
    void chrome.storage.local.set({ [REFRESH_INTERVAL_STORAGE_KEY]: next });
  };

  /**
   * 打开扩展详情页，便于用户找到「允许访问文件网址」开关并打开。
   * 该开关只能由用户在 chrome://extensions/ 中手动切换，扩展无法以编程方式开启。
   */
  const handleOpenFileAccessSettings = (): void => {
    /** 当前扩展详情页 URL；锚定 id 后 Chrome 会直接跳到对应卡片。 */
    const detailsUrl = `chrome://extensions/?id=${chrome.runtime.id}`;
    void chrome.tabs.create({ url: detailsUrl });
  };

  /**
   * 是否需要顶部强提示：未开启「允许访问文件网址」。
   * `fileAccessAllowed === null` 阶段不展示，避免加载瞬间闪现。
   * 不再要求当前 tab 是本地 .md：当文件访问关闭时，Chrome 会对扩展隐藏
   * file:// 标签页的 URL，按 tab 判断会漏掉很多场景。
   */
  const showFileAccessBanner = fileAccessAllowed === false;

  return (
    <main className="scribdown-popup">
      <header className="scribdown-popup__header">
        <span className="scribdown-popup__logo">✏️</span>
        <h1 className="scribdown-popup__title">{PROJECT_NAME}</h1>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="启用 Scribdown"
          title={enabled ? "已启用 Scribdown" : "已关闭 Scribdown"}
          className={
            enabled
              ? "scribdown-popup__switch scribdown-popup__switch--header scribdown-popup__switch--on"
              : "scribdown-popup__switch scribdown-popup__switch--header"
          }
          onClick={handleToggle}
        >
          <span className="scribdown-popup__switch-knob" />
        </button>
      </header>

      {!enabled && (
        <p className="scribdown-popup__empty" role="status">
          已关闭，访问 .md 不再被接管。
        </p>
      )}

      {enabled && showFileAccessBanner && (
        <div className="scribdown-popup__banner" role="alert">
          <div className="scribdown-popup__banner-meta">
            <span className="scribdown-popup__banner-title">
              ⚠️ 「允许访问文件网址」未开启
            </span>
            <span className="scribdown-popup__banner-text">
              本地 .md 文件无法被 Scribdown 接管与自动刷新。打开开关后即可生效。
            </span>
          </div>
          <button
            type="button"
            className="scribdown-popup__action"
            onClick={handleOpenFileAccessSettings}
            aria-label="打开扩展详情页以开启允许访问文件网址"
          >
            去开启
          </button>
        </div>
      )}

      {enabled && fileAccessAllowed === true && (
        <div
          className={
            refreshEnabled
              ? "scribdown-popup__group scribdown-popup__group--bounded"
              : "scribdown-popup__group"
          }
          role="group"
          aria-label="本地文件自动刷新设置"
        >
          <div
            className={
              refreshEnabled
                ? "scribdown-popup__toggle scribdown-popup__toggle--group-head"
                : "scribdown-popup__toggle"
            }
          >
            <span
              className="scribdown-popup__label-with-info"
              ref={refreshTipAnchorRef}
            >
              <span className="scribdown-popup__toggle-label">
                本地文件自动刷新
              </span>
              <button
                type="button"
                className="scribdown-popup__info"
                aria-label="查看本地文件自动刷新说明"
                aria-expanded={openTip === "refresh"}
                onClick={() =>
                  setOpenTip((current) => (current === "refresh" ? null : "refresh"))
                }
              >
                ?
              </button>
              {openTip === "refresh" && (
                <span className="scribdown-popup__info-tip" role="tooltip">
                  {refreshEnabled
                    ? `已开启：每 ${intervalSec} 秒回拉一次本地 .md 文件`
                    : "已关闭：本地 .md 更新后需手动刷新页面"}
                </span>
              )}
            </span>
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
            <div className="scribdown-popup__field scribdown-popup__field--group-tail">
              <span
                className="scribdown-popup__label-with-info"
                ref={intervalTipAnchorRef}
              >
                <label
                  className="scribdown-popup__field-label"
                  htmlFor="scribdown-refresh-interval"
                >
                  刷新间隔
                </label>
                <button
                  type="button"
                  className="scribdown-popup__info"
                  aria-label="查看刷新间隔取值范围"
                  aria-expanded={openTip === "interval"}
                  onClick={() =>
                    setOpenTip((current) =>
                      current === "interval" ? null : "interval"
                    )
                  }
                >
                  ?
                </button>
                {openTip === "interval" && (
                  <span className="scribdown-popup__info-tip" role="tooltip">
                    取值范围 {MIN_REFRESH_INTERVAL_SEC} – {MAX_REFRESH_INTERVAL_SEC}{" "}
                    秒
                  </span>
                )}
              </span>
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
