/**
 * Obsidian-style knowledge graph renderer: d3-force physics + Canvas 2D drawing.
 * Shared by the Console graph view and the theme-side <obsidian-graph> component.
 */
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { FALLBACK_PALETTE, OBSIDIAN_LIGHT_THEME, OBSIDIAN_THEME, type ObsidianTheme } from './obsidian-theme'
import type { GraphEdge, GraphNode, GraphPayload } from './types'

export interface RendererOptions {
  dark: boolean
  showLabels: boolean
  showArrows: boolean
  showBroken: boolean
  showTaxonomy: boolean
  showCategories: boolean
  showTags: boolean
  onSelect: (node: GraphNode | null) => void
  onViewportChange?: (transform: { x: number; y: number; k: number }) => void
}

interface SimNode extends SimulationNodeDatum {
  ref: GraphNode
  r: number
  vx?: number
  vy?: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  ref: GraphEdge
}

function hasPos(node: SimNode): node is SimNode & { x: number; y: number } {
  return node.x !== undefined && node.y !== undefined
}

function nodeKey(datum: string | number | SimNode): string {
  return typeof datum === 'object' ? datum.ref.id : String(datum)
}

export class GraphRenderer {
  private canvas: HTMLCanvasElement

  private ctx: CanvasRenderingContext2D

  private opts: RendererOptions

  private theme: ObsidianTheme

  private sim: Simulation<SimNode, SimLink> | null = null

  private simNodes: SimNode[] = []

  private simLinks: SimLink[] = []

  private nodeById = new Map<string, SimNode>()

  private transform = { x: 0, y: 0, k: 1 }

  private viewportInitialized = false

  private hoverId: string | null = null

  private selectedId: string | null = null

  private highlightKeyword = ''

  private dragging: { kind: 'node' | 'pan'; id?: string; lastX: number; lastY: number }
    | null = null

  private frame = 0

  private width = 0

  private height = 0

  private resizeObserver: ResizeObserver | null = null

  private destroyed = false

