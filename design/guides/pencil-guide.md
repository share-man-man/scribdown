# Pencil 执行规范

## 执行步骤

按顺序执行，每步对照「完成标志」确认后再继续。

---

### Step 1：设置 Token 变量

**操作**

- 在 Pencil 中建立 Variables 面板，按 [../spec/ui-spec.md](../spec/ui-spec.md)「浅色主题」表逐条录入颜色 Token
- 录入字体、圆角、间距、动效 Token（深浅主题共用）
- 录入暗色主题颜色 Token

**完成标志**

- Variables 面板中可见所有 `--scribdown-*` Token，无遗漏、无拼写错误

---

### Step 2：设置 Typography 样式

**操作**

- 按 [../spec/ui-spec.md](../spec/ui-spec.md) Typography 表，在 Pencil 中建立文本样式
- 样式命名与表中「样式」列一致（`body-md`、`h1`、`code-block` 等）

**完成标志**

- 10 种文本样式全部可用，名称与规格表一一对应

---

### Step 3：搭建 `HeadingRenderer` 与 `ParagraphRenderer`

**操作**

- `HeadingRenderer`：展示 h1–h6 六个变体，字体使用 `--scribdown-font-heading`，字号 / 行高 / 字重严格对应 Typography 表；标注各级上方留白（h1 → `--scribdown-space-8`（`64px`），h2 → `--scribdown-space-7`（`48px`），h3–h6 → `--scribdown-space-5`（`24px`））与统一下方留白 `--scribdown-space-4`（`16px`）
- 锚点入口：标题悬停时左侧出现低调 `#` 图标，颜色 `--scribdown-color-text-secondary`，含 focus-visible 态，使用 `absolute` 定位不影响标题对齐
- `ParagraphRenderer`：展示正文段落，标注行高 `1.75`、段间距 `--scribdown-space-5`（`24px`）；在同一段落内同时出现 `emphasis`（斜体）、`strong`（加粗）、`delete`（删除线）、`mark`（高亮）、`break`（显式换行），直观呈现全部行内标记的排版效果

**完成标志**

- h1–h6 字号层级一眼可辨，字体为手绘感标题字体
- 锚点图标在悬停态可见，不影响标题行的布局
- `emphasis` / `strong` / `delete` / `mark` / `break` 在同一段落内可区分

---

### Step 4：搭建 `DocumentShell` 组件

**操作**

- 创建可复用的 `DocumentShell` 组件，背景使用 `--scribdown-color-bg`
- 正文文本列最大宽度 `840px`，左右内边距最少 `--scribdown-space-7`（`48px`）
- 顶部留白 `--scribdown-space-8`（`64px`），底部留白 `96px`
- 出一个 Typography 展示子画板：从 `h1` 到 `h6`、`body-md`、`body-sm` 按垂直顺序排列，标注字号、行高、字重，作为后续画板正文的视觉参照

**完成标志**

- `DocumentShell` 可作为独立组件复用
- Typography 展示涵盖全部 8 种文本样式，字体分别应用 `--scribdown-font-heading`（标题）和 `--scribdown-font-body`（正文）

---

### Step 5：搭建 `ListRenderer` 组件

**操作**

- 无序列表：标记使用手绘圆点，不使用标准浏览器 bullet，标记颜色 `--scribdown-color-text-secondary`
- 有序列表：等宽数字标记，与正文基线对齐
- 展示三级嵌套：每级缩进 `--scribdown-space-5`（`24px`），标记形状随层级递减（实心 → 空心 → 短横）
- `ListItem` 行间距 `--scribdown-space-2`（`8px`）

**完成标志**

- 无序、有序、三级嵌套均可展示
- 标记样式与标准浏览器默认 bullet 有明显手绘感差异

---

### Step 6：搭建行内级基础组件

优先搭建依赖最少的原子组件：`InlineCode`、`LinkRenderer`、`HanddrawnDivider`

**操作**

