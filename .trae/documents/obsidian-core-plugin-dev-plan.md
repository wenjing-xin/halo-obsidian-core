# obsidian-core：Halo 双链笔记 + 知识图谱插件开发方案（v2）

## Context（为什么做）

把 Obsidian 的核心功能——**双链笔记（`[[标题]]` 互链）与知识图谱**——以 Halo 插件形式落地到 Halo 平台，让 Halo 摆脱纯「分类 + 标签」的笔记组织方式，支持网状知识库。

项目 `obsidian-core` 是刚初始化的 Halo 2.27 插件脚手架（Java 21 + Vue 3 + Vite），目前只有插件主类和一个示例 UI 页面。

**已确认的需求（含本轮修订）**：
1. 双链：文章内写 `[[标题]]`，前台自动渲染为指向目标文章的链接（无需改主题）。
2. Console 反向链接 / 断链检测。
3. **Console 知识图谱必须复刻 Obsidian 图谱视图**：深色背景、节点光晕、按分组（Halo 中即分类）着色、力导向物理、缩放/拖拽、悬停高亮邻居、点击侧栏详情、搜索高亮、筛选器，视觉语言与交互尽量与 Obsidian 一致。
4. **主题端匿名展示图谱（内嵌组件）**：管理员在设置中开启后，主题端访客无需登录即可查看图谱；支持**指定节点展示**（局部图谱 / 指定节点子图 / 全站图谱三种模式）。
5. **内嵌组件用 Lit Web Component 开发**（`<obsidian-graph>` 自定义元素，参考官方评论组件的组件化方式），**在默认编辑器（Tiptap 富文本编辑器）中提供插入方式**（工具栏 / Slash Command / 工具箱插入块，可配置模式与指定节点）；主题可通过 CSS 变量适配样式。
6. **分类/标签也是图谱节点**：分类下的文章**默认关联到分类节点**，文章默认关联到其标签节点；分类/标签节点作为「枢纽」参与图谱组织（详见「图谱组织设计」）。
7. 首期不做编辑器内 `[[` 联想补全（独立编辑器集成留作二期；默认编辑器扩展点本期仅用于图谱块插入）。

## 核心设计

```
写时索引：Post 事件 → 解析发布版 raw（markdown 或 HTML）中的 [[...]] → upsert 自定义模型 WikiLink（每源文章一条）
查询时：反链走 linkedTargets 多值索引；图谱/断链读全部 WikiLink + Post 元数据
图谱节点：post（文章）+ category（分类）+ tag（标签）三类节点；边 = wikilink（双链）+ taxonomy（归属边，post→其分类/标签）
渲染时：ReactivePostContentHandler + 标题→permalink 内存缓存，状态机式 HTML 文本替换
图谱渲染：自研 d3-force + Canvas 复刻 Obsidian 图谱视图，graph-renderer 渲染内核在 Console 与主题端复用
主题端内嵌：Lit Web Component <obsidian-graph>（IIFE 产物经 ReverseProxy 提供）；默认编辑器以 Tiptap 节点块插入（存为 <obsidian-graph .../> 标签）；内容渲染时自动注入脚本；匿名经公开 API 读取
```

## 已验证的关键 API（本地 api-2.26.0/2.27.0 jar + 官方文档核对）

