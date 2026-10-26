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
 *   dark           dark Obsidian palette (default: true, opt-out with dark="false")
 *   show-labels    always draw node labels (default: false)
 *   show-arrows    draw direction arrows on wiki edges (default: false)
 *   show-broken    include unresolved links (default: false)
 *   show-taxonomy  include category/tag hubs (default: true, opt-out with show-taxonomy="false")
 *   endpoint       override of the public graph API URL
 *   clickable      open post permalink on click (default: true, opt-out with clickable="false")
 *
 * CSS custom properties:
 *   --obsidian-graph-height  container height (default: 420px)
 */
import { LitElement, css, html, nothing } from 'lit'
import { GraphRenderer } from '../../src/shared/graph-renderer/renderer'
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
    dark: { type: Boolean, converter: boolWithDefault(true), noAccessor: true },
    showLabels: {
      type: Boolean,
      attribute: 'show-labels',
      converter: boolWithDefault(false),
      noAccessor: true,
    },
    showArrows: {
      type: Boolean,
      attribute: 'show-arrows',
      converter: boolWithDefault(false),
      noAccessor: true,
    },
    showBroken: {
      type: Boolean,
      attribute: 'show-broken',
      converter: boolWithDefault(false),
      noAccessor: true,
    },
    showTaxonomy: {
      type: Boolean,
      attribute: 'show-taxonomy',
      converter: boolWithDefault(true),
      noAccessor: true,
    },
    endpoint: { type: String },
    clickable: { type: Boolean, converter: boolWithDefault(true), noAccessor: true },
  }

  declare mode: string

  declare post: string

  declare nodes: string

  declare depth: number

  declare dark: boolean

  declare showLabels: boolean

  declare showArrows: boolean

  declare showBroken: boolean

  declare showTaxonomy: boolean

  declare endpoint: string

  declare clickable: boolean

  private renderer: GraphRenderer | null = null

  private status: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading'

  private errorMessage = ''

  private canvas: HTMLCanvasElement | null = null

  private controller: AbortController | null = null

  static styles = css`
    :host {
      display: block;
      position: relative;
      height: var(--obsidian-graph-height, 420px);
      border-radius: 8px;
      overflow: hidden;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
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
      font: 13px/1.6 -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      color: #8a8f98;
      background: rgba(21, 22, 26, 0.9);
      text-align: center;
      padding: 16px;
    }
    :host([light]) .overlay {
      background: rgba(250, 250, 250, 0.92);
    }
  `

  constructor() {
    super()
    this.mode = 'full'
    this.post = ''
    this.nodes = ''
    this.depth = 1
    this.dark = true
    this.showLabels = false
    this.showArrows = false
    this.showBroken = false
    this.showTaxonomy = true
    this.endpoint = DEFAULT_ENDPOINT
    this.clickable = true
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.load()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.controller?.abort()
    this.renderer?.destroy()
    this.renderer = null
  }

  protected updated(changed: Map<string, unknown>): void {
    const reloadKeys = [
      'mode', 'post', 'nodes', 'depth', 'showBroken', 'showTaxonomy', 'endpoint',
      'showLabels', 'showArrows', 'dark',
    ]
    if (reloadKeys.some((key) => changed.has(key))) {
      this.load()
    }
  }

  private query(): string {
    const params = new URLSearchParams()
    params.set('mode', this.mode || 'full')
    if (this.post) {
      params.set('post', this.post)
    }
    if (this.nodes) {
      params.set('nodes', this.nodes)
    }
    params.set('depth', String(Math.min(Math.max(this.depth || 1, 1), 5)))
    params.set('showBroken', String(!!this.showBroken))
    params.set('showTaxonomy', String(this.showTaxonomy !== false))
    return `${this.endpoint || DEFAULT_ENDPOINT}?${params.toString()}`
  }

  private async load(): Promise<void> {
    if (!this.isConnected) {
      return
    }
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    this.status = 'loading'
    this.requestUpdate()
    try {
      const response = await fetch(this.query(), {
        signal: controller.signal,
        credentials: 'omit',
      })
      if (response.status === 403) {
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
    if (!this.canvas) {
      return
    }
    if (!this.renderer) {
      this.renderer = new GraphRenderer(this.canvas, {
        dark: this.dark !== false,
        showLabels: this.showLabels === true,
        showArrows: this.showArrows === true,
        showBroken: this.showBroken === true,
        showTaxonomy: this.showTaxonomy !== false,
        onSelect: (node) => {
          if (this.clickable === false || !node) {
            return
          }
          if (node.type === 'post' && node.permalink) {
            window.open(node.permalink, '_blank', 'noopener')
          }
        },
      })
    }
    this.renderer.setData(payload, {
      dark: this.dark !== false,
      showLabels: this.showLabels === true,
      showArrows: this.showArrows === true,
    })
  }

  protected render() {
    return html`
      <canvas part="canvas"></canvas>
      ${this.status === 'loading' && !this.renderer
        ? html`<div class="overlay">图谱加载中…</div>`
        : nothing}
      ${this.status === 'forbidden'
        ? html`<div class="overlay">
            关系图谱未开放匿名访问，请在插件设置中开启「允许匿名访问图谱」。
          </div>`
        : nothing}
      ${this.status === 'error'
        ? html`<div class="overlay">图谱加载失败：${this.errorMessage}</div>`
        : nothing}
    `
  }

  protected firstUpdated(): void {
    this.canvas = this.renderRoot.querySelector('canvas')
    if (this.status === 'ready') {
      // Payload arrived before the canvas was ready.
      this.load()
    }
  }
}

customElements.define('obsidian-graph', ObsidianGraphElement)

declare global {
  interface HTMLElementTagNameMap {
    'obsidian-graph': ObsidianGraphElement
  }
}
