/**
 * Obsidian-style relationship graph renderer built on sigma.js (WebGL) +
 * graphology + ForceAtlas2, the same rendering/layout family as Obsidian's
 * native graph view. Shared by the Console graph view and the theme-side
 * <obsidian-graph> component.
 */
import Graph from 'graphology'
import Sigma from 'sigma'
import { DEFAULT_PRIMITIVES } from 'sigma/primitives'
import { type FragmentLayer } from 'sigma/rendering'
import FA2LayoutSupervisor from 'graphology-layout-forceatlas2/worker'
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2'
import type { Attributes } from 'graphology-types'
import type { EdgeDisplayData, NodeDisplayData } from 'sigma/types'
import { FALLBACK_PALETTE, OBSIDIAN_LIGHT_THEME, OBSIDIAN_THEME, type ObsidianTheme } from './obsidian-theme'
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

/** UNSIGNED_BYTE; inlined to avoid touching WebGL2RenderingContext at module scope. */
const GL_UNSIGNED_BYTE = 5121

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

/**
 * Fragment layer rendering nodes as soft 3D spheres: a lit highlight toward
 * the top-left, the base color in the middle and a shaded rim, which mimics
 * the depth cues of Obsidian's WebGL graph nodes.
 */
function createSphereLayer(): FragmentLayer {
  return {
    name: 'sphere',
    uniforms: [],
    attributes: [
      { name: 'sphereColor', size: 4, type: GL_UNSIGNED_BYTE, normalized: true, source: 'color' },
    ],
    glsl: /* glsl */ `
vec4 layer_sphere(vec4 v_sphereColor) {
  float size = max(context.shapeSize, 1e-4);
  vec2 p = context.uv / size;
  float r = clamp(length(p), 0.0, 1.0);
  vec3 base = v_sphereColor.rgb;
  vec3 lightCol = mix(base, vec3(1.0), 0.72);
  vec3 darkCol = mix(base, vec3(0.0), 0.30);
  vec2 lightPos = vec2(-0.36, -0.40);
  float d = clamp(length(p - lightPos), 0.0, 2.0);
  float highlight = pow(clamp(1.0 - d * 0.85, 0.0, 1.0), 2.2);
  vec3 col = mix(base, darkCol, smoothstep(0.45, 1.0, r));
  col = mix(col, lightCol, highlight * 0.85);
  col = mix(col, darkCol, smoothstep(0.82, 1.0, r) * 0.45);
  return vec4(col, v_sphereColor.a);
}`,
  }
}

