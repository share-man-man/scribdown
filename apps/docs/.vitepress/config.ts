import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Scribdown",
  description: "手绘风格 Markdown 渲染器",
  lang: "zh-CN",

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "指南", link: "/guide/introduction" },
      { text: "规范", link: "/spec/overview" },
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
      "/spec/": [
        {
          text: "规范",
          items: [
            { text: "产品与渲染概览", link: "/spec/overview" },
            { text: "Token 系统", link: "/spec/tokens" },
            { text: "组件规范", link: "/spec/components" },
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
      { icon: "github", link: "https://github.com/GrainFull/scribdown" },
    ],

    footer: {
      message: "Scribdown — 只做渲染，不做编辑",
    },

    search: {
      provider: "local",
    },
  },
});
