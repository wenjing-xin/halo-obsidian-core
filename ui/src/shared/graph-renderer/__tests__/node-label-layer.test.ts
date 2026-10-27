import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { NodeDisplayData } from 'sigma/types'
import { NodeLabelLayer } from '../node-label-layer'

let layer: NodeLabelLayer
let container: HTMLElement
let nodes: Map<string, NodeDisplayData>
const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: [...text].length * 11 })),
  fillText: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  fillStyle: '',
}
const host = {
  getDimensions: () => ({ width: 800, height: 400 }),
  getNodeDisplayData: (key: string) => nodes.get(key),
  framedGraphToViewport: vi.fn((data: { x: number; y: number }) => ({
    x: data.x * 800,
    y: data.y * 400,
  })),
  scaleSize: (size = 1) => size,
  scheduleRender: vi.fn(),
}
const fonts = new EventTarget()
const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')
function node(label: string, overrides: Partial<NodeDisplayData> = {}): NodeDisplayData {
  return {
    x: 0.5,
    y: 0.5,
    label,
    size: 4,
    color: '#666',
    labelColor: 'rgba(48, 48, 48, 0.5)',
    opacity: 1,
    visibility: 'visible',
    labelVisibility: 'auto',
    highlighted: false,
    zIndex: 0,
    depth: 'nodes',
    labelDepth: 'nodes',
    ...overrides,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  nodes = new Map()
  container = document.createElement('div')
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
  vi.stubGlobal('devicePixelRatio', 2)
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
  layer = new NodeLabelLayer(host, container, (key) => nodes.get(key)?.label)
})
afterEach(() => {
  layer.destroy()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor)
  else Reflect.deleteProperty(document, 'fonts')
})

it('draws entire mixed-language titles without stripping letters, punctuation or supplementary characters', () => {
  const text = '基础语法：CPU / C++ — A&B「变量」𠮷🙂'
  nodes.set('post', node(text))
  layer.draw(nodes.keys())
  expect(context.fillText).toHaveBeenCalledExactlyOnceWith(text, 400, 208)
  expect(host.framedGraphToViewport).toHaveBeenCalledWith(nodes.get('post'))
  expect(context.fillStyle).toBe('rgba(48, 48, 48, 0.5)')
  expect(context.textAlign).toBe('center')
  const canvas = container.querySelector('canvas')!
  expect([canvas.width, canvas.height]).toEqual([1600, 800])
  expect(canvas.style.pointerEvents).toBe('none')
  expect(canvas.style.left).toBe('0px')
  expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
})

it('handles more distinct CJK glyphs than a single SDF atlas page', () => {
  const text = Array.from({ length: 1000 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('')
  nodes.set('many-glyphs', node(text, { labelVisibility: 'visible' }))
  layer.draw(nodes.keys())
  expect(context.fillText).toHaveBeenCalledWith(text, 400, 208)
})

it('prioritizes focused titles over overlapping automatic labels and retains forced neighbors', () => {
  nodes.set('normal', node('普通标题', { size: 8 }))
  nodes.set('focus', node('悬浮标题', { labelVisibility: 'visible' }))
  nodes.set('neighbor', node('关联标题', { labelVisibility: 'visible' }))
  layer.draw(nodes.keys())
  expect(context.fillText.mock.calls.map(([text]) => text)).toEqual(['悬浮标题', '关联标题'])
})

it('skips hidden, growing, offscreen, tiny and empty labels', () => {
  nodes.set('hidden', node('hidden', { visibility: 'hidden' }))
  nodes.set('growing', node('growing', { labelVisibility: 'hidden' }))
  nodes.set('outside', node('outside', { x: -2 }))
  nodes.set('tiny', node('tiny', { size: 1 }))
  nodes.set('empty', node(''))
  layer.draw(nodes.keys())
  expect(context.fillText).not.toHaveBeenCalled()
})

it('redraws positions, colors and pixel density from current display state', () => {
  nodes.set('post', node('标题'))
  layer.draw(nodes.keys())
  nodes.set('post', node('标题', { x: 0.25, y: 0.25, labelColor: '#fff' }))
  vi.stubGlobal('devicePixelRatio', 1)
  layer.draw(nodes.keys())
  expect(context.fillText).toHaveBeenLastCalledWith('标题', 200, 108)
  expect(context.fillStyle).toBe('#fff')
  expect(container.querySelector('canvas')!.width).toBe(800)
  expect(context.measureText).toHaveBeenCalledTimes(1)
})

it('invalidates cached measurements after font loading and removes observers on destroy', () => {
  nodes.set('post', node('标题'))
  layer.draw(nodes.keys())
  fonts.dispatchEvent(new Event('loadingdone'))
  expect(host.scheduleRender).toHaveBeenCalledTimes(1)
  layer.draw(nodes.keys())
  expect(context.measureText).toHaveBeenCalledTimes(2)
  layer.destroy()
  fonts.dispatchEvent(new Event('loadingdone'))
  expect(host.scheduleRender).toHaveBeenCalledTimes(1)
  expect(container.querySelector('canvas')).toBeNull()
})
