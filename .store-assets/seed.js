/**
 * Scribdown 商店素材的种子数据。
 *
 * store-assets skill 的 chrome-shim.js 会读取这里挂出的对象，把它当成扩展的"存档"。
 * 键名与 apps/browser-extension/src/config/storage.ts 保持一致，改动那边时要同步。
 *
 * viewer 页面不依赖种子数据渲染内容——它按 `?src=` 真实 fetch 一份 Markdown，
 * 示例文件放在 .store-assets/pages/ 下，由演示服务器托管。种子在这里只负责
 * 让 viewer 通过「扩展是否启用」这道检查。
 */
(function () {
  'use strict';

  /* 与 apps/browser-extension/src/config/storage.ts 保持一致 */
  /** 扩展总开关。未设置视为启用。 */
  const EXTENSION_ENABLED_STORAGE_KEY = 'scribdown:enabled';
  /** 界面语言偏好。 */
  const EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY = 'scribdown:localePreference';
  /** 自动刷新开关。未设置视为启用。 */
  const REFRESH_ENABLED_STORAGE_KEY = 'scribdown:refreshEnabled';
  /** 自动刷新间隔（秒）。 */
  const REFRESH_INTERVAL_STORAGE_KEY = 'scribdown:refreshIntervalSec';

  /** 页面 URL 上的查询参数，用于切换素材的语言。 */
  const params = new URLSearchParams(location.search);
  /** 本次出图使用的界面语言。 */
  const locale = params.get('locale') || 'en';

  window.__STORE_ASSETS_SEED__ = {
    storage: {
      local: {
        [EXTENSION_ENABLED_STORAGE_KEY]: true,
        [EXTENSION_LOCALE_PREFERENCE_STORAGE_KEY]: locale,
        [REFRESH_ENABLED_STORAGE_KEY]: true,
        [REFRESH_INTERVAL_STORAGE_KEY]: 2,
      },
      session: {},
    },

    uiLanguage: locale === 'zh-CN' ? 'zh-CN' : 'en-US',

    // popup 会据此决定显示不显示「需要开启文件访问」那条橙色横幅。
    // 素材里展示已授权的正常态；想出提示态的图把这里改成 false。
    fileSchemeAccess: true,

    tabs: [
      {
        id: 101,
        windowId: 1,
        groupId: -1,
        index: 0,
        active: true,
        title: 'README.md',
        url: 'https://example.com/docs/README.md',
      },
    ],

    windows: [{ id: 1, focused: true, type: 'normal' }],

    tabGroups: [],

    /**
     * 应答页面发往 background 的运行时消息。
     *
     * popup 只会发 scribdown:refresh-badge（刷新工具栏徽标），
     * 在这套环境里没有徽标可刷，返回 undefined 即可。
     * @param message 页面发出的运行时消息
     * @returns 该消息的应答；未识别时返回 undefined
     */
    onMessage(message) {
      switch (message?.type) {
        case 'scribdown:refresh-badge':
          return undefined;
        default:
          return undefined;
      }
    },
  };
})();