function nodeRadius(node: GraphNode): number {
  switch (node.type) {
    case 'category':
      return 4 + Math.min(node.size, 9) * 0.9
    case 'tag':
      return 2 + Math.min(node.size, 7) * 0.6
    default:
      return node.broken ? 2 : 2.2 + Math.pow(Math.min(node.size, 24), 0.65) * 1.6
  }
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim())
  if (hex && hex[1]) {
    let h = hex[1]
    if (h.length === 3) {
      h = h.split('').map((c) => c + c).join('')
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
      textFade: 1,
      nodeSize: 1,
      lineThickness: 1,
      onSelect: () => {},
      ...options,
      forces: { ...DEFAULT_FORCES, ...(options.forces ?? {}) },
    }
    this.theme = this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME
    this.container.style.background = this.theme.background

    this.graph = new Graph<NodeAttrs, EdgeAttrs>({ multi: false, allowSelfLoops: false, type: 'mixed' })
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
      primitives: {
        ...DEFAULT_PRIMITIVES,
        nodes: {
          ...DEFAULT_PRIMITIVES.nodes,
          layers: [createSphereLayer()],
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
        renderLabels: this.opts.showLabels,
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        enableNodeDrag: true,
        hideEdgesOnMove: false,
        hideLabelsOnMove: false,
        labelDensity: 1.4,
        labelGridCellSize: 90,
        labelRenderedSizeThreshold: 5,
        stagePadding: 30,
        minCameraRatio: 0.08,
        maxCameraRatio: 10,
      },
      nodeReducer: (key, data) => this.reduceNode(key, data),
      edgeReducer: (key, data) => this.reduceEdge(key, data),
    })

    this.sigma.on('enterNode', ({ node }) => this.setFocus(node))
    this.sigma.on('leaveNode', () => this.setFocus(null))
    this.sigma.on('clickNode', ({ node }) => {
      this.selectedKey = node
      this.opts.onSelect(this.graph.getNodeAttribute(node, 'ref') ?? null)
      this.sigma.refresh()
    })
    this.sigma.on('clickStage', () => {
      this.selectedKey = null
      this.opts.onSelect(null)
      this.sigma.refresh()
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

    // Keep the WebGL canvas in sync when the container is resized
    // (e.g. the editor embed's drag-to-resize handles).
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.destroyed) {
          return
        }
        this.sigma.resize()
        this.sigma.refresh()
      })
      this.resizeObserver.observe(this.container)
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
    this.theme = this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME
    this.container.style.background = this.theme.background

    const nodes: GraphNode[] = payload.nodes.filter(
      (node) =>
        (node.type !== 'category' || this.opts.showCategories) &&
        (node.type !== 'tag' || this.opts.showTags)
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
      const pair = [edge.source, edge.target].sort().join('→')
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
        baseColor: node.broken ? this.theme.brokenColor : this.theme.node,
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
        weight: edge.type === 'taxonomy' ? 0.7 : 1,
      }
      if (!this.graph.hasEdge(id)) {
        this.graph.addEdgeWithKey(id, edge.source, edge.target, attrs)
      } else {
        this.graph.mergeEdgeAttributes(id, attrs)
      }
    }

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
    this.theme = this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME
    this.container.style.background = this.theme.background
    this.sigma.setSettings({ renderLabels: this.opts.showLabels })
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
    this.sigma.scheduleRefresh()
  }

  zoomBy(factor: number): void {
    const camera = this.sigma.getCamera()
    void camera.animate(
      { ratio: camera.getBoundedRatio(camera.ratio / factor) },
      { duration: 160 }
    )
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

  destroy(): void {
    this.destroyed = true
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
    this.layout?.kill()
    this.layout = null
    if (this.graph.order === 0 || this.destroyed) {
      return
    }
    this.layout = new FA2LayoutSupervisor<NodeAttrs, EdgeAttrs>(this.graph, {
      settings: this.fa2Settings(),
      getEdgeWeight: (_edge, attrs) => ((attrs as EdgeAttrs | undefined)?.weight ?? 1) * this.weightMultiplier(),
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
      this.restartLayout(this.layout.isRunning() ? RESETTLE_MS : 0)
      return
    }
    // gravity / scalingRatio / edgeWeightInfluence are sent to the worker on
    // every iteration, so mutating settings updates the simulation live.
    (this.layout as unknown as { settings: ForceAtlas2Settings }).settings = this.fa2Settings()
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
      this.normalizePositions()
    }, ms)
  }

  /**
   * Rescale the settled layout around its centroid so the graph always ends
   * up centered and compact: link lengths become uniform regardless of the
   * raw ForceAtlas2 coordinate scale, and the camera reverts to the default
   * "fit all" view. Outliers beyond the 98th-percentile radius are clamped so
   * a single far-away node cannot stretch the whole graph.
   */
  private normalizePositions(): void {
    if (this.destroyed || this.graph.order === 0) {
      return
    }
    let cx = 0
    let cy = 0
    this.graph.forEachNode((_key, attrs) => {
      cx += attrs.x
      cy += attrs.y
    })
    cx /= this.graph.order
    cy /= this.graph.order
    const dists: number[] = []
    this.graph.forEachNode((_key, attrs) => {
      dists.push(Math.hypot(attrs.x - cx, attrs.y - cy))
    })
    dists.sort((a, b) => a - b)
    const radius = dists[Math.floor(dists.length * 0.98)] || dists[dists.length - 1] || 1
    const scale = NODE_SCALE_TARGET / Math.max(radius, 1e-6)
    const maxRadius = NODE_SCALE_TARGET * 1.3
    this.graph.updateEachNodeAttributes((_key, attrs) => {
      let dx = (attrs.x - cx) * scale
      let dy = (attrs.y - cy) * scale
      const len = Math.hypot(dx, dy)
      if (len > maxRadius && len > 0) {
        dx = (dx / len) * maxRadius
        dy = (dy / len) * maxRadius
      }
      attrs.x = cx + dx
      attrs.y = cy + dy
      return attrs
    })
    this.updateAutoScale()
    void this.sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 250 })
    this.sigma.refresh()
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

    let color = attrs.broken ? theme.brokenColor : attrs.baseColor
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

    const labelAlpha = this.opts.textFade * (1 - dim)
    out.labelColor = withAlpha(theme.label, labelAlpha)
    // Plain text right under the node, no card/background styling; the
    // focused node's title is always shown on hover.
    out.labelPosition = 'below'
    out.labelBackgroundColor = 'transparent'
    out.labelVisibility = key === focus ? 'visible' : dim > 0.55 ? 'hidden' : 'auto'

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

    const size = (isTaxonomy ? 0.5 : 0.8) * this.opts.lineThickness * (1 + active * 0.7) * this.autoScale
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
