import {
  DEFAULT_REFRESH_INTERVAL_SEC,
  EXTENSION_ENABLED_STORAGE_KEY,
  MAX_REFRESH_INTERVAL_SEC,
  MIN_REFRESH_INTERVAL_SEC,
  REFRESH_ENABLED_STORAGE_KEY,
  REFRESH_INTERVAL_STORAGE_KEY
} from "./constants";

/**
 * 源文件轮询参数。
 */
interface PollSourceOptions {
  /** 拉取最新的原始 markdown 文本；失败时抛错即可，本轮会被跳过。 */
  fetchLatest: () => Promise<string>;
  /** 当检测到内容变化时执行的回调，通常用于触发重新渲染。 */
  onChange: (latest: string) => void | Promise<void>;
  /** 初次渲染所用的内容，作为变化检测的比对基线。 */
  initialContent: string;
}

/**
 * 从 chrome.storage.local 读取当前生效的刷新间隔（秒），并夹到合法范围内。
 * 任一开关（扩展启用 / 自动刷新）关闭时返回 0，表示不应继续轮询。
 * @returns 经过 clamp 的有效间隔秒数（0 表示禁用）。
 */
async function readEffectiveIntervalSec(): Promise<number> {
  /** storage 中一次性读取扩展启用、自动刷新开关与刷新间隔。 */
  const result = await chrome.storage.local.get([
    EXTENSION_ENABLED_STORAGE_KEY,
    REFRESH_ENABLED_STORAGE_KEY,
    REFRESH_INTERVAL_STORAGE_KEY
  ]);
  if (result[EXTENSION_ENABLED_STORAGE_KEY] === false) return 0;
  if (result[REFRESH_ENABLED_STORAGE_KEY] === false) return 0;
  /** storage 中读到的原始间隔配置值。 */
  const raw = result[REFRESH_INTERVAL_STORAGE_KEY];
  /** 解析后的间隔秒数，未设置时回落到默认值。 */
  const parsed = typeof raw === "number" && !Number.isNaN(raw)
    ? raw
    : DEFAULT_REFRESH_INTERVAL_SEC;
  return Math.min(MAX_REFRESH_INTERVAL_SEC, Math.max(MIN_REFRESH_INTERVAL_SEC, parsed));
}

/**
 * 启动源文件内容轮询：周期性拉取原始 markdown，比对内容变化后通过回调触发重新渲染。
 * - 间隔取自 popup 的「刷新间隔」配置，0 表示禁用轮询。
 * - storage 变更（间隔或启用状态）时会自动重置定时器，无需重启页面。
 * @param options 轮询参数。
 * @returns 取消轮询并解除监听的清理函数。
 */
export function startPollingSource(options: PollSourceOptions): () => void {
  /** 上一次确认的内容快照，用于和最新拉取结果对比。 */
  let lastContent = options.initialContent;
  /** 当前 pending 的 setTimeout 句柄；为 null 表示未排程。 */
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 是否已被取消，避免清理后异步回调继续排程。 */
  let cancelled = false;

  /**
   * 清空当前 pending 的定时器（如有）。
   */
  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /**
   * 按当前生效的间隔安排下一次轮询；间隔为 0 时静默不排程。
   */
  const scheduleNext = async (): Promise<void> => {
    if (cancelled) return;
    /** 本次读到的有效间隔（秒）。 */
    const intervalSec = await readEffectiveIntervalSec();
    if (cancelled) return;
    if (intervalSec <= 0) {
      timer = null;
      return;
    }
    timer = setTimeout(() => {
      void tick();
    }, intervalSec * 1000);
  };

  /**
   * 执行一次轮询：拉取最新内容，变化则触发回调，最后排下一次。
   */
  const tick = async (): Promise<void> => {
    if (cancelled) return;
    try {
      /** 本轮拉取到的最新原始文本。 */
      const latest = await options.fetchLatest();
      if (!cancelled && latest !== lastContent) {
        lastContent = latest;
        await options.onChange(latest);
      }
    } catch {
      // 关键步骤：单次拉取失败不打断轮询，下一周期再尝试。
    }
    await scheduleNext();
  };

  /**
   * 监听 storage 变化：开关或间隔被修改时立即重置定时器。
   * @param changes 变化集合。
   * @param area 变化所属 storage 区域。
   */
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName
  ): void => {
    if (area !== "local") return;
    if (
      !(REFRESH_INTERVAL_STORAGE_KEY in changes) &&
      !(REFRESH_ENABLED_STORAGE_KEY in changes) &&
      !(EXTENSION_ENABLED_STORAGE_KEY in changes)
    ) {
      return;
    }
    clearTimer();
    void scheduleNext();
  };

  chrome.storage.onChanged.addListener(handleStorageChange);
  void scheduleNext();

  return () => {
    cancelled = true;
    clearTimer();
    chrome.storage.onChanged.removeListener(handleStorageChange);
  };
}
