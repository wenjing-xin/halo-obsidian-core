# 主题适配

本文说明 Halo 知链的关系图谱与关联文章行内卡片如何跟随明暗模式，以及主题可以覆盖的 CSS 变量。

## 明暗模式

与 Halo 评论组件一样，组件支持以下祖先标记。通常设置在 `html` 或 `body` 上，切换时修改标记即可，无需刷新文章。

| 主题模式 | Class | 属性 |
| --- | --- | --- |
| 深色 | `dark`、`color-scheme-dark`、`theme-dark` | `data-color-scheme="dark"` 或 `data-theme="dark"` |
| 浅色 | `light`、`color-scheme-light`、`theme-light` | `data-color-scheme="light"` 或 `data-theme="light"` |
| 跟随系统 | `color-scheme-auto` | `data-color-scheme="auto"` 或 `data-theme="auto"` |

例如：

```html
<html data-color-scheme="auto">
  <!-- 文章内容 -->
  <obsidian-graph mode="full" theme="auto"></obsidian-graph>
</html>
```

组件从自身向外查找最近的主题标记，包括跨 Shadow DOM 的祖先。同一元素上，明确的 `data-color-scheme` / `data-theme` 属性优先于 Class；建议只使用一种主题标记，并在切换时移除过期标记。没有标记时，读取继承的 CSS `color-scheme`，最后回退到系统偏好。

组件会监听祖先的 Class、style、主题属性及系统深色偏好的变化。仅切换配色不会重新请求图谱数据，也不会重置节点位置。

### 固定模式与自动模式

- 未指定主题时默认为自动模式。`theme="auto"` 跟随页面主题。
- `theme="light"` / `theme="dark"` 固定组件外观，**不会跟随页面切换**。
- 兼容 `dark="true"` / `dark="false"`，明确的 `theme` 优先。
- 主题端图谱设置中的“主题模式”可以临时切换为“跟随主题”，只影响当前浏览，不保存到文章。
- 要永久跟随主题，请在默认编辑器的图谱配置中选择“跟随文章主题（自动）”后保存，或将标签改为 `theme="auto"`。

例如，`<obsidian-graph theme="dark">` 一直显示深色属于固定模式，而不是主题监听失效。

## 关系图谱 CSS 变量

在 `obsidian-graph` 元素或其祖先上设置以下变量。未覆盖的颜色由组件按当前明暗模式自动选择。

| 变量 | 用途 | 浅色默认值 | 深色默认值 |
| --- | --- | --- | --- |
| `--obsidian-graph-bg` | 画布、设置面板与状态层背景 | `#ffffff` | `#1e1e1e` |
| `--obsidian-graph-node` | 普通节点颜色 | `#5c5c5c` | `#a6a6a6` |
| `--obsidian-graph-edge` | 文章双链连线颜色 | `#b8b8bc` | `#8a8a8a` |
| `--obsidian-graph-taxonomy-edge` | 分类、标签归属连线颜色 | `#b8b8bc` | `#5f5f66` |
| `--obsidian-graph-text` | 普通节点标签及面板文字 | `#8e8e96` | `#d4d4d4` |
| `--obsidian-graph-focus-text` | 聚焦及相邻节点标签颜色 | `#303030` | `#ededed` |
| `--obsidian-graph-accent` | 聚焦节点、搜索高亮及焦点轮廓 | `#9164f5` | `#a882ff` |
| `--obsidian-graph-broken` | 未解析节点颜色 | `#c06363` | `#8a8a94` |
| `--obsidian-graph-border` | 图谱外框颜色，固定 1px 宽 | `#e2e8f0` | `transparent` |
| `--obsidian-graph-height` | 未指定显式高度时的组件高度 | `420px` | `420px` |

外框不会占用画布尺寸，也不会遮挡鼠标交互。设为 `transparent` 可隐藏边框。节点启用分组颜色、悬停高亮时会使用对应分组色或强调色，而不是普通节点色。

图谱颜色会传入 Canvas / WebGL。建议使用十六进制或 `rgb()` / `rgba()` 等可直接解析的具体颜色值；不要把依赖浏览器 CSS 求值的 `light-dark()`、`color-mix()` 表达式直接传给图谱颜色变量。将具体颜色分别放在主题的明暗选择器下即可。

### 跟随页面配色

下面以 `html[data-color-scheme]` 为例。使用 Class 的主题可将选择器替换为 `html.dark` / `html.light`。

