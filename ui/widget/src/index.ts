/**
 * Theme-side <obsidian-graph> web component (Lit).
 *
 * Usage in a Halo theme template:
 *   <obsidian-graph mode="local" post="post-name" depth="2"></obsidian-graph>
 *
 * Attributes:
 *   mode           full | local | nodes (default: full)
 *   post           root post name for local mode
 *   nodes          comma-separated post names for nodes mode
 *   depth          BFS depth for local/nodes mode (1-5, default: 1)
 *   theme          auto (default) | light | dark; legacy dark="true|false" remains supported
 *   show-labels    draw node labels (default: true)
 *   show-arrows    draw direction arrows on wiki edges (default: false)
 *   show-broken    include unresolved links (default: false)
 *   show-taxonomy  include category/tag hubs (default: true, opt-out with show-taxonomy="false")
 *   endpoint       override of the public graph API URL
 *   clickable      open post permalink on click (default: true, opt-out with clickable="false")
 *   height         container height in px (default: 0 = CSS variable / 420px)
 *   width          container width in percent, 20-100 (default: 0 = full width)
 *   align          left | center | right, used when width < 100 (default: center)
 *
 * CSS custom properties:
 *   --obsidian-graph-height  container height (default: 420px)
 */
import { LitElement, css, html, nothing } from 'lit'
import { GraphRenderer } from '../../src/shared/graph-renderer/renderer'
import {
  normalizeTheme,
  observeGraphTheme,
  readGraphTheme,
  resolveDark,
} from '../../src/shared/graph-renderer/theme-controller'
import type { GraphPayload } from '../../src/shared/graph-renderer/types'

const DEFAULT_ENDPOINT = '/apis/api.obsidian-core.halo.run/v1alpha1/graph'

function boolWithDefault(defaultValue: boolean) {
  return (value: string | null): unknown => (value === null ? defaultValue : value !== 'false')
}

export class ObsidianGraphElement extends LitElement {
  static properties = {
    mode: { type: String },
    post: { type: String },
    nodes: { type: String },
    depth: { type: Number },
    dark: { type: String },
    theme: { type: String },
    currentPost: { type: String, attribute: 'data-current-post' },
    showLabels: {
      type: Boolean,
      attribute: 'show-labels',
      converter: boolWithDefault(true),
    },
    showArrows: {
      type: Boolean,
      attribute: 'show-arrows',
      converter: boolWithDefault(false),
    },
    showBroken: {
      type: Boolean,
      attribute: 'show-broken',
      converter: boolWithDefault(false),
    },
    showTaxonomy: {
      type: Boolean,
      attribute: 'show-taxonomy',
      converter: boolWithDefault(true),
    },
    endpoint: { type: String },
    clickable: { type: Boolean, converter: boolWithDefault(true) },
    height: { type: Number },
    width: { type: Number },
    align: { type: String },
  }

  declare mode: string

  declare post: string

  declare nodes: string

  declare depth: number

  declare dark: string | null

  declare theme: string | null

  declare currentPost: string

  declare showLabels: boolean

  declare showArrows: boolean

  declare showBroken: boolean

  declare showTaxonomy: boolean

  declare endpoint: string

  declare clickable: boolean

  declare height: number

  declare width: number

  declare align: string

  private renderer: GraphRenderer | null = null

  private status: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading'

  private errorMessage = ''

  private container: HTMLElement | null = null

  private controller: AbortController | null = null

  private stopTheme: (() => void) | null = null
  private payload: GraphPayload | null = null
  private settingsOpen = false
  private groups = false
  private keyword = ''

  private displayOptions() {
    const dark = resolveDark(
      this,
      normalizeTheme(this.theme, this.dark),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    )
    return {
      dark,
      theme: readGraphTheme(this, dark),
      showLabels: this.showLabels,
      showArrows: this.showArrows,
      showBroken: this.showBroken,
      showTaxonomy: this.showTaxonomy,
      showCategories: this.showTaxonomy,
      showTags: this.showTaxonomy,
      showGroups: this.groups,
    }
  }

