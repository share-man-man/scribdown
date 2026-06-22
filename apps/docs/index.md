---
layout: home

hero:
  name: Scribdown
  text: 让 Markdown 像手绘笔记一样好看
  tagline: 纸感纹理、手绘线条与克制动效，为 Markdown 内容打造差异化阅读体验。一套渲染核心，同时驱动浏览器插件与 VS Code 插件。
  image:
    src: /ui-render.png
    alt: Scribdown 手绘风格 Markdown 渲染效果
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/quick-start
    - theme: alt
      text: 产品介绍
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/share-man-man/scribdown

features:
  - icon: 🖋️
    title: 专注阅读体验
    details: 将 Markdown 内容稳定、安全、清晰地呈现出来，让文档阅读更舒适、更具辨识度。
  - icon: 🎨
    title: 手绘视觉语言
    details: 统一的设计 Token 体系，纸感背景、手绘圆角与克制动效，在保证可读性的前提下构建差异化风格。
  - icon: 🔁
    title: 多端一致
    details: 浏览器插件与 VS Code 插件共用同一套渲染核心与视觉组件，壳层差异不分叉正文渲染规则。
  - icon: 🛡️
    title: 安全默认
    details: 原始 HTML 经 rehype-sanitize + DOMPurify 双层清洗，外链与不可信资源加载失败时稳定降级，不破坏主内容流。
---

<section class="home-section">
  <h2 class="home-section__title">所见即所得的手绘渲染</h2>
  <p class="home-section__subtitle">同一份 Markdown，在 Scribdown 里呈现为纸感、线条与轻盈层级——下面是真实渲染样张。</p>
  <div class="home-showcase">
    <figure class="home-showcase__figure">
      <img src="/ui-render.png" alt="Scribdown 渲染样张：标题、列表、代码块、表格、图片与图表" />
    </figure>
    <ul class="home-showcase__points">
      <li><strong>纸感正文：</strong>暖米纸背景配深胡桃墨色文字，长时间阅读更柔和。</li>
      <li><strong>手绘元素：</strong>引用块、代码块、表格采用轻微不规则圆角与偏移阴影。</li>
      <li><strong>完整语法：</strong>标题、列表、代码高亮、表格、图片查看与 Mermaid 图表一应俱全。</li>
      <li><strong>暗色自适应：</strong>宿主切换深色主题时，配色按同一套 Token 语义平滑反相。</li>
    </ul>
  </div>
</section>

<section class="home-section">
  <div class="home-cta">
    <h2>装上插件，立刻换个心情读文档</h2>
    <p>几分钟完成本地构建与加载，浏览器与 VS Code 都能用上同款手绘渲染。</p>
    <div class="home-cta__actions">
      <a class="home-cta__btn home-cta__btn--brand" href="/guide/quick-start">快速上手 →</a>
      <a class="home-cta__btn home-cta__btn--alt" href="/ui-design/overview">了解设计体系</a>
    </div>
  </div>
</section>