- `InlineCode`：内边距 `2px 6px`，背景色深于 bg，圆角 `--scribdown-radius-sm`，字体 `--scribdown-font-code`，字号 `0.92em`
- `LinkRenderer`：颜色 `--scribdown-color-accent`，区分 default / hover / visited / focus-visible 四态；`focus-visible` 使用 `2px` 实线轮廓，偏移 `2px`；`visited` 颜色略深于默认态
- `HanddrawnDivider`：手绘感横线，不使用标准 `<hr>` 直线，视觉权重介于标题与段落之间，颜色 `--scribdown-color-border`，上下留白 `--scribdown-space-5`

**完成标志**

- 三个组件均可作为独立实例复用
- `LinkRenderer` 四个状态可切换展示

---

### Step 7：搭建块级核心组件

`Blockquote`、`CodeBlock`、`ImageRenderer`

**操作**

- `Blockquote`：左边框 `4px`，颜色 `--scribdown-color-accent`；内边距 `16px 20px`；背景 `--scribdown-color-surface`（平色，不叠加额外纹理，手绘感通过边框笔触表达）；正文颜色 `--scribdown-color-text-secondary`
- `CodeBlock`：结构 `Header（高 40px，内边距 12px 16px）+ ScrollArea`，整体使用 `--scribdown-radius-md` 和 `--scribdown-shadow-md`；复制按钮区分 default / hover / focus-visible / copied 四态；展示行高亮变体（至少 2 行高亮），高亮行用 `--scribdown-color-border` 约 `0.3` 透明度底色，与非高亮行形成对比；长代码行保留横向滚动，不折行
- `ImageRenderer`：至少展示加载态（稳定占位）、正常态（最大宽 `720px`，可带 caption）和失败态（固定高占位 + alt 文本，占位框使用 `--scribdown-color-surface` 背景 + `--scribdown-color-border` 描边）；右上角媒体操作入口低存在感，至少覆盖「全屏查看」，含 focus-visible 态

**完成标志**

- `Blockquote` 左边框颜色为 `--scribdown-color-accent`，背景为平色 surface，无额外纹理
- `CodeBlock` Header 左侧语言标签、右侧复制按钮，复制成功态有反馈
- `ImageRenderer` 加载态稳定、不引发布局抖动；失败态占位高度固定，alt 文本可见
- 所有尺寸与颜色来自 Token，无硬编码

---

### Step 8：搭建扩展语法组件

`MermaidBlock`、`VideoRenderer`、`TableRenderer`、`TaskListRenderer`

**操作**

- `MermaidBlock`：正常态（`Header + DiagramCanvas` 最小高 `240px`，内容水平居中，四周内边距 `24px`，背景 `--scribdown-color-surface`，圆角 `--scribdown-radius-md`）+ 失败态（错误摘要 + 源码入口）；Header 含图表类型标签（左）与全屏查看入口（右），全屏入口含 focus-visible 态
- `VideoRenderer`：封面 + 居中播放按钮 + 播放态播放器本体；`16:9` 容器，最大宽 `720px`；播放按钮 focus-visible 态轮廓偏移 `3px`；全屏入口与 `ImageRenderer` 位置保持一致
- `TableRenderer`：表头层级差异（字重或底色）；`TableWrapper` 必须支持横向滚动，不撑破正文容器；单元格内边距 `12px 16px`，整体圆角 `--scribdown-radius-md`
- `TaskListRenderer`：继承 `ListRenderer` 结构，`Marker` 替换为手绘感方形复选框（`16px`）；已完成项使用 `delete` 样式并将颜色降至 `--scribdown-color-text-secondary`，不降低 `opacity`；多级缩进与普通列表保持一致

**完成标志**

- `MermaidBlock` 正常态与失败态均可展示
- `MermaidBlock` 全屏入口含 focus-visible 态，轮廓规格与 `ImageRenderer` 一致（`2px` 实线，颜色 `--scribdown-color-accent`，偏移 `2px`）
- `TaskListRenderer` 已完成与未完成项视觉差异明显，复选框有手绘感；`delete` 样式与 `ParagraphRenderer` 中的 `delete` 行内标记视觉一致
- `VideoRenderer` 封面与播放按钮可见，全屏入口含 focus-visible 态

