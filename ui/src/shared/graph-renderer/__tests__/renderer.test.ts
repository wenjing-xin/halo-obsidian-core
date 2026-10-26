import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GraphPayload } from '../types'
const state = vi.hoisted(() => ({ sigma: null as any }))
vi.mock('sigma/primitives', () => ({ DEFAULT_PRIMITIVES: { nodes: {} } }))
vi.mock('sigma/types', () => ({ DEFAULT_STYLES: { nodes: {} } }))
vi.mock('sigma', () => ({
  default: class {
    handlers: Record<string, (...args: any[]) => void> = {}
    options: any
    graph: any
    constructor(graph: any, _container: HTMLElement, options: any) {
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
    kill = vi.fn()
  },
}))
vi.mock('graphology-layout-forceatlas2/worker', () => ({
  default: class {
    start = vi.fn()
    stop = vi.fn()
    kill = vi.fn()
    isRunning = () => true
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
  expect(display('focus').labelVisibility).toBe('visible')
  expect(display('neighbor').labelVisibility).toBe('hidden')
  expect(state.sigma.setSettings).toHaveBeenLastCalledWith({ renderLabels: true })
})