| 能力 | API | 用途 |
|---|---|---|
| 读文章原始 markdown | `run.halo.app.content.PostContentService#getReleaseContent(String) → Mono<ContentWrapper>`（`getRaw()`） | 索引时解析 `[[...]]` |
| 文章变更通知 | `run.halo.app.event.post` 的 `PostUpdated/Published/Deleted/Unpublished/VisibleChangedEvent`（Spring ApplicationEvent，`getName()`） | 写时索引触发 |
| 前台内容钩子 | `run.halo.app.theme.ReactivePostContentHandler`（PF4J ExtensionPoint，注册 Bean 即生效） | 前台把 `[[...]]` 渲染成 `<a>` |
| 自定义模型 | `AbstractExtension` + `@GVK` + `SchemeManager.register(Class, Consumer<IndexSpecs>)`；自动 CRUD API + 分页/选择器 | 存储 WikiLink 索引 |
| 自定义 API | `CustomEndpoint` + `RouterFunctions.route()`；Console 组 `console.api.obsidian-core.halo.run`，公开组 `api.obsidian-core.halo.run` | graph/backlinks 等 |
| 主题端注入 | `run.halo.app.theme.dialect.TemplateFooterProcessor`（向每个主题页 footer 追加模型） | 兜底注入图谱脚本/CSS |
| 默认编辑器扩展 | `extensionPoints["default:editor:extension:create"]` 返回 Tiptap `AnyExtension[]`（支持 `getToolbarItems`/`getCommandMenuItems`/`getToolboxItems`/`getBubbleMenu`/`getDraggableMenuItems` 扩展点） | 编辑器中插入图谱块节点，序列化为 `<obsidian-graph ...>` |
| 匿名授权 | `src/main/resources/extensions` 下 Role 模板 + annotation `rbac.authorization.halo.run/aggregate-to-anonymous: "true"`（自动聚合进 anonymous 角色，官方插件 minidocs 同款做法） | 匿名读公开图谱 API |
| 静态资源 | `ReverseProxy` 扩展对象：`/obsidian-graph/**` → `classpath:static/obsidian-graph`，访问路径 `/plugins/obsidian-core/assets/obsidian-graph/*` | 主题端脚本/CSS |
| 永久链接 | `Post.status.permalink`（发布后由 Halo 计算） | 渲染与图谱跳转 |
| Console UI | `definePlugin` routes/menu；`@halo-dev/api-client` 的 `axiosInstance` | 图谱/反链页面 |
| 设置项 | `src/main/resources/settings.yaml`（FormKit 自动生成 UI）+ `SettingFetcher` + `PluginConfigUpdatedEvent` | 渲染/匿名开关等 |

**重要修正**：`SpringdocRouteBuilder` 是 Halo 2.28 才有的 API，**2.27 不可用**。自定义端点一律 `RouterFunctions.route()`（官方插件同款）；`generateApiClient` 只生成 WikiLink 模型 CRUD 客户端，graph/backlinks 等端点由前端手写 TS 调用 `axiosInstance`。

## 后端（src/main/java/com/webjing/obsidiancore/）

```
├── ObsidianCorePlugin.java        # 生命周期：start 注册 scheme + 异步全量重建；stop 注销
├── model/WikiLink.java            # @GVK(group="obsidian-core.halo.run", kind="WikiLink")
├── index/
│   ├── WikiLinkParser.java        # 纯函数解析 [[target]] | [[target|alias]] | [[target#heading]]，#块引用；排除代码围栏/内联反引号/HTML 注释
│   ├── WikiLinkIndexer.java       # indexPost / deletePost / reconcileByTitle / reindexAll
│   ├── PostLinkIndexCache.java    # 标题→(postName, permalink) 内存缓存，懒加载 + 事件失效 + 5 分钟 TTL
│   └── SnippetExtractor.java      # [[...]] 前后约 60 字符上下文片段
├── listener/PostEventListener.java  # @EventListener 5 个 Post 事件；全 reactive + boundedElastic 异步，不阻塞事件线程
├── service/
│   ├── ReindexService.java        # 启动全量重建 + 手动触发
│   ├── GraphService.java          # 图谱 payload 组装：wiki 边 + taxonomy 节点/归属边（含分类叶子规则、隐藏/排除过滤）
│   └── BacklinkService.java       # 反链/出链/断链查询
├── endpoint/
│   ├── ObsidianConsoleEndpoint.java   # console 组：/graph /backlinks/{name} /outgoing/{name} /unresolved /reindex /summary
│   └── ObsidianPublicEndpoint.java    # 公开组：/graph（匿名可读，服务端校验 allowAnonymousGraph 开关）
├── theme/
│   ├── ObsidianPostContentHandler.java  # ReactivePostContentHandler 实现（[[...]]→<a>）
│   ├── WikiLinkHtmlProcessor.java       # 纯函数：HTML 状态机替换，跳过 pre/code/a/script/style/注释/属性区
│   └── ObsidianGraphScriptInjector.java # TemplateFooterProcessor：注入 obsidian-graph.js + css（当开关开启时）
└── config/ObsidianSettings.java   # 设置 POJO + volatile 缓存，PluginConfigUpdatedEvent 刷新
```