---

### Step 9：搭建 `FullscreenViewer`

**操作**

- 结构：`Overlay（rgba(45,36,31,0.72)）+ TopBar + ContentStage`
- TopBar 从左到右：内容标题、类型标签、关闭按钮（含 focus-visible 态，轮廓颜色 `--scribdown-color-text-primary`）
- ContentStage 四周至少保留 `32px` 安全留白，浮层圆角 `--scribdown-radius-lg`
- 准备三个变体：承载图片 / 承载 Mermaid / 承载视频

**完成标志**

- 三个变体 TopBar 结构相同，内容随类型变化
- 遮罩色正确，浮层圆角使用 `--scribdown-radius-lg`

---

### Step 10：搭建 `HtmlRenderer`

**操作**

- 正常态：展示一个包含白名单标签（如 `<strong>`、`<em>`、`<a>`、`<u>`）的 HTML 片段，样式继承正文 Token
- 降级占位态：展示一个占位框，内含说明文字（如「HTML 内容已被过滤」），使用 `--scribdown-color-surface` 背景、`--scribdown-color-border` 描边、圆角 `--scribdown-radius-sm`，不暴露原始标签

**完成标志**

- 正常态与降级态视觉差异清晰
- 占位框说明文字颜色使用 `--scribdown-color-text-secondary`

---

### Step 11：搭建 `LoadingSkeleton`

**操作**

- 按 [../spec/component-spec.md](../spec/component-spec.md) `LoadingSkeleton` 规格搭建占位结构
- 骨架块依次排列：大标题占位（宽 `60%`，高 `28px`）→ 段落三行组（宽 `100% / 96% / 72%`，高 `16px`，行间距 `10px`）→ 代码块占位（宽 `100%`，高 `96px`）→ 段落两行组，循环到内容高度填满
- 骨架色使用 `--scribdown-color-border`，所有占位块圆角 `--scribdown-radius-sm`
- 用透明度标注动画区间（`0.4`–`0.8`），在画板中以注释说明脉冲周期 `1.4s`、缓动 `ease-in-out`；标注 `prefers-reduced-motion` 静态降级

**完成标志**

- 骨架结构与正文宽度一致，保留正常左右内边距
- 透明度区间与降级说明标注清晰

---

### Step 12：出 Browser Preview / Default 画板

**画布**：`1440 × 1080`，内容区 `960px`

**操作**

- 使用 `DocumentShell` 组件作为容器
- 使用 [../fixtures/markdown-fixture.md](../fixtures/markdown-fixture.md) 中的标准 Markdown 样例填充正文，至少包含以下 8 类元素中的 6 类：标题、段落、列表、引用、代码块、链接、行内代码、图片
- 确保 fixture 中的三类失败态在画板中可见：图片失败态（`broken-image-404.png`）、Mermaid 错误态（`invalid mermaid syntax`）、HTML 降级占位（`<script>` 被过滤）
- 背景使用纸感纹理，壳层可带轻量工具区

**完成标志**

- 正文文本列宽 `≤840px`，左右内边距 `≥48px`
- 手绘感与可读性并存，装饰未压过正文
- 所有颜色来自浅色主题 Token

---

### Step 13：出 Browser Preview / Long Content 画板

**画布**：`1440 × 1600`，内容区 `960px`

**操作**

- 在 Default 基础上追加：更长正文段落 × 2、更长代码块（30 行以上）、更复杂 Mermaid（多分支流程图）

**完成标志**

- 页面高度明显超过 Default 画板
- 长代码行可见横向滚动指示，不折行

---

### Step 14：出 VS Code Preview / Default 画板

**画布**：`1280 × 960`，内容区 `860px`

**操作**

- 使用同一份标准 Markdown 样例（见 [../fixtures/markdown-fixture.md](../fixtures/markdown-fixture.md)）
- 背景比 Browser 版更克制，减少纹理强度，适配宿主主题对比度

