---
layout: home

hero:
  name: Scribdown
  text: 手绘风格 Markdown 渲染器
  tagline: 以纸感纹理、手绘线条与低干扰动效，为 Markdown 内容提供差异化阅读体验。同时支持浏览器插件与 VS Code 插件。
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/quick-start
    - theme: alt
      text: 产品介绍
      link: /guide/introduction

features:
  - title: 只做渲染，不做编辑
    details: 产品边界清晰——专注把 Markdown 内容稳定、安全、可读地渲染出来，不引入编辑器复杂度。
  - title: 手绘视觉语言
    details: 统一的设计 Token 体系，纸感背景、手绘圆角与克制动效，在保证可读性的前提下构建差异化风格。
  - title: 多端一致
    details: 浏览器插件与 VS Code 插件共用同一套渲染核心（packages/markdown-renderer）与视觉组件（packages/ui-handdrawn），壳层差异不分叉正文渲染规则。
  - title: 安全默认
    details: 原始 HTML 经 rehype-sanitize + DOMPurify 双层清洗，外链与不可信资源加载失败时稳定降级，不破坏主内容流。
---