### WikiLink 模型 spec

```java
sourcePostName      // = Post.metadata.name（1:1 记录）
sourceTitle
resolvedCount / unresolvedCount
Set<String> linkedTargets     // → multi 索引（反链查询 = fieldSelector=spec.linkedTargets=X）
Set<String> unresolvedTitles  // → multi 索引（新文章发布时反向重索引）
List<LinkEntry> outgoingLinks / unresolvedLinks
Instant indexedAt

LinkEntry { targetPostName?, targetTitle, alias?, heading?, snippet }
```

### 端点设计

**Console 组 `console.api.obsidian-core.halo.run/v1alpha1`**（仅登录管理员/super admin）：

| 端点 | 返回 | 说明 |
|---|---|---|
| `GET /graph` | nodes+edges+brokenNodes+brokenEdges+taxonomy | keyword/category/tag/showBroken/includeDraft/showTaxonomy 筛选；节点含 type/title/permalink/categories/tags/degree/size/color；边含 type(wikilink\|taxonomy) |
| `GET /backlinks/{postName}` | items{sourcePostName,sourceTitle,sourcePermalink,snippet}+total | 走 `spec.linkedTargets` 索引 |
| `GET /outgoing/{postName}` | WikiLink.spec.outgoingLinks | 编辑场景出链展示 |
| `GET /unresolved` | 断链表（来源→未解析标题） | 内存过滤 |
| `POST /reindex` | 全量重建，UI 轮询 summary | 启动/升级兜底 |
| `GET /summary` | wikilinkCount/resolved/unresolved/lastIndexedAt | 进度展示 |

**公开组 `api.obsidian-core.halo.run/v1alpha1`**（主题端匿名调用，服务端强制校验设置开关）：

| 端点 | 参数 | 返回 |
|---|---|---|
| `GET /graph` | `mode=full\|local\|nodes`、`post=`、`nodes=a,b,c`、`depth=`、`showBroken=`、`showTaxonomy=` | 仅含 PUBLIC 已发布文章的图谱 payload（post/category/tag 三类节点 + wikilink/taxonomy 边）；`mode=local` 返回指定节点 + 邻居子图；`mode=nodes` 返回指定节点集合及其间链接 |

公开端点只做「读」，不做写；关闭开关后直接返回 403 空响应。

### 前台双链渲染

`ObsidianPostContentHandler` 调 `WikiLinkHtmlProcessor.replace(content, cache, settings)`：
- 已解析 → `<a href="{permalink}" class="obsidian-wikilink">{alias|标题}</a>`（HtmlUtils.htmlEscape）
- 未解析默认保留 `[[...]]` 原文；设置开启弱化渲染 → `<span class="obsidian-wikilink--unresolved">…</span>`
- 状态机只在普通文本节点替换，不破坏代码块、已有 `<a>`、属性值、注释

### 主题端内嵌组件

1. **注入**：`ObsidianGraphScriptInjector`（TemplateFooterProcessor）在 `allowAnonymousGraph=true` 时向每个主题页 footer 追加：
   - `<script src="/plugins/obsidian-core/assets/obsidian-graph/obsidian-graph.js"></script>`（独立 IIFE 产物，含 d3-force 与渲染内核）
   - `<link rel="stylesheet" href="/plugins/obsidian-core/assets/obsidian-graph/obsidian-graph.css">`