**完成标志**

- 与 Browser 版使用相同渲染组件，仅壳层和背景策略不同

---

### Step 15：出 VS Code Preview / Narrow 画板

**画布**：`960 × 960`，内容区 `680px`

**操作**

- 重点检查：标题是否断行正常、代码块横向滚动是否触发、表格是否不撑破容器、图片宽度是否正确收缩

**完成标志**

- 所有块级元素在 `680px` 内容区内无溢出
- 代码块和表格的横向滚动行为可见

---

### Step 16：搭建 `StateRenderer` 并出 State 画板（× 4）

**操作**

- 搭建 `StateRenderer` 可复用组件：`Icon（48px）+ Title（h3）+ Description（body-sm）`，垂直居中于容器
  - `Empty` 变体：中性色图标，标题「无可渲染内容」，颜色 `--scribdown-color-text-secondary`
  - `Error` 变体：图标与标题颜色 `--scribdown-color-danger`，展示错误摘要
  - `Unsupported` 变体：图标与标题颜色 `--scribdown-color-warning`，说明能力限制
- 出四张 State 画板（`1280 × 720`）：
  - `State / Loading`：展示 `LoadingSkeleton`，标注脉冲动画说明
  - `State / Empty` / `State / Error` / `State / Unsupported`：各用 `StateRenderer` 对应变体实例

**完成标志**

- `StateRenderer` 三个变体可独立复用
- 四张画板语义清晰，不混入正文内容
- Error 和 Unsupported 使用对应语义色

---

### Step 17：出 Components / Core Blocks 画板

**画布**：`1600 × 1200`

**操作**

- 将 Step 3–11 搭建的全部组件按类型排列
- 每个组件展示主要状态变体（如 `CodeBlock` 的 default / hover / copied，`LinkRenderer` 的四态，`ImageRenderer` 的正常 / 失败）
- 必须包含 `MermaidBlock`、`ImageRenderer`、`VideoRenderer` 的全屏查看示例
- 包含 `DocumentShell` Typography 展示区和 `LoadingSkeleton` 骨架区

**完成标志**

- 全部 18 个视觉组件均出现在画板中（`DocumentShell`、`LoadingSkeleton`、`StateRenderer`、`HeadingRenderer`、`ParagraphRenderer`、`ListRenderer`、`TaskListRenderer`、`Blockquote`、`HanddrawnDivider`、`CodeBlock`、`InlineCode`、`LinkRenderer`、`ImageRenderer`、`MermaidBlock`、`VideoRenderer`、`TableRenderer`、`HtmlRenderer`、`FullscreenViewer`）
- 组件间排列整齐，留白一致

---

### Step 18：出 Fullscreen Viewer 画板

**画布**：`1440 × 960`

**操作**

- 并排展示三个全屏变体：图片全屏、Mermaid 全屏、视频全屏
- 每个变体均展示 TopBar 和 ContentStage

**完成标志**

- 三个变体遮罩色一致，TopBar 结构相同
- ContentStage 四周安全留白 `≥32px`

---

### Step 19：验收

对照以下清单逐项确认，全部通过后完成出图。

- [ ] 严格遵守「只做渲染，不做编辑」的产品边界
- [ ] 所有颜色、尺寸、动效均来自 `--scribdown-*` Token，无硬编码
- [ ] 纸感、手绘感与可读性并存，装饰未压过正文
- [ ] Browser 与 VS Code 使用相同渲染组件，壳层差异不影响正文规则
- [ ] 标准 Markdown 样例（见 [../fixtures/markdown-fixture.md](../fixtures/markdown-fixture.md)）覆盖所有节点类型，含失败态（图片加载失败、Mermaid 语法错误、HTML 降级占位）和引用式链接 / 图片
- [ ] Mermaid、图片、视频的全屏交互完整表达
- [ ] State 画板语义色正确，未混入正文内容，Loading 骨架结构完整
- [ ] 全部 18 个视觉组件中，适用交互的组件均展示了 `focus-visible` 态
