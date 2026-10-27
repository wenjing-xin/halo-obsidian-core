import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GraphPayload } from '../types'
const state = vi.hoisted(() => ({ sigma: null as any, layout: null as any }))
vi.mock('sigma/primitives', () => ({ DEFAULT_PRIMITIVES: { nodes: {} } }))
vi.mock('sigma/types', () => ({ DEFAULT_STYLES: { nodes: {} } }))
vi.mock('sigma', () => ({
  default: class {
    handlers: Record<string, (...args: any[]) => void> = {}
    options: any
    graph: any
    constructor(graph: any, container: HTMLElement, options: any) {
      const canvas = document.createElement('canvas')
      const mouse = document.createElement('div')
      mouse.className = 'sigma-mouse'
      canvas.style.position = mouse.style.position = 'absolute'
      container.append(canvas, mouse)
      this.graph = graph
      this.options = options
      state.sigma = this
    }
    on(name: string, callback: (...args: any[]) => void) {
      this.handlers[name] = callback
    }
    refresh = vi.fn()
    scheduleRefresh = vi.fn()
    setSettings = vi.fn()
    resize = vi.fn()
    kill = vi.fn()
    getCamera = vi.fn(() => ({ reset: vi.fn(), animate: vi.fn(), ratio: 1, x: 0, y: 0 }))
  },
}))
vi.mock('graphology-layout-forceatlas2/worker', () => ({
  default: class {
    settings: any
    running = false
    start = vi.fn(() => (this.running = true))
    stop = vi.fn(() => (this.running = false))
    kill = vi.fn(() => (this.running = false))
    isRunning = () => this.running
    constructor(_graph: any, options: any) {
      this.settings = options.settings
      state.layout = this
    }
  },
}))
import { GraphRenderer } from '../renderer'
let renderer: GraphRenderer
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  renderer = new GraphRenderer(document.createElement('div'))
})
afterEach(() => {
  renderer.destroy()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const payload: GraphPayload = {
  nodes: ['focus', 'neighbor', 'other'].map((id) => ({
    id,
    title: id,
    type: 'post',
    degree: 2,
    size: 2,
    categories: [],
    tags: [],
  })),
  edges: [
    { id: 'forward', source: 'focus', target: 'neighbor', type: 'wikilink' },
    { id: 'back', source: 'neighbor', target: 'focus', type: 'wikilink' },
  ],
  brokenNodes: [],
  brokenEdges: [],
  categoryPalette: [],
  totalPosts: 3,
  truncated: false,
}
function display(id: string) {
  return state.sigma.options.nodeReducer(id, { opacity: 1, color: '#666' })
}
it('disables the native hover card, shadow, padding and label background', () => {
  expect(state.sigma.options.styles.nodes).toMatchObject({
    backdropVisibility: 'hidden',
    backdropColor: 'transparent',
    backdropShadowColor: 'transparent',
    backdropShadowBlur: 0,
    backdropPadding: 0,
    labelBackgroundColor: 'transparent',
    labelBackgroundPadding: 0,
  })
})
it('anchors canvas and picking layers at zero inside centered article content', () => {
  const container = document.createElement('div')
  container.style.textAlign = 'center'
  const centered = new GraphRenderer(container)
  for (const layer of container.querySelectorAll<HTMLElement>('canvas, .sigma-mouse')) {
    expect(layer.style.left).toBe('0px')
    expect(layer.style.top).toBe('0px')
    expect(layer.style.margin).toBe('0px')
    expect(layer.style.display).toBe('block')
  }
  centered.destroy()
})
it('shows plain titles below the purple focus and gray neighbors, fading unrelated titles', () => {
  renderer.setData(payload)
  state.sigma.handlers.enterNode({ node: 'focus' })
  vi.advanceTimersByTime(2000)
  expect(display('focus')).toMatchObject({
    color: '#9164f5',
    labelPosition: 'below',
    labelBackgroundColor: 'transparent',
    labelVisibility: 'visible',
  })
  expect(display('neighbor')).toMatchObject({
    color: '#5c5c5c',
    labelVisibility: 'visible',
    labelColor: 'rgba(48, 48, 48, 1)',
  })
  expect(display('other').opacity).toBeCloseTo(0.18)
  expect(display('other').labelColor).toContain('0.28')
  expect(display('other').labelVisibility).toBe('auto')
  state.sigma.handlers.leaveNode()
  vi.advanceTimersByTime(2000)
  expect(display('focus').color).toBe('#5c5c5c')
  expect(display('other').opacity).toBeUndefined()
})
it('preserves reciprocal links and still shows hovered titles when labels are off', () => {
  renderer.setData(payload)
  expect(state.sigma.graph.size).toBe(2)
  renderer.setOptions({ showLabels: false })
  state.sigma.handlers.enterNode({ node: 'focus' })
  expect(display('focus').labelVisibility).toBe('hidden')
  vi.advanceTimersByTime(2000)
  expect(display('focus').labelVisibility).toBe('visible')
  expect(display('neighbor').labelVisibility).toBe('hidden')
  expect(state.sigma.setSettings).toHaveBeenLastCalledWith({ renderLabels: true })
})

it('reveals nodes one at a time from deterministic disk positions', () => {
  renderer.setData(payload)

  const graph = state.sigma.graph
  const positions = graph
    .nodes()
    .map((id: string) => [graph.getNodeAttribute(id, 'x'), graph.getNodeAttribute(id, 'y')])
  expect(new Set(positions.map((position: number[]) => position.join(','))).size).toBe(3)
  expect((renderer as any).nodeGrowthTarget.get('focus')).toBe(1)
  expect((renderer as any).nodeGrowthTarget.get('neighbor')).toBe(0)
  expect((renderer as any).nodeGrowthTarget.get('other')).toBe(0)
  expect((renderer as any).edgeGrowthTarget.get('forward')).toBe(0)
  expect(display('neighbor')).toMatchObject({ opacity: 0, labelVisibility: 'hidden' })

  vi.advanceTimersByTime(61)
  expect((renderer as any).nodeGrowthTarget.get('neighbor')).toBe(1)
  expect((renderer as any).nodeGrowthTarget.get('other')).toBe(0)
  expect((renderer as any).edgeGrowthTarget.get('forward')).toBe(1)
})

it('replays the reveal without randomizing positions and applies force settings live', () => {
  renderer.setData(payload)
  const graph = state.sigma.graph
  const before = graph
    .nodes()
    .map((id: string) => [graph.getNodeAttribute(id, 'x'), graph.getNodeAttribute(id, 'y')])

  renderer.replay()
  expect(
    graph
      .nodes()
      .map((id: string) => [graph.getNodeAttribute(id, 'x'), graph.getNodeAttribute(id, 'y')]),
  ).toEqual(before)
  expect((renderer as any).nodeGrowthTarget.get('focus')).toBe(1)
  expect((renderer as any).nodeGrowthTarget.get('neighbor')).toBe(0)

  renderer.setOptions({ forces: { center: 0.42, repel: 3.6 } })
  expect(state.layout.settings).toMatchObject({ gravity: 0.42, scalingRatio: 3.6, slowDown: 8 })
  expect(state.sigma.refresh).toHaveBeenCalled()
})

it('restarts the force layout after a dragged node is released', () => {
  renderer.setData(payload)
  const layout = state.layout
  layout.running = false

  state.sigma.handlers.nodeDragStart({ allDraggedNodes: ['focus'] })
  expect(layout.stop).toHaveBeenCalled()
  state.sigma.handlers.nodeDragEnd({ allDraggedNodes: ['focus'] })

  expect(layout.start).toHaveBeenCalledTimes(2)
  expect(layout.settings.slowDown).toBe(5)
  expect(state.sigma.graph.getNodeAttribute('focus', 'fixed')).toBe(true)
  vi.advanceTimersByTime(1800)
  expect(state.sigma.graph.getNodeAttribute('focus', 'fixed')).toBe(false)
})