2. **占位符**（主题作者/用户放入模板任意位置）：
   ```html
   <div class="obsidian-graph" data-mode="local" data-post="<postName>"></div>
   <!-- data-mode: full(全站) | local(局部图谱) | nodes(指定节点子图) -->
   <!-- data-nodes="a,b,c" 配合 nodes 模式；data-depth="2" 控制局部图谱深度 -->
   ```
3. **水合**：脚本扫描 `document.querySelectorAll('.obsidian-graph')`，逐个向公开 `/graph` 端点请求对应数据，用渲染内核绘制 Obsidian 风格图谱（节点点击新标签打开 permalink）。
4. 脚本用 `IntersectionObserver` 懒加载（占位符进入视口才渲染）。

### 匿名权限与静态资源

`src/main/resources/extensions/`：
- `role-anonymous-graph.yaml`：Role 模板，`metadata.name: anonymous-obsidian-core-graph`，labels `halo.run/role-template: "true"`，annotations `rbac.authorization.halo.run/aggregate-to-anonymous: "true"` + `halo.run/hidden: "true"`；rules：`apiGroups: ["api.obsidian-core.halo.run"], resources: ["graph"], verbs: ["get", "list"]`。
- `reverse-proxy.yaml`：ReverseProxy 对象 `obsidian-core-reverse-proxy`，rules `path: /obsidian-graph/**` → `file.directory: static/obsidian-graph`。

### settings.yaml（`src/main/resources/settings.yaml`）

- `renderWikilinks`（前台双链渲染开关，默认 true）
- `caseSensitive`（标题匹配大小写，默认 false）
- `renderBrokenLinks`（未解析链接弱化渲染，默认 false）
- `allowAnonymousGraph`（主题端匿名展示图谱，默认 false；关闭时公开端点拒绝且不注入脚本）
- `anonymousGraphDefaultMode`（full/local，默认 full）
- `graphDefaultShowTaxonomy`（图谱默认显示分类/标签节点与归属边，默认 true）
- `graphDefaultCollapseCategories`（大分类默认折叠为枢纽，默认 false）
- `graphMaxNodes`（图谱单次渲染节点上限，默认 500，超出提示改用筛选/聚焦）
- `excludeCategories` / `excludeTags`（渲染目标资格与图谱筛选预设，不作用于索引）

## Console UI（ui/src/）

```
src/
├── index.ts                       # 路由/菜单 + extensionPoints（default:editor:extension:create 注册图谱块节点）
├── views/GraphView.vue            # 图谱页：工具栏 + ObsidianGraphCanvas + NodeDetailPanel
├── views/LinkView.vue             # 反链搜索 + 断链 Tab
├── components/
│   ├── ObsidianGraphCanvas.vue    # 包装 shared/graph-renderer（Console 用，动态 import 拆 chunk）
│   ├── GraphToolbar.vue           # 关键词/分类/标签筛选、断链/分类节点/标签节点/分类层级/折叠开关、显示标签/箭头、重新索引
│   ├── NodeDetailPanel.vue        # 选中节点详情：文章（标题/permalink/出入度/分类/标签）或分类（文章数/子分类/聚焦/折叠）或标签（文章数/聚焦）
│   ├── BacklinksDrawer.vue        # 反链列表
│   └── BrokenLinksTable.vue       # 断链表（复制标题、打开来源）
├── editor/
│   ├── graph-node.ts              # Tiptap Node 扩展（renderHTML → <obsidian-graph data-* />，renderReact/Vue NodeView 占位预览）
│   ├── GraphNodeView.vue          # 编辑器中图谱块的占位/预览组件（含"配置"按钮打开设置弹窗）
│   └── GraphInsertModal.vue       # 插入/配置弹窗：选择模式(full/local/nodes) + 文章选择器 + 深度参数
├── shared/graph-renderer/         # ★ 图谱渲染内核（Console 与主题端 Web Component 共用）
│   ├── renderer.ts                # d3-force 物理 + Canvas 绘制、交互（缩放/拖拽/悬停/点击）
│   ├── obsidian-theme.ts          # Obsidian 图谱视觉规范（背景/节点光晕/边/调色板/字体）
│   └── types.ts                   # GraphPayload / GraphNode / GraphEdge 类型
└── api/
    ├── generated/                 # generateApiClient 产物（WikiLink CRUD）
    └── obsidian.ts                # 手写端点（console + public），用 axiosInstance

widget/                            # ★ 独立的 Lit Web Component 构建包（IIFE）
├── package.json                   # 依赖 lit、d3-force；独立 vite lib 构建
├── vite.config.ts                 # lib 模式输出到 ../src/main/resources/static/obsidian-graph/
├── obsidian-graph.ts              # customElements.define('obsidian-graph', ...)：读取 data-mode/data-post/data-nodes/data-depth → 调公开 API → 复用 shared/graph-renderer 渲染
└── styles/obsidian-graph.css      # 组件样式（全部走 CSS 变量，供主题适配）
```