```css
obsidian-graph {
  --obsidian-graph-bg: #ffffff;
  --obsidian-graph-node: #475569;
  --obsidian-graph-text: #64748b;
  --obsidian-graph-focus-text: #0f172a;
  --obsidian-graph-accent: #2563eb;
  --obsidian-graph-border: #e2e8f0;
}

html[data-color-scheme="dark"] obsidian-graph {
  --obsidian-graph-bg: #0f172a;
  --obsidian-graph-node: #cbd5e1;
  --obsidian-graph-text: #94a3b8;
  --obsidian-graph-focus-text: #f8fafc;
  --obsidian-graph-accent: #60a5fa;
  --obsidian-graph-border: #334155;
}

@media (prefers-color-scheme: dark) {
  html[data-color-scheme="auto"] obsidian-graph {
    --obsidian-graph-bg: #0f172a;
    --obsidian-graph-node: #cbd5e1;
    --obsidian-graph-text: #94a3b8;
    --obsidian-graph-focus-text: #f8fafc;
    --obsidian-graph-accent: #60a5fa;
    --obsidian-graph-border: #334155;
  }
}
```

CSS 变量显式覆盖的颜色优先于组件默认调色板，包括固定主题模式。如果主题需要让部分图谱固定明暗，应为这些图谱单独设置变量，或限制上述选择器只匹配自动模式图谱。

### 高度与单个组件覆盖

```css
/* 适用于没有 height 属性或内联高度的图谱。 */
obsidian-graph {
  --obsidian-graph-height: 480px;
}

/* 只调整指定图谱。 */
obsidian-graph.article-map {
  --obsidian-graph-border: #cbd5e1;
  border-radius: 12px;
}
```

默认编辑器保存的 `height` 属性及内联高度优先于 `--obsidian-graph-height`。此时请在编辑器中调整图谱尺寸；组件保留最小 300px 高度，避免图谱无法阅读。

## 关联文章行内卡片 CSS 变量

Markdown 预览中的 `<obsidian-core-link>` 使用 Shadow DOM；发布文章中的标签可能由服务端转换为 `a.obsidian-post-link`。以下变量同时适用于两种渲染方式，不需要穿透 Shadow DOM。

| 变量 | 用途 | 浅色默认值 | 深色默认值 |
| --- | --- | --- | --- |
| `--obsidian-link-color` | 文字及链接图标颜色 | `#18181b` | `#f4f4f5` |
| `--obsidian-link-bg` | 行内卡片背景 | `#f4f4f5` | `#3f3f46` |
| `--obsidian-link-hover-bg` | 鼠标悬停背景 | `#e4e4e7` | `#52525b` |

卡片默认使用 90% 字号、16px 图标、4px 圆角和无描边浅底样式，与超链接编辑器的行内卡片保持相同的紧凑布局。

如果主题已经适配超链接编辑器，以下变量会作为本插件变量的后备值自动复用：

| Halo 知链变量 | 超链接编辑器兼容变量 |
| --- | --- |
| `--obsidian-link-color` | `--halo-hyperlink-card-inline-title-color` |
| `--obsidian-link-bg` | `--halo-hyperlink-card-inline-bg-color` |
| `--obsidian-link-hover-bg` | `--halo-hyperlink-card-inline-hover-bg-color` |

优先级为：Halo 知链变量 → 超链接编辑器兼容变量 → 组件默认配色。旧的 `--obsidian-link-border` 已不使用，行内卡片不再绘制边框。

```css
/* 同时覆盖原始自定义标签和发布后的服务端链接。 */
:is(obsidian-core-link, a.obsidian-post-link) {
  --obsidian-link-color: #334155;
  --obsidian-link-bg: #f1f5f9;
  --obsidian-link-hover-bg: #e2e8f0;
}

html[data-color-scheme="dark"] :is(obsidian-core-link, a.obsidian-post-link) {
  --obsidian-link-color: #e2e8f0;
  --obsidian-link-bg: #334155;
  --obsidian-link-hover-bg: #475569;
}

@media (prefers-color-scheme: dark) {
  html[data-color-scheme="auto"] :is(obsidian-core-link, a.obsidian-post-link) {
    --obsidian-link-color: #e2e8f0;
    --obsidian-link-bg: #334155;
    --obsidian-link-hover-bg: #475569;
  }
}
```

## 接入注意事项

- 不需要引入评论组件或超链接编辑器插件。Halo 知链有独立的脚本与默认配色，兼容变量只是可选的样式复用。
- 主题正常渲染 Halo 的 head 扩展时，插件会注入行内卡片资源；图谱脚本只在开启“开放主题端图谱”后注入。
- 全局 CSS 无法直接选中自定义元素内部的链接或 Canvas。优先使用本文列出的公开变量，不依赖内部 `--graph-*` / `--_link-*` 变量或内部 DOM 结构。
- 组件以主题标记和系统偏好变化作为配色更新信号。运行时只改样式表内容、不改主题标记时，不保证立即重新读取图谱颜色；应同时更新主题标记，或直接修改图谱元素的 `style`。
- 关联文章的跳转、索引及公开访问限制不受 CSS 配色覆盖影响。
