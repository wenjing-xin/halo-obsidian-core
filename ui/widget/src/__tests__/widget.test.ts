import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const renderers = vi.hoisted(() => [] as any[])
vi.mock('../../../src/shared/graph-renderer/renderer', () => ({
  GraphRenderer: class {
    constructor() {
      renderers.push(this)
    }
    setData = vi.fn()
    setOptions = vi.fn()
    setHighlight = vi.fn()
    destroy = vi.fn()
    zoomBy = vi.fn()
    resetViewport = vi.fn()
    replay = vi.fn()
  },
}))
import '../index'
import type { ObsidianGraphElement } from '../index'
const payload = {
  nodes: [{ id: 'a' }],
  edges: [],
  brokenNodes: [],
  brokenEdges: [],
  totalPosts: 1,
  truncated: false,
}
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  const media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload })
  vi.stubGlobal('fetch', fetchMock)
  renderers.length = 0
})
afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
  vi.unstubAllGlobals()
})
async function mount(attrs: Record<string, string> = {}) {
  const el = document.createElement('obsidian-graph') as ObsidianGraphElement
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
  document.body.append(el)
  await el.updateComplete
  await vi.waitFor(() => expect(renderers.length).toBeGreaterThan(0))
  return el
}
it('loads current-article scope and changes theme without refetching', async () => {
  const el = await mount({ mode: 'local', 'data-current-post': 'a' })
  expect(fetchMock.mock.calls[0]?.[0]).toContain('mode=local&post=a')
  const count = fetchMock.mock.calls.length
  document.body.className = 'dark'
  await vi.waitFor(() =>
    expect(renderers[0].setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ dark: true }),
    ),
  )
  expect(fetchMock).toHaveBeenCalledTimes(count)
  el.remove()
  expect(renderers[0].destroy).toHaveBeenCalledOnce()
})
it('never falls back to a global request for missing local context', async () => {
  const el = document.createElement('obsidian-graph') as ObsidianGraphElement
  el.setAttribute('mode', 'local')
  document.body.append(el)
  await el.updateComplete
  await vi.waitFor(() => expect(el.shadowRoot?.textContent).toContain('局部图谱需要中心文章'))
  expect(fetchMock).not.toHaveBeenCalled()
})
it('honors legacy theme and data attributes', async () => {
  document.body.className = 'dark'
  await mount({ 'data-mode': 'nodes', 'data-nodes': 'a,b', dark: 'false' })
  expect(fetchMock.mock.calls[0]?.[0]).toContain('mode=nodes')
  expect(renderers[0].setData).toHaveBeenCalledWith(
    payload,
    expect.objectContaining({ dark: false }),
  )
})
it('keeps theme failure overlays readable in light mode', async () => {
  fetchMock.mockResolvedValue({ status: 403, ok: false })
  const el = document.createElement('obsidian-graph') as ObsidianGraphElement
  document.body.append(el)
  await el.updateComplete
  await vi.waitFor(() => expect(el.shadowRoot?.textContent).toContain('未开放匿名访问'))
  expect(el.shadowRoot?.querySelector('.frame')?.getAttribute('style')).toContain(
    '--graph-bg:#ffffff',
  )
})
it('restores safe published embed dimensions and updates them without reloading', async () => {
  const el = await mount({ width: '10', height: '20' })
  expect(el.style.width).toBe('20%')
  expect(el.style.minWidth).toBe('min(320px, 100%)')
  expect(el.style.minHeight).toBe('300px')
  expect(el.style.height).toBe('300px')
  const calls = fetchMock.mock.calls.length
  el.setAttribute('height', '560')
  el.setAttribute('width', '80')
  el.setAttribute('align', 'right')
  await el.updateComplete
  expect(el.style.height).toBe('560px')
  expect(el.style.width).toBe('80%')
  expect(el.style.marginRight).toBe('0px')
  expect(fetchMock).toHaveBeenCalledTimes(calls)
})