### 图谱组织设计（分类 / 标签节点）

**节点与边类型**（`GraphNode.type` / `GraphEdge.type`）：

| 类型 | 节点/边 | 视觉 |
|---|---|---|
| `post` 文章节点 | 圆形 + 径向渐变光晕，大小 ∝ wiki 度数 | Obsidian 风格 |
| `category` 分类节点 | 圆角矩形（与文章形状区分），大小 ∝ 直接文章数 | 分类专属调色板 |
| `tag` 标签节点 | 小圆点（小于文章节点），颜色优先取 `Tag.spec.color`，否则调色板 | 标签专属色 |
| `wikilink` 边 | 实线、有向，透明度 0.4-0.7 | 双链关系 |
| `taxonomy` 归属边 | 细虚线、无向（文章→分类/标签），透明度 0.2-0.3 | 归属关系，与 wiki 边明显区分 |

**默认组织规则**：
1. **默认显示分类节点、标签节点与归属边**（符合"分类下文章默认关联到分类节点"）；工具栏开关可随时隐藏。
2. **归属边只连"叶子分类"**：`Post.spec.categories` 含完整祖先链，为避免冗余边，默认文章只连它在分类树中的最深分类；工具栏「展开父分类」开启后才连全部祖先。文章连其 `spec.tags` 的全部标签。
3. **分类父子层级边**（parent→child）默认隐藏，工具栏「显示分类层级」开启后才显示，避免默认图过密。
4. **隐藏分类**（`Category.spec.hideFromList`）与设置中的排除分类/标签：不生成节点与归属边。
5. **枢纽聚类布局**：物理模拟中分类/标签节点带更强 repulsion 半径、归属边 linkStrength 高于 wiki 边 → 文章围绕其分类/标签自然聚类；同分类文章因共享枢纽节点而聚拢，天然形成"按分类成簇 + 双链跨簇连接"的网状结构。

**交互组织**：
- 点击分类节点：右侧面板显示分类名、直接文章数、子分类；图谱高亮其直接文章（邻居高亮模式）；提供「聚焦分类」→ 仅显示该分类子树及其双链外联。
- **分类折叠（hub collapse）**：分类节点可折叠 → 该分类下文章聚合为隐藏态（只留枢纽 + 聚合计数），解决大分类导致的图密度问题；默认展示设置项 `graphDefaultCollapseCategories`。
- 悬停分类/标签节点：tooltip 显示名称与文章数；点击标签节点 → 高亮该标签文章。
- 筛选器（分类/标签多选）与搜索高亮沿用，筛选作用于 post 节点与 wiki 边，taxonomy 节点/边随归属关系联动。
- **局部图谱**（主题端 `data-mode=local`）：指定文章 + wiki 邻居 + 邻居的直接分类/标签节点（深度可配），Obsidian 局部图谱同款组织。

