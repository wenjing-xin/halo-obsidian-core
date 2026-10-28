# Halo 知链

以双链串联文章，用图谱编织知识。

**Halo 知链**（`obsidian-core`）是一款 Halo 双链与知识图谱插件。通过文章关联、反向链接和可交互图谱，把分散的内容组织成可以浏览、追溯的知识网络，适合个人笔记、技术博客与专题知识库。

> 需要 Halo **2.27.0 及以上版本**。图谱交互参考 Obsidian 的图谱视图；本项目是独立的 Halo 插件，并非 Obsidian 官方产品。

在线文档：[Halo 知链使用文档](https://auth.webjing.com/docs/halo-obsidian-core/getting-started) · [双链标签](https://auth.webjing.com/docs/halo-obsidian-core/wikilink-tags) · [主题适配](https://auth.webjing.com/docs/halo-obsidian-core/theme-integration)

## 功能

- **文章双链**：在默认编辑器中插入文章关联，或复制双链标签到 Markdown 正文；点击关联即可跳转到目标文章。
- **反向链接**：查看哪些文章引用了当前文章，追溯内容之间的联系。
- **断链检测**：集中查看未解析的关联及来源文章，便于修复与整理。
- **关系图谱**：展示文章、分类、标签及关联，支持缩放、拖拽、邻居高亮、搜索和生长动画。
- **三种图谱范围**：全站图谱、围绕当前或指定文章的局部图谱、指定文章集合的子图。
- **文章内嵌**：默认编辑器支持插入图谱、调整尺寸与重新配置；主题端通过 Web Component 展示，并跟随主题明暗模式。
- **公开展示控制**：主题端图谱默认关闭；开启后只向访客展示已发布的公开文章，不开放匿名写入或索引操作。

## 讨论交流群

欢迎扫码交流使用体验、反馈问题与讨论插件开发。

<p align="center">
  <img src="https://www.webjing.cn/upload/wfly-qq.png#pic_center" alt="Halo 知链插件讨论交流群二维码" width="280px" style="margin: 0 auto;" />
</p>

## 安装

1. 准备插件 JAR 安装包；从源码构建的方法见“开发与构建”。
2. 在 Halo Console 的插件管理中上传安装包并启用插件。
3. 进入内容菜单中的“关系图谱”，查看图谱、反向链接与断链检测。
4. 如需在前台展示图谱，在插件设置中开启“开放主题端图谱”。仅使用文章双链不需要开启此选项。

## 使用文章双链

### 默认编辑器

使用编辑器中的“文章关联”入口选择目标文章。关联会插入当前位置，保存时使用 `obsidian-core-link` 标签记录文章标识，前台显示为可点击的文章关联。

### Markdown 编辑器

在 Halo 文章列表中打开目标文章的操作菜单，选择“复制双链标签”，然后直接粘贴到正文：

```html
<obsidian-core-link post="post-name" url="/archives/example" title="文章标题">文章标题</obsidian-core-link>
```

- `post` 是目标文章的 `metadata.name`，双链索引以此为准，不依赖标题或 URL。
- `url` 是文章地址；指定 `post` 后，主题端会使用目标文章当前的永久链接。
- 标签内文字可以替换为自定义显示文字，不会改变关联目标。
- 不要将标签放入反引号或代码块，否则它会作为代码展示，不建立关系。
- 只有 `url`、没有 `post` 的标签可以作为链接展示，但不会建立文章双链。

文章发布后，插件会根据发布版本更新关联索引。若已有文章的关系没有及时显示，可在后台图谱工具栏中重新索引并刷新。

更多属性、安全规则与示例见 [双链标签说明](https://auth.webjing.com/docs/halo-obsidian-core/wikilink-tags)。

## 插入知识图谱

在默认编辑器的工具箱或 `/` 命令菜单中选择“关系图谱”，按需配置范围：

| 范围 | 用途 |
| --- | --- |
| 全站图谱 | 展示站点文章的整体关系 |
| 局部图谱 | 围绕当前文章或指定文章，按深度展开关联 |
| 指定文章 | 展示所选文章集合及其内部关联 |

图谱块支持宽高调整。默认高度为 420px，最小高度为 300px；宽度最小以 320px 为基准，并适配更窄的移动端容器。

Markdown 正文或主题模板中也可以使用自定义标签：

```html
<!-- 全站图谱 -->
<obsidian-graph mode="full" theme="auto" height="420"></obsidian-graph>

<!-- 当前文章的局部图谱：在文章发布内容中由服务端绑定上下文 -->
<obsidian-graph mode="local" depth="1" theme="auto"></obsidian-graph>

<!-- 指定中心文章；在文章之外使用局部图谱时应明确指定 post -->
<obsidian-graph mode="local" post="post-name" depth="2"></obsidian-graph>

<!-- 指定文章集合 -->
<obsidian-graph mode="nodes" nodes="post-a,post-b,post-c"></obsidian-graph>
```

请将 `post-name`、`post-a` 等占位内容替换为真实的文章 `metadata.name`，不要填写标题或文章路径。

主题端提供刷新、设置、播放生长动画、缩放和重置视图操作。设置面板默认收起；`theme="auto"` 跟随主题，也可使用 `light` 或 `dark` 固定外观。未开启公开展示时，主题端图谱不会返回文章数据。

## 插件配置

| 配置 | 说明 |
| --- | --- |
| 开放主题端图谱 | 默认关闭；开启后允许访客读取公开文章图谱 |
| 节点上限 | 默认 500，范围 50–5000；限制单个图谱的渲染规模 |
| 高级设置：排除分类 / 标签 | 隐藏对应分类、标签节点与归属边，不影响文章双链索引 |
| 高级设置：标题式双链 | 兼容 `[[标题]]` 写法，可配置大小写匹配与未解析样式 |

建议新内容统一使用 `obsidian-core-link` 标签。图谱范围与外观在每个图谱块中设置，不需要全局重复配置。

## 主题适配

关系图谱和关联文章行内卡片支持评论组件同款的明暗模式标记，并提供 CSS 变量供主题覆盖颜色。亮色图谱默认带 1px 浅灰边框，可通过 `--obsidian-graph-border` 调整。

完整变量表、默认配色、明暗模式优先级和可复制的 CSS 示例见 [主题适配说明](https://auth.webjing.com/docs/halo-obsidian-core/theme-integration)。需要跟随页面切换时，请使用 `theme="auto"`；固定 `light` / `dark` 模式不会自动切换。

## 权限与公开数据

在 Halo 的用户角色管理中，按需勾选 **Halo 知链** 分组下的角色模板：

- **知链查看**：查看图谱、编辑器图谱预览、反向链接、出链、断链及统计；只读刷新不会触发重建索引。
- **知链管理**：包含查看权限，并允许手动重建双链索引；不授予文章编辑、插件设置管理或直接改写索引资源的权限。

后台查看权限可读取非公开内容的关系信息，只应授予可信内容管理员。编辑文章仍需单独分配 Halo 的文章管理权限。

主题端双链仅解析已发布、存在发布快照、未删除的公开文章。非公开或已失效的 `post` 目标不会回退到标签中复制的旧 URL。只有 `url`、没有 `post` 的标签属于作者自行指定的普通链接，不进行文章身份解析。

公开图谱默认关闭，每次请求均检查开关；开启后也不会展示私密、未发布或已删除文章，以及可能泄露标题的未解析节点。公开图谱使用 **30 秒服务端缓存，最多 128 个查询范围**，相同查询的并发请求共享一次构建；文章、分类、标签、索引和配置变更会清理缓存。响应使用 `Cache-Control: no-store`，避免浏览器或 CDN 继续复用已转为非公开的数据。


## 开发与构建

### 环境

- Java 21
- Node.js >= 22.12.0
- pnpm 10（项目配置为 10.33.0）
- Docker：仅使用 Halo DevTools 启动本地 Halo 时需要

### 本地开发

```bash
# 安装前端依赖
cd ui
pnpm install
cd ..

# 使用 DevTools 启动 Halo；项目配置端口为 8098
./gradlew haloServer
```

另开终端监听前端构建：

```bash
cd ui
pnpm dev
```

### 检查与打包

```bash
# 前端类型检查、测试及 Console / 主题组件构建
cd ui
pnpm type-check
pnpm test:unit --run
pnpm build
cd ..

# 完整检查并打包插件
./gradlew build
```

构建产物位于 `build/libs/`。请使用 Java 21 执行 Gradle；macOS 可通过 `JAVA_HOME=$(/usr/libexec/java_home -v 21)` 指定 JDK。

### 源码结构

```text
src/main/java/com/webjing/obsidiancore/  索引、查询、公开接口与主题集成
src/main/resources/extensions/         插件配置、权限与静态资源代理
ui/src/                               Console 页面与默认编辑器扩展
ui/src/shared/graph-renderer/           Console / 主题共用图谱内核
ui/widget/src/                        主题端 Lit Web Component
docs/                                 使用说明
```



## 许可证

[GPL-3.0](https://github.com/wenjing-xin/halo-obsidian-core/blob/main/LICENSE) © webjing