  constructor(canvas: HTMLCanvasElement, options: Partial<RendererOptions> = {}) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context is not available')
    }
    this.ctx = ctx
    this.opts = {
      dark: true,
      showLabels: false,
      showArrows: false,
      showBroken: true,
      showTaxonomy: true,
      showCategories: true,
      showTags: true,
      onSelect: () => {},
      ...options,
    }
    this.theme = this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  setData(payload: GraphPayload, partialOpts: Partial<RendererOptions> = {}): void {
    if (this.destroyed) {
      return
    }
    this.opts = { ...this.opts, ...partialOpts }
    this.theme = this.opts.dark ? OBSIDIAN_THEME : OBSIDIAN_LIGHT_THEME

    const nodes: GraphNode[] = payload.nodes.filter((node) =>
      (node.type !== 'category' || this.opts.showCategories)
      && (node.type !== 'tag' || this.opts.showTags)
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

    // Keep simulation warm across updates for nodes that persist.
    const previous = this.nodeById
    this.simNodes = nodes.map((ref) => {
      const existing = previous.get(ref.id)
      const node: SimNode = existing ?? { ref, r: 0, x: undefined, y: undefined }
      node.ref = ref
      node.r = nodeRadius(ref)
      return node
    })
    this.nodeById = new Map(this.simNodes.map((node) => [node.ref.id, node]))
    this.simLinks = visibleEdges
      .filter((edge) => this.nodeById.has(edge.source) && this.nodeById.has(edge.target))
      .map((edge) => ({ ref: edge, source: edge.source, target: edge.target }))

    if (!this.viewportInitialized) {
      this.transform = { x: this.width / 2, y: this.height / 2, k: 1 }
      this.viewportInitialized = true
    }

    this.startSimulation()
  }

  private startSimulation(): void {
    this.sim?.stop()
    const hubCharge = (node: SimNode) =>
      node.ref.type === 'category' ? -140 : node.ref.type === 'tag' ? -60 : -30
    this.sim = forceSimulation<SimNode, SimLink>(this.simNodes)
      .force(
        'charge',
        forceManyBody<SimNode>()
          .strength((node) => hubCharge(node) * (1 + Math.min(node.ref.size, 6) * 0.15))
      )
      .force(
        'link',
        forceLink<SimNode, SimLink>(this.simLinks)
          .id((node) => node.ref.id)
          .distance((link) =>
            link.ref.type === 'taxonomy' ? 34 : 46 + Math.min(link.ref.type === 'wikilink' ? 20 : 0, 20)
          )
          .strength((link) => (link.ref.type === 'taxonomy' ? 0.9 : 0.35))
      )
      .force('center', forceCenter(0, 0))
      .force(
        'collide',
        forceCollide<SimNode>((node) => node.r + 3)
      )
      .alpha(0.9)
      .on('tick', () => {
        this.draw()
      })
    this.sim.stop()
    // Warm up a few ticks synchronously so the first paint is not a single blob.
    for (let i = 0; i < 60; i++) {
      this.sim.tick()
    }
    this.draw()
    this.loop()
  }

  setHighlight(keyword: string): void {
    this.highlightKeyword = (keyword ?? '').trim()
    this.draw()
  }

  setSelected(id: string | null): void {
    this.selectedId = id
    this.draw()
  }

  zoomBy(factor: number): void {
    this.setZoom(this.transform.k * factor)
  }

  private setZoom(k: number, cx?: number, cy?: number): void {
    const clamped = Math.min(Math.max(k, 0.05), 8)
    if (cx !== undefined && cy !== undefined) {
      const ratio = clamped / this.transform.k
      this.transform.x = cx - (cx - this.transform.x) * ratio
      this.transform.y = cy - (cy - this.transform.y) * ratio
    }
    this.transform.k = clamped
    this.draw()
    this.opts.onViewportChange?.({ ...this.transform })
  }

  resetViewport(): void {
    this.transform = { x: this.width / 2, y: this.height / 2, k: 1 }
    this.viewportInitialized = true
    this.draw()
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.width = Math.max(rect.width, 10)
    this.height = Math.max(rect.height, 10)
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.transform.x === 0 && this.transform.y === 0 && !this.viewportInitialized) {
      this.transform = { x: this.width / 2, y: this.height / 2, k: this.transform.k }
      this.viewportInitialized = true
    }
    this.draw()
  }

  private loop = (): void => {
    if (this.destroyed) {
      return
    }
    if (this.sim && this.sim.alpha() > (this.sim.alphaMin() ?? 0.001)) {
      this.frame = requestAnimationFrame(this.loop)
    } else {
      this.frame = 0
    }
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.transform.x) / this.transform.k,
      y: (py - this.transform.y) / this.transform.k,
    }
  }

  private hitTest(px: number, py: number): SimNode | null {
    const world = this.toWorld(px, py)
    let best: SimNode | null = null
    let bestDist = Infinity
    for (const node of this.simNodes) {
      if (node.x === undefined || node.y === undefined) {
        continue
      }
      const dx = world.x - node.x
      const dy = world.y - node.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const reach = Math.max(node.r, 4) + 3
      if (dist <= reach && dist < bestDist) {
        best = node
        bestDist = dist
      }
    }
    return best
  }

  private neighborsOf(id: string): Set<string> {
    const neighbors = new Set<string>()
    for (const link of this.simLinks) {
      const source = nodeKey(link.source)
      const target = nodeKey(link.target)
      if (source === id) {
        neighbors.add(target)
      } else if (target === id) {
        neighbors.add(source)
      }
    }
    return neighbors
  }

  private onPointerDown = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const node = this.hitTest(px, py)
    if (node) {
      this.dragging = { kind: 'node', id: node.ref.id, lastX: px, lastY: py }
      node.fx = node.x
      node.fy = node.y
    } else {
      this.dragging = { kind: 'pan', lastX: px, lastY: py }
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    if (!this.dragging) {
      const node = this.hitTest(px, py)
      const id = node?.ref.id ?? null
      if (id !== this.hoverId) {
        this.hoverId = id
        this.canvas.style.cursor = node ? 'pointer' : 'grab'
        this.draw()
      }
      return
    }
    if (this.dragging.kind === 'pan') {
      this.transform.x += px - this.dragging.lastX
      this.transform.y += py - this.dragging.lastY
      this.dragging.lastX = px
      this.dragging.lastY = py
      this.draw()
      return
    }
    const node = this.dragging.id ? this.nodeById.get(this.dragging.id) : null
    if (node) {
      const world = this.toWorld(px, py)
      node.fx = world.x
      node.fy = world.y
      this.sim?.alphaTarget(0.3).restart()
    }
  }

  private onPointerUp = (event: PointerEvent): void => {
    const dragging = this.dragging
    this.dragging = null
    this.sim?.alphaTarget(0)
    this.canvas.releasePointerCapture?.(event.pointerId)
    if (!dragging) {
      return
    }
    if (dragging.kind === 'node') {
      const node = dragging.id ? this.nodeById.get(dragging.id) : null
      if (node) {
        node.fx = undefined
        node.fy = undefined
      }
      if (dragging.id) {
        this.selectedId = dragging.id
        this.opts.onSelect(this.nodeById.get(dragging.id)?.ref ?? null)
        this.draw()
      }
      return
    }
    // Click on background clears selection.
    this.selectedId = null
    this.opts.onSelect(null)
    this.draw()
  }

  private onPointerLeave = (): void => {
    if (!this.dragging && this.hoverId) {
      this.hoverId = null
      this.draw()
    }
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    this.setZoom(
      this.transform.k * Math.exp(-event.deltaY * 0.0015),
      event.clientX - rect.left,
      event.clientY - rect.top
    )
  }

  private draw(): void {
    if (this.destroyed) {
      return
    }
    const { ctx, theme } = this
    ctx.save()
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.translate(this.transform.x, this.transform.y)
    ctx.scale(this.transform.k, this.transform.k)

    const focusId = this.dragging?.kind === 'node' ? this.dragging.id : this.hoverId
    const neighbors = focusId ? this.neighborsOf(focusId) : null

    // Edges first.
    for (const link of this.simLinks) {
      const source = link.source as SimNode
      const target = link.target as SimNode
      if (!hasPos(source) || !hasPos(target)) {
        continue
      }
      const isTaxonomy = link.ref.type === 'taxonomy'
      const dimmed =
        neighbors && focusId
          ? source.ref.id !== focusId
            && target.ref.id !== focusId
            && !(neighbors.has(source.ref.id) && neighbors.has(target.ref.id))
          : false
      ctx.globalAlpha = dimmed
        ? theme.dimmedOpacity
        : isTaxonomy
          ? theme.edgeTaxonomyOpacity
          : theme.edgeOpacity
      ctx.strokeStyle = isTaxonomy ? theme.edgeTaxonomy : theme.edge
      ctx.lineWidth = (isTaxonomy ? 0.5 : 1) / this.transform.k + 0.15
      if (isTaxonomy) {
        ctx.setLineDash([2, 3])
      } else {
        ctx.setLineDash([])
      }
      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)
      ctx.stroke()

      if (this.opts.showArrows && !isTaxonomy) {
        drawArrow(ctx, source, target, theme.edge)
      }
      ctx.setLineDash([])
    }
    ctx.globalAlpha = 1

    // Nodes.
    const keyword = this.highlightKeyword.toLowerCase()
    for (const node of this.simNodes) {
      if (node.x === undefined || node.y === undefined) {
        continue
      }
      const dimmed = neighbors
        ? node.ref.id !== focusId && !neighbors.has(node.ref.id)
        : false
      const color = nodeColor(node.ref, theme)
      const alpha = dimmed ? theme.dimmedOpacity : 1

      // Halo glow.
      ctx.globalAlpha = alpha * theme.nodeHaloOpacity
      const glow = ctx.createRadialGradient(node.x, node.y, node.r * 0.5, node.x, node.y,
        node.r * 3.2)
      glow.addColorStop(0, color)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.r * 3.2, 0, Math.PI * 2)
      ctx.fill()

      // Body.
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      if (node.ref.type === 'category') {
        roundRect(ctx, node.x - node.r, node.y - node.r, node.r * 2, node.r * 2, node.r * 0.4)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Selection / highlight ring.
      const isMatch = keyword && node.ref.title.toLowerCase().includes(keyword)
      if (node.ref.id === this.selectedId || node.ref.id === focusId || isMatch) {
        ctx.strokeStyle = isMatch ? theme.highlightRing : theme.highlightRing
        ctx.globalAlpha = alpha * (isMatch ? 1 : 0.8)
        ctx.lineWidth = 1.5 / this.transform.k + 0.2
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r + 3, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = alpha
      }
    }
    ctx.globalAlpha = 1

    // Labels.
    if (this.opts.showLabels || this.transform.k > 1.6) {
      ctx.font = `${theme.fontSize}px ${theme.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const node of this.simNodes) {
        if (node.x === undefined || node.y === undefined) {
          continue
        }
        const dimmed = neighbors
          ? node.ref.id !== focusId && !neighbors.has(node.ref.id)
          : false
        if (dimmed) {
          continue
        }
        const label = node.ref.title
        const width = ctx.measureText(label).width
        ctx.globalAlpha = 0.9
        ctx.fillStyle = theme.labelHalo
        ctx.fillRect(node.x - width / 2 - 2, node.y + node.r + 2, width + 4,
          theme.fontSize + 3)
        ctx.fillStyle = theme.label
        ctx.fillText(label, node.x, node.y + node.r + 3)
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  destroy(): void {
    this.destroyed = true
    if (this.frame) {
      cancelAnimationFrame(this.frame)
    }
    this.sim?.stop()
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
  }
}

function nodeRadius(node: GraphNode): number {
  switch (node.type) {
    case 'category':
      return 4.5 + Math.min(node.size, 9) * 0.9
    case 'tag':
      return 2.5 + Math.min(node.size, 7) * 0.7
    default:
      return node.broken ? 2.5 : 2.5 + Math.min(node.size, 7) * 0.8
  }
}

function nodeColor(node: GraphNode, theme: ObsidianTheme): string {
  if (node.broken) {
    return theme.brokenColor
  }
  return node.color || theme.node
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  source: SimNode,
  target: SimNode,
  color: string
): void {
  if (!hasPos(source) || !hasPos(target)) {
    return
  }
  const dx = target.x - source.x
  const dy = target.y - source.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < target.r + 6) {
    return
  }
  const ux = dx / len
  const uy = dy / len
  const tipX = target.x - ux * (target.r + 2)
  const tipY = target.y - uy * (target.r + 2)
  const size = 3
  ctx.setLineDash([])
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - ux * size - uy * size * 0.5, tipY - uy * size + ux * size * 0.5)
  ctx.lineTo(tipX - ux * size + uy * size * 0.5, tipY - uy * size - ux * size * 0.5)
  ctx.closePath()
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

export { FALLBACK_PALETTE }