### 图谱渲染内核：复刻 Obsidian 知识图谱（`shared/graph-renderer/`）

用 **d3-force**（弃用 vis-network，其外观与 Obsidian 差异大）+ Canvas 自绘，视觉与交互对照 Obsidian 图谱视图：

- **视觉**：深色半透明画布；post 节点为圆形 + 径向渐变光晕（halo），按所属分类分组着色（Top 8 分类调色板，其余灰）；边按类型区分（wiki 实线 / taxonomy 虚线）；悬停时邻居高亮、其余节点降为 10% 透明度。
- **物理**：d3-force 的 repulsion + center + link 力，taxonomy 边 linkStrength 高于 wiki 边；分类/标签枢纽节点加大 charge，参数调至 Obsidian「有机漫游」手感；节点可拖拽固定。
- **交互**：滚轮缩放、拖拽平移、节点点击选中 → 右侧 NodeDetailPanel（Obsidian 风格侧栏）；搜索框高亮匹配节点；悬停高亮邻居；分类节点折叠/聚焦。
- **开关**（工具栏，复刻 Obsidian 齿轮菜单）：显示标签 / 显示箭头 / 显示断链 / 显示分类节点 / 显示标签节点 / 显示分类层级 / 折叠大分类。
- **筛选**：按分类、标签筛选（复刻 Obsidian 的 path/tag filter 面板），实时重拉数据。
- 说明：在视觉语言与交互上尽力复刻 Obsidian（其精确配色/粒子细节为私有实现，无法像素级一致，方案承诺的是同风格高保真复刻）。

### 主题端内嵌组件（Lit Web Component）与默认编辑器插入

参考官方评论组件（plugin-comment-widget）的组件化模式：**Web Component + 主题通过标签/CSS 变量适配**。

**1. Lit Web Component（`ui/widget/`，独立 IIFE 构建）**
- `customElements.define('obsidian-graph', ...)`，属性驱动：`data-mode="full|local|nodes"`、`data-post`、`data-nodes`、`data-depth`。
- 内部调公开 API `/apis/api.obsidian-core.halo.run/v1alpha1/graph`，复用 `shared/graph-renderer`（d3-force + Canvas，与 Console 同一渲染内核）。
- 组件样式全部走 CSS 变量（`--obsidian-graph-bg / --obsidian-graph-node / --obsidian-graph-edge / --obsidian-graph-accent ...`），主题可在自身 CSS 中覆盖适配（明亮/暗黑模式）。
- 产物 `obsidian-graph.js`（含 CSS）输出到 `src/main/resources/static/obsidian-graph/`，经 ReverseProxy 以 `/plugins/obsidian-core/assets/obsidian-graph/obsidian-graph.js` 提供；IIFE 内用 `window.obsidianGraphLoaded` 防重复定义。
- `IntersectionObserver` 懒渲染：进入视口才拉数据绘制。

**2. 默认编辑器插入（`ui/src/editor/`，`extensionPoints["default:editor:extension:create"]`）**
- 定义 Tiptap Node `obsidianGraph`：`renderHTML` 输出 `<obsidian-graph data-mode data-post .../>`（保存进文章 content）；NodeView 组件在编辑器中显示占位/预览块。
- 插入入口：顶部工具栏「知识图谱」按钮 + Slash Command `/图谱` + 工具箱（三类入口，均打开 `GraphInsertModal`）。
- `GraphInsertModal`：选择模式（全站 / 局部图谱 / 指定节点），局部图谱用文章选择器（搜索标题选目标文章，可选深度），指定节点模式多选文章；确定后 `insertContent` 插入节点。
- `getBubbleMenu` / `getDraggableMenuItems`：图谱块上提供「配置 / 替换 / 删除」操作。
- 编辑器侧不加载 Lit 运行时（占位预览用 Vue 组件），生产渲染时才由 Web Component 接管。

