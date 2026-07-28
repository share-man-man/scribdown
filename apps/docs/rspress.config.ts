import { defineConfig, type UserConfig } from "@rspress/core";

/** 主题同步组件路径：把 Rspress 的 rp-dark 同步成 Scribdown 的主题 class。 */
const themeSyncComponentPath = new URL("./components/ThemeSync.tsx", import.meta.url).pathname;

/**
 * 站点配置类型。
 * @rspress/core 2.0.18 里 `i18nSource` 的值类型 `I18nTextValue` 把 `zh` / `en` 声明为必填，
 * 但运行时是按站点 `lang` 精确取键的 —— 本站 `lang` 为 `zh-CN`，只需 `zh-CN` 一个键即可生效
 * （已验证：页面显示的是本文件的「本页内容」「搜索文档」，而非内置 zh 翻译的「目录」「搜索」）。
 * 故在此放宽该字段的键约束，避免为满足类型而写入两份用不上的兜底文案。
 */
type ScribdownDocsConfig = Omit<UserConfig, "i18nSource"> & {
  /** 主题 UI 文案覆盖：外层键为文案 ID，内层键为语言标签。 */
  i18nSource?: Record<string, Record<string, string>>;
};

/** 文档站配置；以变量形式声明后再交给 defineConfig，沿用补齐后的类型做检查。 */
const docsConfig: ScribdownDocsConfig = {
  root: ".",
  outDir: "dist",
  title: "Scribdown",
  description: "手绘风格 Markdown 渲染器",
  lang: "zh-CN",
  base: "/scribdown/",
  logo: "/logo.svg",
  route: {
    cleanUrls: true,
    // 文档根目录即当前应用目录，排除站点配置本身，避免它被识别成路由页面。
    // components/** 是页面组件源码、public/** 是静态资源（含渲染预览用的 Markdown fixture），
    // 两者都不应被当成文档页生成路由。
    exclude: [
      "rspress.config.ts",
      "dist/**",
      ".rspress/**",
      "styles/**",
      "components/**",
      "public/**",
    ],
  },
  // 关键步骤：以全局 UI 组件形式挂载主题同步，使明暗切换对文档正文与渲染预览页同时生效。
  plugins: [
    {
      name: "scribdown-theme-sync",
      globalUIComponents: [themeSyncComponentPath],
    },
  ],
  globalStyles: new URL("./styles/index.css", import.meta.url).pathname,
  i18nSource: {
    languagesText: { "zh-CN": "语言" },
    versionsText: { "zh-CN": "版本" },
    themeText: { "zh-CN": "主题" },
    copyMarkdownText: { "zh-CN": "复制 Markdown" },
    copyMarkdownLinkText: { "zh-CN": "复制页面链接" },
    openInText: { "zh-CN": "打开方式" },
    menuTitle: { "zh-CN": "菜单" },
    outlineTitle: { "zh-CN": "本页内容" },
    scrollToTopText: { "zh-CN": "回到顶部" },
    lastUpdatedText: { "zh-CN": "最后更新" },
    lastUpdatedAuthorText: { "zh-CN": "更新者" },
    prevPageText: { "zh-CN": "上一页" },
    nextPageText: { "zh-CN": "下一页" },
    editLinkText: { "zh-CN": "编辑此页" },
    sourceCodeText: { "zh-CN": "源码" },
    searchPlaceholderText: { "zh-CN": "搜索文档" },
    searchPanelCancelText: { "zh-CN": "取消" },
    searchNoResultsText: { "zh-CN": "未找到结果" },
    searchSuggestedQueryText: { "zh-CN": "建议搜索" },
    "overview.filterNameText": { "zh-CN": "筛选" },
    "overview.filterPlaceholderText": { "zh-CN": "筛选内容" },
    "overview.filterNoResultText": { "zh-CN": "没有匹配结果" },
    codeButtonGroupCopyButtonText: { "zh-CN": "复制代码" },
    codeButtonGroupWrapButtonText: { "zh-CN": "自动换行" },
    notFoundText: { "zh-CN": "页面未找到" },
    takeMeHomeText: { "zh-CN": "返回首页" },
    promptCopyText: { "zh-CN": "复制" },
    promptCopiedText: { "zh-CN": "已复制" },
    promptExpandText: { "zh-CN": "展开" },
    promptCollapseText: { "zh-CN": "收起" },
  },
  markdown: {
    link: {
      // Markdown fixture 中的 URL 编码脚注由渲染器原样保留，不应当作为站内页面校验。
      checkDeadLinks: {
        excludes: ["./%E"],
      },
    },
  },
  themeConfig: {
    nav: [
      { text: "指南", link: "/guide/introduction" },
      { text: "UI设计", link: "/ui-design/overview" },
      { text: "开发文档", link: "/dev/architecture" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "指南",
          items: [
            { text: "产品介绍", link: "/guide/introduction" },
            { text: "快速上手", link: "/guide/quick-start" },
          ],
        },
      ],
      "/ui-design/": [
        {
          text: "总览",
          items: [{ text: "设计导览", link: "/ui-design/overview" }],
        },
        {
          text: "设计基础",
          items: [{ text: "Token 系统", link: "/ui-design/tokens" }],
        },
        {
          text: "组件与交互",
          items: [{ text: "组件规范", link: "/ui-design/components" }],
        },
        {
          text: "设计执行",
          items: [
            { text: "Pencil 执行规范", link: "/ui-design/pencil-guide" },
            { text: "渲染预览", link: "/ui-design/render-preview" },
          ],
        },
      ],
      "/dev/": [
        {
          text: "开发文档",
          items: [
            { text: "架构设计", link: "/dev/architecture" },
            { text: "模块说明", link: "/dev/modules" },
          ],
        },
      ],
    },
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/share-man-man/scribdown",
      },
    ],
    footer: {
      message: "Scribdown — 手绘风格的 Markdown 渲染器",
    },
  },
};

export default defineConfig(docsConfig);
