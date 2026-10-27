/**
 * Obsidian-style relationship graph renderer built on sigma.js (WebGL) +
 * graphology + ForceAtlas2. Inspired by the documented Obsidian graph view,
 * not its private implementation. Shared by the Console and theme-side
 * <obsidian-graph> component.
 */
import Graph from 'graphology'
import Sigma from 'sigma'
import { DEFAULT_PRIMITIVES } from 'sigma/primitives'
import FA2LayoutSupervisor from 'graphology-layout-forceatlas2/worker'
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2'
import type { Attributes } from 'graphology-types'
import type { EdgeDisplayData, NodeDisplayData } from 'sigma/types'
import { DEFAULT_STYLES } from 'sigma/types'
import {
  FALLBACK_PALETTE,
  OBSIDIAN_LIGHT_THEME,
  OBSIDIAN_THEME,
  type ObsidianTheme,
} from './obsidian-theme'
import type { EdgeType, GraphEdge, GraphNode, GraphPayload, NodeType } from './types'

export interface RendererForces {
  /** FA2 gravity pulling nodes toward the center (0 - 1). */
  center: number
  /** FA2 scalingRatio: overall repulsion between nodes (0.5 - 8). */
  repel: number
  /** FA2 edgeWeightInfluence: attraction strength along links (0 - 2). */
  link: number
  /** Nominal link distance in px; larger values weaken edge weight (20 - 120). */
  distance: number
}

export interface RendererOptions {
  dark: boolean
  showLabels: boolean
  showArrows: boolean
  showBroken: boolean
  showTaxonomy: boolean
  showCategories: boolean
  showTags: boolean
  showGroups: boolean
  theme?: Partial<ObsidianTheme>
  /** Global label opacity (0 - 1), like Obsidian's text fade slider. */
  textFade: number
  /** Node radius multiplier (0.5 - 2). */
  nodeSize: number
  /** Edge thickness multiplier (0.5 - 2.5). */
  lineThickness: number
  forces: RendererForces
  onSelect: (node: GraphNode | null) => void
  onViewportChange?: (transform: { x: number; y: number; k: number }) => void
}

const DEFAULT_FORCES: RendererForces = { center: 0.15, repel: 2.2, link: 1, distance: 55 }

/** Patch type accepting partial forces for constructor/setData/setOptions. */
export type RendererOptionsInput = Partial<Omit<RendererOptions, 'forces'>> & {
  forces?: Partial<RendererForces>
}

const SETTLE_MS = 8000
const RESETTLE_MS = 3500

/**
 * World-unit link distance the node radius curve was designed for. FA2's
 * equilibrium link distance (sqrt(scalingRatio * m1 * m2 / weight)) can be as
 * low as a few units on small graphs, so raw radii would dwarf the layout;
 * sizes are rescaled by measuredAvgLink / NODE_SCALE_TARGET every frame.
 */
const NODE_SCALE_TARGET = 150

interface NodeAttrs extends Attributes {
  x: number
  y: number
  label: string
  baseColor: string
  baseSize: number
  nodeType: NodeType
  broken: boolean
  ref: GraphNode
}

interface EdgeAttrs extends Attributes {
  edgeType: EdgeType
  weight: number
}

type GraphT = Graph<NodeAttrs, EdgeAttrs>

function nodeRadius(node: GraphNode): number {
  if (node.broken) return 2.2
  return 2.6 + Math.min(5, Math.sqrt(Math.max(0, node.degree)) * 0.85)
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim())
  if (hex && hex[1]) {
    let h = hex[1]
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('')
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color.trim())
  if (rgb && rgb[1] && rgb[2] && rgb[3]) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }
  return null
}

function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return color
  }
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

export class GraphRenderer {
  private container: HTMLElement

  private opts: RendererOptions

  private theme: ObsidianTheme

  private graph: GraphT

  private sigma: Sigma<NodeAttrs, EdgeAttrs>

  private layout: FA2LayoutSupervisor<NodeAttrs, EdgeAttrs> | null = null

  private settleTimer: ReturnType<typeof setTimeout> | null = null