**3. 前台渲染接入（无主题适配也能工作）**
- `ObsidianPostContentHandler` 检测内容含 `<obsidian-graph` 时，自动在内容末尾追加 `<link .../obsidian-graph.css>` 与 `<script .../obsidian-graph.js>`（受 `allowAnonymousGraph` 设置门控；关闭则保留标签不加载脚本，避免泄露数据）。
- 兜底：`allowAnonymousGraph=true` 时 `TemplateFooterProcessor` 在主题页 footer 注入脚本（`window.obsidianGraphLoaded` 防重复），使主题可在模板任意位置直接写 `<obsidian-graph ...>`（类似 `<halo:comment />` 的主题适配方式）。
- 组件无数据（公开 API 403 / 空站点）时显示可配的占位提示，不破坏页面布局。

### 主题端脚本产物（构建）

`ui/widget/` 独立包：依赖 `lit`、`d3-force`；vite lib 模式 IIFE 构建，产物写入 `src/main/resources/static/obsidian-graph/`。`ui/package.json` 与 `widget/package.json` 各自管理依赖，避免 Lit 进入 Console 主包。

## 实现顺序

1. **Phase 0 骨架**：WikiLink 模型 + scheme 注册 + ObsidianSettings + settings.yaml + extensions 下 Role/ReverseProxy 预置资源；`./gradlew build` 通过，Swagger 可见 wikilinks CRUD。
2. **Phase 1 索引内核**：WikiLinkParser（单测）、PostLinkIndexCache、WikiLinkIndexer、ReindexService、PostEventListener（异步）+ 启动全量重建；3 篇互链文章验证索引。
3. **Phase 2 后端端点**：ObsidianConsoleEndpoint 六端点 + ObsidianPublicEndpoint + GraphService/BacklinkService（含 taxonomy 节点/归属边、叶子分类规则、local/nodes 模式子图）；curl 验证 + 匿名 403 验证。
4. **Phase 3 前台双链渲染**：WikiLinkHtmlProcessor（单测）+ ObsidianPostContentHandler；主题端验证 `[[...]]` 变链接、代码块不受影响。
5. **Phase 4 图谱渲染内核**：d3-force + Canvas 渲染内核（三类节点/两类边的视觉与交互、枢纽聚类布局、分类聚焦/折叠）；GraphToolbar/NodeDetailPanel；Console 图谱页完成。
6. **Phase 5 内嵌组件 + 编辑器插入**：`ui/widget/` Lit Web Component（IIFE 构建）+ ReverseProxy 提供；默认编辑器 Tiptap 节点扩展（工具栏/Slash/工具箱/气泡菜单）+ GraphInsertModal；内容自动注入脚本验证（含开关关闭 403）。
7. **Phase 6 打磨**：LinkView/反链/断链页、设置接线、重索引进度、空态/错误态、`./gradlew build` 打包验证。

## 验证方式