  private syncTheme = (): void => {
    this.renderer?.setOptions(this.displayOptions())
    this.requestUpdate()
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      height: var(--obsidian-graph-height, 420px);
      border-radius: 8px;
      overflow: hidden;
    }
    .stage {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      touch-action: none;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      font:
        13px/1.6 -apple-system,
        'PingFang SC',
        'Microsoft YaHei',
        sans-serif;
      color: var(--graph-text);
      background: var(--graph-bg);
      text-align: center;
      padding: 16px;
    }
    .frame {
      height: 100%;
      position: relative;
      color: var(--graph-text);
      background: var(--graph-bg);
    }
    .controls {
      position: absolute;
      right: 10px;
      top: 10px;
      display: flex;
      gap: 4px;
    }
    button,
    input {
      font: inherit;
    }
    button {
      cursor: pointer;
      border: 1px solid var(--obsidian-graph-border, #8884);
      border-radius: 5px;
      background: var(--graph-bg);
      color: var(--graph-text);
      padding: 5px 9px;
    }
    button:hover {
      color: var(--graph-accent);
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--graph-accent);
      outline-offset: 2px;
    }
    .settings {
      position: absolute;
      right: 10px;
      top: 48px;
      width: min(220px, calc(100% - 40px));
      padding: 12px;
      border: 1px solid #8884;
      border-radius: 8px;
      background: var(--graph-bg);
      box-shadow: 0 5px 20px #0002;
      font: 12px/1.6 sans-serif;
      display: grid;
      gap: 10px;
    }
    label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input[type='search'] {
      min-width: 0;
      border: 1px solid #8884;
      border-radius: 4px;
      padding: 6px;
      background: transparent;
      color: inherit;
    }
    .notice {
      position: absolute;
      left: 10px;
      bottom: 8px;
      font: 11px/1.5 sans-serif;
    }
  `

  constructor() {
    super()
    this.mode = 'full'
    this.post = ''
    this.nodes = ''
    this.depth = 1
    this.dark = null
    this.theme = null
    this.currentPost = ''
    this.showLabels = true
    this.showArrows = false
    this.showBroken = false
    this.showTaxonomy = true
    this.endpoint = DEFAULT_ENDPOINT
    this.clickable = true
    this.height = 0
    this.width = 0
    this.align = ''
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.stopTheme = observeGraphTheme(this, this.syncTheme)
    void this.updateComplete.then(() => {
      if (this.isConnected && this.hasUpdated && !this.controller) void this.load()
    })
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.controller?.abort()
    this.controller = null
    this.stopTheme?.()
    this.stopTheme = null
    this.renderer?.destroy()
    this.renderer = null
  }

  protected updated(changed: Map<string, unknown>): void {
    const reloadKeys = [
      'mode',
      'post',
      'nodes',
      'depth',
      'showBroken',
      'showTaxonomy',
      'endpoint',
      'currentPost',
    ]
    if (reloadKeys.some((key) => changed.has(key))) {
      void this.load()
    }
    if (['theme', 'dark', 'showLabels', 'showArrows'].some((key) => changed.has(key))) {
      this.syncTheme()
    }
    if (['height', 'width', 'align'].some((key) => changed.has(key))) {
      this.applySizing()
    }
  }

  /**
   * Apply height/width/align attributes to the host element. Inline styles
   * emitted by the editor's renderHTML take precedence when already present.
   */
  private applySizing(): void {
    if (this.height > 0) {
      this.style.height = `${this.height}px`
    }
    if (this.width >= 20 && this.width <= 100) {
      this.style.width = `${this.width}%`
      const align = this.align === 'left' || this.align === 'right' ? this.align : 'center'
      this.style.marginLeft = align === 'left' ? '0' : 'auto'
      this.style.marginRight = align === 'right' ? '0' : 'auto'
    }
  }

  private query(): string {
    const mode =
      this.dataset.mode && !this.hasAttribute('mode') ? this.dataset.mode : this.mode || 'full'
    const post = this.post || this.dataset.post || this.currentPost
    const nodes = this.nodes || this.dataset.nodes || ''
    if (mode === 'local' && !post)
      throw new Error('局部图谱需要中心文章，请在文章中发布或指定 post')
    if (mode === 'nodes' && !nodes.trim()) throw new Error('请选择局部图谱中的文章')
    if (!['full', 'local', 'nodes'].includes(mode)) throw new Error('未知图谱模式')
    const params = new URLSearchParams({ mode })
    if (post) params.set('post', post)
    if (nodes) params.set('nodes', nodes)
    params.set(
      'depth',
      String(Math.min(Math.max(Number(this.dataset.depth || this.depth) || 1, 1), 5)),
    )
    params.set('showBroken', String(this.showBroken))
    params.set('showTaxonomy', String(this.showTaxonomy))
    const endpoint = new URL(this.endpoint || DEFAULT_ENDPOINT, document.baseURI)
    params.forEach((value, key) => endpoint.searchParams.set(key, value))
    return endpoint.href
  }

  private async load(): Promise<void> {
    if (!this.isConnected) {
      return
    }
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    this.status = 'loading'
    this.errorMessage = ''
    this.requestUpdate()
    try {
      const response = await fetch(this.query(), {
        signal: controller.signal,
        credentials: 'omit',
      })
      if (controller.signal.aborted) return
      if (response.status === 403) {
        this.renderer?.destroy()
        this.renderer = null
        this.payload = null
        this.status = 'forbidden'
        this.requestUpdate()
        return
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload = (await response.json()) as GraphPayload
      if (controller.signal.aborted) {
        return
      }
      await this.updateComplete
      if (controller.signal.aborted || !this.isConnected) return
      this.payload = payload
      this.applyPayload(payload)
      this.status = 'ready'
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      this.status = 'error'
      this.errorMessage = error instanceof Error ? error.message : String(error)
    }
    this.requestUpdate()
  }

  private applyPayload(payload: GraphPayload): void {
    if (!this.container) {
      return
    }
    if (!this.renderer) {
      this.renderer = new GraphRenderer(this.container, {
        ...this.displayOptions(),
        onSelect: (node) => {
          if (this.clickable === false || !node) {
            return
          }
          if (node.type === 'post' && node.permalink) {
            const target = new URL(node.permalink, document.baseURI)
            if (target.protocol === 'http:' || target.protocol === 'https:') {
              window.open(target.href, '_blank', 'noopener')
            }
          }
        },
      })
    }
    this.renderer.setData(payload, this.displayOptions())
    this.renderer.setHighlight(this.keyword)
  }

  protected render() {
    const { theme } = this.displayOptions()
    return html`
      <div
        class="frame"
        style=${`--graph-bg:${theme.background};--graph-text:${theme.label};--graph-accent:${theme.focusNode}`}
      >
        <div class="stage" part="canvas"></div>
        <div class="controls" aria-label="图谱工具栏">
          <button aria-label="放大" @click=${() => this.renderer?.zoomBy(1.25)}>+</button>
          <button aria-label="缩小" @click=${() => this.renderer?.zoomBy(0.8)}>−</button>
          <button aria-label="重置视图" @click=${() => this.renderer?.resetViewport()}>⤢</button>
          <button
            aria-label="图谱设置"
            aria-expanded=${this.settingsOpen}
            @click=${() => {
          this.settingsOpen = !this.settingsOpen
          this.requestUpdate()
        }}
          >
            ⚙
          </button>
        </div>
        ${
        this.settingsOpen
          ? html`<div class="settings">
              <input
                type="search"
                aria-label="搜索节点"
                placeholder="搜索节点…"
                .value=${this.keyword}
                @input=${(e: Event) => {
          this.keyword = (e.target as HTMLInputElement).value
          this.renderer?.setHighlight(this.keyword)
        }}
              />
              <label
                ><input
                  type="checkbox"
                  .checked=${this.showLabels}
                  @change=${(e: Event) => {
          this.showLabels = (e.target as HTMLInputElement).checked
        }}
                />显示名称</label
              >
              <label
                ><input
                  type="checkbox"
                  .checked=${this.showArrows}
                  @change=${(e: Event) => {
          this.showArrows = (e.target as HTMLInputElement).checked
        }}
                />显示箭头</label
              >
              <label
                ><input
                  type="checkbox"
                  .checked=${this.showTaxonomy}
                  @change=${(e: Event) => {
          this.showTaxonomy = (e.target as HTMLInputElement).checked
        }}
                />分类与标签</label
              >
              <label
                ><input
                  type="checkbox"
                  .checked=${this.groups}
                  @change=${(e: Event) => {
          this.groups = (e.target as HTMLInputElement).checked
          this.syncTheme()
        }}
                />分组颜色</label
              >
              <button @click=${() => this.renderer?.replay()}>重新布局</button>
            </div>`
          : nothing
      }
        ${this.status === 'ready' && this.payload?.truncated ? html`<div class="notice">节点数量已达上限，请缩小图谱范围</div>` : nothing}
        ${this.status === 'ready' && !this.payload?.nodes.length && !this.payload?.brokenNodes.length ? html`<div class="overlay">该范围内暂无公开文章</div>` : nothing}
        ${
        this.status === 'loading' && !this.renderer
          ? html`<div class="overlay">图谱加载中…</div>`
          : nothing
      }
        ${
        this.status === 'forbidden'
          ? html`<div class="overlay">
              关系图谱未开放匿名访问，请在插件设置中开启「允许匿名访问图谱」。
            </div>`
          : nothing
      }
        ${
        this.status === 'error'
          ? html`<div class="overlay">图谱加载失败：${this.errorMessage}</div>`
          : nothing
      }
      </div>
    `
  }

  protected firstUpdated(): void {
    this.container = this.renderRoot.querySelector('.stage')
  }
}

if (!customElements.get('obsidian-graph')) {
  customElements.define('obsidian-graph', ObsidianGraphElement)
}

declare global {
  interface HTMLElementTagNameMap {
    'obsidian-graph': ObsidianGraphElement
  }
}
