import { ReactElement, useEffect, useState } from "react";
import { PROJECT_NAME } from "@scribdown/shared";
import "@scribdown/ui-handdrawn/styles.css";
import { EXTENSION_ENABLED_STORAGE_KEY } from "./constants";

/**
 * 从 chrome.storage.local 读取扩展启用状态。
 * 未设置时默认启用。
 * @returns 当前是否启用。
 */
async function readEnabled(): Promise<boolean> {
  /** storage 读取结果。 */
  const result = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  return result[EXTENSION_ENABLED_STORAGE_KEY] !== false;
}

/**
 * 扩展 popup 配置页面。
 * 提供整体启用/关闭开关，控制 file:// 自动渲染与 http(s) `.md` 自动重定向。
 * @returns React 元素。
 */
export function Popup(): ReactElement {
  /** 扩展当前是否启用。 */
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    void readEnabled().then(setEnabled);

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
      if (!(EXTENSION_ENABLED_STORAGE_KEY in changes)) return;
      setEnabled(changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false);
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
    void chrome.storage.local.set({ [EXTENSION_ENABLED_STORAGE_KEY]: next });
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
    </main>
  );
}