  private frameHandle: number | null = null

  private destroyed = false

  private hoverKey: string | null = null

  private selectedKey: string | null = null

  private highlightKeyword = ''

  private focusNeighbors = new Set<string>()

  private nodeDim = new Map<string, number>()

  private nodeDimTarget = new Map<string, number>()

  private nodeScale = new Map<string, number>()

  private nodeScaleTarget = new Map<string, number>()

  private edgeDim = new Map<string, number>()

  private edgeDimTarget = new Map<string, number>()

  private edgeActive = new Map<string, number>()

  private edgeActiveTarget = new Map<string, number>()

  /** Node size factor derived from the current average link distance. */
  private autoScale = 1

  private lastScaleCheck = 0

  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement, options: RendererOptionsInput = {}) {
    this.container = container
    this.opts = {
      dark: false,
      showLabels: true,
      showArrows: false,
      showBroken: true,
      showTaxonomy: true,
      showCategories: true,
      showTags: true,
      showGroups: false,
      textFade: 1,
      nodeSize: 1,
      lineThickness: 1,
      onSelect: () => {},
      ...options,
      forces: { ...DEFAULT_FORCES, ...(options.forces ?? {}) },
    }
    this.theme = { ...(this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME), ...this.opts.theme }
    this.container.style.background = this.theme.background

    this.graph = new Graph<NodeAttrs, EdgeAttrs>({
      multi: true,
      allowSelfLoops: false,
      type: 'directed',
    })
    // FA2 writes coordinates back on every iteration; keep node sizes
    // proportional to the live average link distance (throttled).
    this.graph.on('eachNodeAttributesUpdated', () => {
      const now = performance.now()
      if (now - this.lastScaleCheck > 150) {
        this.lastScaleCheck = now
        this.updateAutoScale()
      }
    })

    this.sigma = new Sigma(this.graph, this.container, {
      styles: {
        nodes: {
          ...DEFAULT_STYLES.nodes,
          // Sigma's hover backdrop is separate from the label background.
          backdropVisibility: 'hidden',
          backdropColor: 'transparent',
          backdropShadowColor: 'transparent',
          backdropShadowBlur: 0,
          backdropPadding: 0,
          labelBackgroundColor: 'transparent',
          labelBackgroundPadding: 0,
        },
      },
      primitives: {
        ...DEFAULT_PRIMITIVES,
        nodes: {
          ...DEFAULT_PRIMITIVES.nodes,

          label: {
            margin: 4,
            font: {
              family:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              size: 11,
            },
          },
        },
      },
      settings: {
        renderLabels: true,
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        enableNodeDrag: true,
        hideEdgesOnMove: false,
        hideLabelsOnMove: false,
        labelDensity: 0.7,
        labelGridCellSize: 90,
        labelRenderedSizeThreshold: 2,
        stagePadding: 30,
        minCameraRatio: 0.08,
        maxCameraRatio: 10,
        // The host can transiently be 0-sized (theme layout settling); never
        // throw — the ResizeObserver below restores the real size.
        allowInvalidContainer: true,
      },
      nodeReducer: (key, data) => this.reduceNode(key, data),
      edgeReducer: (key, data) => this.reduceEdge(key, data),
    })

    this.sigma.on('enterNode', ({ node }) => this.setFocus(node))
    this.sigma.on('leaveNode', () => this.setFocus(null))
    this.sigma.on('clickNode', ({ node }) => {
      this.selectedKey = node
      this.opts.onSelect(this.graph.getNodeAttribute(node, 'ref') ?? null)
      this.setFocus(this.hoverKey)
    })
    this.sigma.on('clickStage', () => {
      this.selectedKey = null
      this.opts.onSelect(null)
      this.setFocus(null)
    })
    this.sigma.on('nodeDragStart', () => {
      this.layout?.stop()
    })
    this.sigma.on('nodeDragEnd', () => {
      if (this.layout && !this.layout.isRunning()) {
        this.layout.start()
        this.scheduleSettle(RESETTLE_MS)
      }
    })

    this.container.tabIndex = 0
    this.container.setAttribute('aria-label', '关系图谱；加减键缩放，方向键平移')
    this.container.addEventListener('keydown', this.onKeyDown)

    // Keep the WebGL canvas in sync when the container is resized
    // (e.g. the editor embed's drag-to-resize handles, or a theme layout that
    // starts 0-sized and settles later). Force the resize: sigma caches its
    // own dimensions and would otherwise skip transitions it never measured.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.destroyed) {
          return
        }
        this.sigma.resize(true)
        this.sigma.refresh()
      })
      this.resizeObserver.observe(this.container)
    }
    // Reconcile once after the current layout pass: the constructor may run
    // before the container has its final size.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        if (this.destroyed) {
          return
        }
        this.sigma.resize(true)
        this.sigma.refresh()
      })
    }
  }

  setData(payload: GraphPayload, partialOpts: RendererOptionsInput = {}): void {
    if (this.destroyed) {
      return
    }
    this.opts = {
      ...this.opts,
      ...partialOpts,
      forces: { ...this.opts.forces, ...(partialOpts.forces ?? {}) },
    }
    this.theme = { ...(this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME), ...this.opts.theme }
    this.container.style.background = this.theme.background

    const nodes: GraphNode[] = payload.nodes.filter(
      (node) =>
        (node.type !== 'category' || this.opts.showCategories) &&
        (node.type !== 'tag' || this.opts.showTags),
    )
    if (this.opts.showBroken) {
      nodes.push(...payload.brokenNodes)
    }
    const edges: GraphEdge[] = [...payload.edges]
    if (this.opts.showBroken) {
      edges.push(...payload.brokenEdges)
    }
    const visibleEdges = this.opts.showTaxonomy
      ? edges
      : edges.filter((edge) => edge.type === 'wikilink')

    const nodeIds = new Set(nodes.map((node) => node.id))
    const seenPairs = new Set<string>()
    const edgesById = new Map<string, GraphEdge>()
    for (const edge of visibleEdges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
        continue
      }
      const pair = JSON.stringify([edge.type, edge.source, edge.target])
      if (seenPairs.has(pair)) {
        continue
      }
      seenPairs.add(pair)
      edgesById.set(edge.id, edge)
    }

    // Drop nodes that left the payload; surviving nodes keep their positions.
    const toDrop: string[] = []
    this.graph.forEachNode((key) => {
      if (!nodeIds.has(key)) {
        toDrop.push(key)
      }
    })
    for (const key of toDrop) {
      this.graph.dropNode(key)
    }
    for (const edgeKey of [...this.graph.edges()]) {
      if (!edgesById.has(edgeKey)) {
        this.graph.dropEdge(edgeKey)
      }
    }

    for (const node of nodes) {
      const attrs = {
        label: node.title,
        baseColor: node.color || '',
        baseSize: nodeRadius(node),
        nodeType: node.type,
        broken: !!node.broken,
        ref: node,
      }
      if (this.graph.hasNode(node.id)) {
        this.graph.mergeNodeAttributes(node.id, attrs)
      } else {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.sqrt(Math.random()) * 30
        this.graph.addNode(node.id, {
          ...attrs,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        })
      }
    }
    for (const [id, edge] of edgesById) {
      const attrs: EdgeAttrs = {
        edgeType: edge.type,
        weight: edge.type === 'taxonomy' ? 1.2 : 1,
      }
      if (!this.graph.hasEdge(id)) {
        this.graph.addEdgeWithKey(id, edge.source, edge.target, attrs)
      } else {
        this.graph.mergeEdgeAttributes(id, attrs)
      }
    }

    if (this.selectedKey && !nodeIds.has(this.selectedKey)) this.selectedKey = null
    if (this.hoverKey && !nodeIds.has(this.hoverKey)) this.hoverKey = null
    for (const map of [this.nodeDim, this.nodeDimTarget, this.nodeScale, this.nodeScaleTarget]) {
      for (const key of map.keys()) if (!nodeIds.has(key)) map.delete(key)
    }
    for (const map of [this.edgeDim, this.edgeDimTarget, this.edgeActive, this.edgeActiveTarget]) {
      for (const key of map.keys()) if (!edgesById.has(key)) map.delete(key)
    }
    this.setFocus(this.hoverKey)
    this.updateAutoScale()
    this.restartLayout(this.graph.order > 0 ? SETTLE_MS : 0)
  }

  /**
   * Update display-only options (theme, labels, appearance, forces) without
   * rebuilding the graph; live force updates keep the layout organic.
   */
  setOptions(partialOpts: RendererOptionsInput = {}): void {
    const distanceChanged =
      partialOpts.forces?.distance !== undefined &&
      partialOpts.forces.distance !== this.opts.forces.distance
    this.opts = {
      ...this.opts,
      ...partialOpts,
      forces: { ...this.opts.forces, ...(partialOpts.forces ?? {}) },
    }
    this.theme = { ...(this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME), ...this.opts.theme }
    this.container.style.background = this.theme.background
    // Keep the label pass active so hovered titles remain visible when labels are off.
    this.sigma.setSettings({ renderLabels: true })
    if (partialOpts.forces) {
      this.applyForces(distanceChanged)
    }
    this.sigma.scheduleRefresh()
  }

  setHighlight(keyword: string): void {
    this.highlightKeyword = (keyword ?? '').trim().toLowerCase()
    this.sigma.scheduleRefresh()
  }

  setSelected(id: string | null): void {
    this.selectedKey = id
    this.setFocus(this.hoverKey)
  }

  zoomBy(factor: number): void {
    const camera = this.sigma.getCamera()
    void camera.animate({ ratio: camera.getBoundedRatio(camera.ratio / factor) }, { duration: 160 })
  }

  resetViewport(): void {
    void this.sigma.getCamera().reset({ duration: 300 })
  }

  /** Replay Obsidian's slow graph growth animation from the center. */
  replay(): void {
    if (this.destroyed || this.graph.order === 0) {
      return
    }
    this.graph.updateEachNodeAttributes((_key, attrs) => {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 30
      attrs.x = Math.cos(angle) * radius
      attrs.y = Math.sin(angle) * radius
      return attrs
    })
    void this.sigma.getCamera().reset({ duration: 300 })
    this.restartLayout(SETTLE_MS)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.container) return
    if (event.key === '+' || event.key === '=') this.zoomBy(1.25)
    else if (event.key === '-') this.zoomBy(0.8)
    else if (event.key.startsWith('Arrow')) {
      const camera = this.sigma.getCamera()
      const step = camera.ratio * (event.shiftKey ? 0.12 : 0.04)
      void camera.animate(
        {
          x: camera.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
          y: camera.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
        },
        { duration: 100 },
      )
    } else return
    event.preventDefault()
  }

  destroy(): void {
    this.destroyed = true
    this.container.removeEventListener('keydown', this.onKeyDown)
    if (this.settleTimer) {
      clearTimeout(this.settleTimer)
      this.settleTimer = null
    }
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle)
      this.frameHandle = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.layout?.kill()
    this.layout = null
    this.sigma.kill()
  }

  // ---------------------------------------------------------------------------
  // ForceAtlas2 layout
  // ---------------------------------------------------------------------------

  private fa2Settings() {
    const f = this.opts.forces
    return {
      adjustSizes: false,
      barnesHutOptimize: this.graph.order > 60,
      barnesHutTheta: 0.6,
      edgeWeightInfluence: f.link,
      gravity: f.center,
      linLogMode: false,
      outboundAttractionDistribution: false,
      scalingRatio: f.repel,
      slowDown: 2.5,
      strongGravityMode: false,
    }
  }

  private weightMultiplier(): number {
    return 55 / Math.max(this.opts.forces.distance, 10)
  }

  private restartLayout(settleMs: number): void {
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = null
    this.layout?.kill()
    this.layout = null
    if (this.graph.order === 0 || this.destroyed) {
      return
    }
    this.layout = new FA2LayoutSupervisor<NodeAttrs, EdgeAttrs>(this.graph, {
      settings: this.fa2Settings(),
      getEdgeWeight: (_edge, attrs) =>
        ((attrs as EdgeAttrs | undefined)?.weight ?? 1) * this.weightMultiplier(),
    })
    this.layout.start()
    if (settleMs > 0) {
      this.scheduleSettle(settleMs)
    }
  }

  private applyForces(distanceChanged: boolean): void {
    if (!this.layout) {
      return
    }
    if (distanceChanged) {
      // Edge weights are baked into the worker matrices at spawn time, so a
      // distance change requires a respawn; positions carry over seamlessly.
      this.restartLayout(RESETTLE_MS)
      return
    }
    // gravity / scalingRatio / edgeWeightInfluence are sent to the worker on
    // every iteration, so mutating settings updates the simulation live.
    ;(this.layout as unknown as { settings: ForceAtlas2Settings }).settings = this.fa2Settings()
    if (this.layout.isRunning()) {
      this.scheduleSettle(RESETTLE_MS)
    } else {
      this.layout.start()
      this.scheduleSettle(RESETTLE_MS)
    }
  }

  private scheduleSettle(ms: number): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer)
    }
    this.settleTimer = setTimeout(() => {
      this.layout?.stop()
      this.settleTimer = null
      this.updateAutoScale()
    }, ms)
  }

  // ---------------------------------------------------------------------------
  // Hover / focus highlight with soft tweens
  // ---------------------------------------------------------------------------

  private focusKey(): string | null {
    return this.hoverKey ?? this.selectedKey
  }

  private setFocus(key: string | null): void {
    this.hoverKey = key
    const focus = this.focusKey()
    this.focusNeighbors = new Set<string>()
    if (focus && this.graph.hasNode(focus)) {
      for (const neighbor of this.graph.neighbors(focus)) {
        this.focusNeighbors.add(neighbor)
      }
    }
    this.graph.forEachNode((key2) => {
      const related = !focus || key2 === focus || this.focusNeighbors.has(key2)
      this.nodeDimTarget.set(key2, related ? 0 : 1)
      this.nodeScaleTarget.set(key2, key2 === focus ? 1.25 : focus && related ? 1.06 : 1)
    })
    this.graph.forEachEdge((key2, _attrs, source, target) => {
      const connected = !!focus && (source === focus || target === focus)
      this.edgeDimTarget.set(key2, !focus || connected ? 0 : 1)
      this.edgeActiveTarget.set(key2, connected ? 1 : 0)
    })
    this.scheduleFrame()
  }

  private scheduleFrame(): void {
    if (this.frameHandle === null && !this.destroyed) {
      this.frameHandle = requestAnimationFrame(this.stepFrame)
    }
  }

  private stepFrame = (): void => {
    this.frameHandle = null
    let animating = false
    animating = this.tween(this.nodeDim, this.nodeDimTarget, 0.16) || animating
    animating = this.tween(this.nodeScale, this.nodeScaleTarget, 0.16) || animating
    animating = this.tween(this.edgeDim, this.edgeDimTarget, 0.16) || animating
    animating = this.tween(this.edgeActive, this.edgeActiveTarget, 0.16) || animating
    this.sigma.refresh()
    if (animating) {
      this.scheduleFrame()
    }
  }

  private tween(current: Map<string, number>, targets: Map<string, number>, ease: number): boolean {
    let animating = false
    for (const [key, target] of targets) {
      const value = current.get(key) ?? 0
      const next = value + (target - value) * ease
      if (Math.abs(next - target) > 0.004) {
        current.set(key, next)
        animating = true
      } else if (value !== target) {
        current.set(key, target)
      }
    }
    return animating
  }

  // ---------------------------------------------------------------------------
  // Reducers: translate tween state + options into per-frame display data
  // ---------------------------------------------------------------------------

  /**
   * Rescale node sizes so they stay proportional to the live average link
   * distance instead of the absolute FA2 coordinate scale, which collapses to
   * a few world units on small graphs and balloons on dense ones.
   */
  private updateAutoScale(): void {
    if (this.graph.size === 0) {
      this.autoScale = 1
      return
    }
    let sum = 0
    let count = 0
    this.graph.forEachEdge((_key, _attrs, source, target) => {
      const sx = this.graph.getNodeAttribute(source, 'x')
      const sy = this.graph.getNodeAttribute(source, 'y')
      const tx = this.graph.getNodeAttribute(target, 'x')
      const ty = this.graph.getNodeAttribute(target, 'y')
      const length = Math.hypot(sx - tx, sy - ty)
      if (Number.isFinite(length) && length > 0) {
        sum += length
        count += 1
      }
    })
    if (count === 0) {
      return
    }
    const scale = sum / count / NODE_SCALE_TARGET
    this.autoScale = Math.min(4, Math.max(0.005, scale))
  }

  private reduceNode(key: string, data: NodeDisplayData): Partial<NodeDisplayData> {
    const attrs = this.graph.getNodeAttributes(key)
    const theme = this.theme
    const focus = this.focusKey()
    const dim = this.nodeDim.get(key) ?? 0
    const scale = this.nodeScale.get(key) ?? 1
    const out: Partial<NodeDisplayData> = {}

    out.size = attrs.baseSize * this.opts.nodeSize * scale * this.autoScale

    let color = attrs.broken
      ? theme.brokenColor
      : this.opts.showGroups && attrs.baseColor
        ? attrs.baseColor
        : theme.node
    if (key === focus || key === this.selectedKey) {
      color = theme.focusNode
    } else if (this.highlightKeyword && attrs.label.toLowerCase().includes(this.highlightKeyword)) {
      color = theme.highlightRing
    }
    if (color !== data.color) {
      out.color = color
    }

    const opacity = 1 - dim * (1 - theme.dimmedOpacity)
    if (Math.abs(opacity - data.opacity) > 0.001) {
      out.opacity = opacity
    }

    const related = !!focus && (key === focus || this.focusNeighbors.has(key))
    const labelAlpha = this.opts.textFade * (1 - dim * (1 - theme.dimmedLabelOpacity))
    out.labelColor = withAlpha(related ? theme.focusLabel : theme.label, labelAlpha)
    // Plain text right under the node, no card/background styling; the
    // focused node's title is always shown on hover.
    out.labelPosition = 'below'
    out.labelBackgroundColor = 'transparent'
    out.labelBackgroundPadding = 0
    out.labelVisibility =
      key === focus || key === this.selectedKey
        ? 'visible'
        : !this.opts.showLabels
          ? 'hidden'
          : related
            ? 'visible'
            : 'auto'

    return out
  }

  private reduceEdge(key: string, data: EdgeDisplayData): Partial<EdgeDisplayData> {
    const attrs = this.graph.getEdgeAttributes(key)
    const theme = this.theme
    const isTaxonomy = attrs.edgeType === 'taxonomy'
    const dim = this.edgeDim.get(key) ?? 0
    const active = this.edgeActive.get(key) ?? 0
    const out: Partial<EdgeDisplayData> = {}

    const baseOpacity = isTaxonomy ? theme.edgeTaxonomyOpacity : theme.edgeOpacity
    const opacity = baseOpacity * (1 - dim * (1 - theme.dimmedOpacity)) + active * 0.35
    if (Math.abs(opacity - data.opacity) > 0.001) {
      out.opacity = Math.min(1, opacity)
    }

    const color = active > 0.4 ? theme.focusNode : isTaxonomy ? theme.edgeTaxonomy : theme.edge
    if (color !== data.color) {
      out.color = color
    }

    const size =
      (isTaxonomy ? 0.5 : 0.8) * this.opts.lineThickness * (1 + active * 0.15) * this.autoScale
    if (Math.abs(size - data.size) > 0.001) {
      out.size = size
    }

    const head = this.opts.showArrows && !isTaxonomy ? 'arrow' : undefined
    if (head !== data.head) {
      out.head = head
    }

    return out
  }
}

export { FALLBACK_PALETTE }