- 单元测试：`WikiLinkParserTest`（语法矩阵 + 排除规则）、`WikiLinkHtmlProcessorTest`（HTML 边界）、`SnippetExtractorTest`
- 本地运行：`./gradlew haloServer`（Halo 起于 localhost:8090，admin/admin，Swagger）；UI `cd ui && pnpm install && pnpm dev`
- 手动用例矩阵：
  1. 文 A 写 `[[文 B]]` 发布 → 前台出现链接；代码块内 `[[...]]` 不转换；`[[文 B|别名]]` 显示别名
  2. 文 B 反链页出现文 A（含 snippet）
  3. 发布新文 C → 历史 `[[C]]` 未解析链接自动转有效
  4. Console 图谱：节点光晕/分类着色/力导向/缩放拖拽/悬停高亮/点击侧栏/搜索高亮/筛选/断链开关 全流程
  5. **图谱组织**：文章默认挂接到其叶子分类/全部标签节点（归属边）；同级多文章围绕分类枢纽成簇；分类/标签节点显示数量；点击分类可高亮/聚焦/折叠；「展开父分类」「显示分类层级」开关生效；隐藏分类与排除分类不出现
  6. **编辑器插入**：默认编辑器中经工具栏/Slash `/图谱`/工具箱插入图谱块；GraphInsertModal 配置 full/local/nodes 与目标文章；保存后 content 含 `<obsidian-graph ...>`；编辑态显示占位预览，可重新配置/删除
  7. **Web Component**：发布后文章页自动加载 `obsidian-graph.js` 并渲染 Obsidian 风格图（full/local/nodes 三种模式 + 深度）；匿名未登录可看；CSS 变量覆盖生效；`window.obsidianGraphLoaded` 防重复加载；关闭开关后公开 API 403 + 不注入脚本（组件显示占位提示）
  8. **主题适配**：主题模板直接写 `<obsidian-graph data-mode="local" data-post="...">` 可独立渲染（footer 注入路径）
  9. 删除/改标题/改分类归属 → 图谱、反链、断链同步变化
  10. 关闭双链渲染开关 → 前台无 `[[...]]` 转换，Console 与内嵌图谱不受影响

## 风险与取舍

- **「复刻 Obsidian 图谱」的边界**：承诺高保真复刻视觉语言与交互，非像素级一致（Obsidian 图谱为闭源实现）。如后续要求完全一致，需按 Obsidian 实际截图逐像素调参，成本高。
- **分类/标签节点导致图密度上升**：默认开 taxonomy 会让大型站点变密；用叶子分类规则、分类折叠、graphMaxNodes 上限、工具栏开关共同缓解；如仍过密可引导用户关闭 taxonomy 只保留双链。
- **d3-force vs vis-network**：自研内核换取 Obsidian 风格，代码量增加但可控；渲染内核 Console 与主题端共享，一份投入两处使用。
- **内容 raw 类型差异**：默认编辑器为 Tiptap 富文本（raw 是 HTML 序列化），历史文章可能为 markdown。`WikiLinkParser` 与 `WikiLinkHtmlProcessor` 统一用「排除代码/注释/标签的状态机」处理两种 raw，`[[...]]` 在两种格式下都以普通文本出现，解析语义一致。
- **编辑器插入依赖默认编辑器扩展点**：`default:editor:extension:create` 为 2.26+ 能力（本项目 requires >=2.27，满足）；若用户切换为第三方编辑器则图谱块插入入口不可用，但前台渲染与 Console 图谱不受影响。
- **Lit 与 Console 主包隔离**：`ui/widget/` 独立包（lit + d3-force 不进 Console 主 bundle），IIFE 防重复加载；构建链多一个步骤，接入 Gradle processUiResources 一并产出。
- **主题端嵌入的通用性**：通过「内容自动注入 + footer 兜底」两条路径，任何主题无需适配即可在文章中展示；主题深度适配（模板直写标签 + CSS 变量）按评论组件同款文档化。
- **事件监听 vs Reconciler**：MVP 用事件监听 + 启动全量重建 + TTL 兜底；需要强一致性再迁移 Controller（逻辑可复用）。
- **SpringdocRouteBuilder 2.27 不可用**：端点用 RouterFunctions.route()；升级 2.28 后可迁移。
- **匿名安全**：公开端点仅读、仅 PUBLIC 文章、服务端强校验开关（配置加载失败默认关闭），并靠 `aggregate-to-anonymous` 的最小权限规则。
- **性能**：万篇以下无压力；反链走索引；图谱接口超万篇加 limit + 前端聚合。
- **二期候选**：编辑器内 `[[` 自动补全（`editor:create` 独立编辑器）、SinglePage 双链、前台反链区块。
