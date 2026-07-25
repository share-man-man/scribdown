import { defineConfig } from "@rspress/core";

export default defineConfig({
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
    exclude: [
      "rspress.config.ts",
      "dist/**",
      ".rspress/**",
      "styles/**",
    ],
  },
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
            { text: "Markdown 样例", link: "/ui-design/markdown-fixture" },
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
});
