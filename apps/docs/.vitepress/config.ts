import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Scribdown",
  description: "手绘风格 Markdown 渲染器",
  lang: "zh-CN",

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
