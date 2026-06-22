import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Scribdown",
  description: "手绘风格 Markdown 渲染器",
  lang: "zh-CN",

  // 部署到 GitHub Pages 项目站点（https://share-man-man.github.io/scribdown/），
  // 带子路径，必须设 base，否则线上静态资源会 404。若改用自有域名需改回 "/"。
  base: "/scribdown/",

  // 默认 markdown-it 未启用 footnote，`[^x]: ...` 会被识别为链接引用定义，
  // 中文脚注内容会被当成 URL 触发 dead link 校验，这里忽略此模式。
  ignoreDeadLinks: [/^\.\/%E/],

  themeConfig: {
    logo: "/logo.svg",

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
          items: [
            { text: "设计导览", link: "/ui-design/overview" },
          ],
        },
        {
          text: "设计基础",
          items: [
            { text: "Token 系统", link: "/ui-design/tokens" },
          ],
        },
        {
          text: "组件与交互",
          items: [
            { text: "组件规范", link: "/ui-design/components" },
          ],
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
      { icon: "github", link: "https://github.com/share-man-man/scribdown" },
    ],

    footer: {
      message: "Scribdown — 手绘风格的markdwon渲染器",
    },

    search: {
      provider: "local",
    },
  },
});
