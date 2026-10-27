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
import { ObsidianGraphElement } from '../index'
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
  document.documentElement.removeAttribute('data-color-scheme')
  document.documentElement.removeAttribute('data-theme')
  vi.unstubAllGlobals()
})
it('anchors the rendered Sigma viewport and layers to its host frame', () => {
  const styles = ObsidianGraphElement.styles.toString()
  expect(styles).toContain('position: absolute')
  expect(styles).toContain('inset: 0')
  expect(styles).toContain('.stage > canvas')
  expect(styles).toContain('.stage > .sigma-mouse')
})

it('adds a non-interactive light frame border that tracks live theme changes', async () => {
  const el = await mount()
  await el.updateComplete
  const frame = el.shadowRoot!.querySelector('.frame')!
  expect(frame.getAttribute('style')).toContain('--graph-frame-border:#e2e8f0')
  const styles = ObsidianGraphElement.styles.toString()
  expect(styles).toContain('.frame::after')
  expect(styles).toContain(
    'border: 1px solid var(--obsidian-graph-border, var(--graph-frame-border))',
  )
  expect(styles).toContain('pointer-events: none')
  const requests = fetchMock.mock.calls.length
  document.body.className = 'dark'
  await vi.waitFor(() =>
    expect(frame.getAttribute('style')).toContain('--graph-frame-border:transparent'),
  )
  document.body.className = 'light'
  await vi.waitFor(() =>
    expect(frame.getAttribute('style')).toContain('--graph-frame-border:#e2e8f0'),
  )
  expect(fetchMock).toHaveBeenCalledTimes(requests)
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

it('follows live comment widget attributes and system preferences without graph reloads', async () => {
  const media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  const el = await mount()
  const count = fetchMock.mock.calls.length
  for (const scheme of ['dark', 'light', 'dark', 'light']) {
    document.documentElement.setAttribute('data-color-scheme', scheme)
    await vi.waitFor(() =>
      expect(renderers[0].setOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ dark: scheme === 'dark' }),
      ),
    )
    await el.updateComplete
    expect(el.shadowRoot?.querySelector('.frame')?.getAttribute('style')).toContain(
      `--graph-bg:${scheme === 'dark' ? '#1e1e1e' : '#ffffff'}`,
    )
  }
  document.documentElement.setAttribute('data-color-scheme', 'auto')
  media.matches = true
  media.dispatchEvent(new Event('change'))
  await el.updateComplete
  expect(renderers[0].setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ dark: true }))
  el.setAttribute('theme', 'light')
  await el.updateComplete
  expect(renderers[0].setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ dark: false }))
  expect(fetchMock).toHaveBeenCalledTimes(count)
})

it('lets visitors switch a fixed dark embed back to automatic theme following', async () => {
  const el = await mount({ theme: 'dark' })
  el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="图谱设置"]')!.click()
  await el.updateComplete
  expect(el.shadowRoot?.textContent).toContain('当前图谱固定为暗黑')
  const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[aria-label="图谱主题模式"]')!
  expect(select.value).toBe('dark')
  const count = fetchMock.mock.calls.length
  select.value = 'auto'
  select.dispatchEvent(new Event('change'))
  await el.updateComplete
  expect(renderers[0].setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ dark: false }))
  document.body.className = 'dark'
  await vi.waitFor(() =>
    expect(renderers[0].setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ dark: true }),
    ),
  )
  document.body.className = 'light'
  await vi.waitFor(() =>
    expect(renderers[0].setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ dark: false }),
    ),
  )
  expect(fetchMock).toHaveBeenCalledTimes(count)
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

it('uses uniform SVG toolbar icons with tooltips and collapsed settings', async () => {
  const el = await mount()
  await el.updateComplete
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.controls button')]
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    '刷新图谱',
    '图谱设置',
    '播放关系图谱生成动画',
    '放大',
    '缩小',
    '重置视图',
  ])
  for (const button of buttons) {
    expect(button.type).toBe('button')
    expect(button.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(button.textContent?.trim()).toBe('')
    expect(button.parentElement?.querySelector('[role="tooltip"]')?.textContent).toBe(
      button.getAttribute('aria-label'),
    )
  }
  expect(el.shadowRoot?.querySelector('.settings')).toBeNull()
  expect(ObsidianGraphElement.styles.toString()).toContain('width: 36px')
  expect(ObsidianGraphElement.styles.toString()).toContain('width: 20px')

  buttons[2]!.click()
  buttons[3]!.click()
  buttons[4]!.click()
  buttons[5]!.click()
  expect(renderers[0].replay).toHaveBeenCalledOnce()
  expect(renderers[0].zoomBy.mock.calls).toEqual([[1.25], [0.8]])
  expect(renderers[0].resetViewport).toHaveBeenCalledOnce()
})

it('shows compact settings on demand and closes them with Escape', async () => {
  const el = await mount()
  await el.updateComplete
  const settings = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="图谱设置"]')!
  settings.click()
  await el.updateComplete
  expect(settings.getAttribute('aria-expanded')).toBe('true')
  expect(el.shadowRoot?.querySelector('.settings h3')?.textContent).toBe('显示设置')
  expect(el.shadowRoot?.querySelectorAll('.settings button')).toHaveLength(0)

  const checkbox = el.shadowRoot!.querySelector<HTMLInputElement>(
    '.settings input[type="checkbox"]',
  )!
  checkbox.checked = false
  checkbox.dispatchEvent(new Event('change'))
  await el.updateComplete
  expect(renderers[0].setOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ showLabels: false }),
  )
  checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await el.updateComplete
  expect(el.shadowRoot?.querySelector('.settings')).toBeNull()
  expect(settings.getAttribute('aria-expanded')).toBe('false')
  expect(el.shadowRoot?.activeElement).toBe(settings)
})

it('refreshes public graph data without exposing an indexing action', async () => {
  const el = await mount()
  await el.updateComplete
  const count = fetchMock.mock.calls.length
  const refresh = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="刷新图谱"]')!
  refresh.click()
  await el.updateComplete
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count + 1))
  expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ credentials: 'omit' })
  expect(fetchMock.mock.calls.at(-1)?.[0]).toContain(
    '/apis/api.obsidian-core.halo.run/v1alpha1/graph',
  )
  expect(el.shadowRoot?.textContent).not.toContain('重新索引')
})

it('adapts toolbar colors in dark mode and permits retry after failure', async () => {
  const el = await mount({ theme: 'dark' })
  await el.updateComplete
  expect(el.shadowRoot?.querySelector('.frame')?.getAttribute('style')).toContain(
    '--graph-tool-color:#d1d5db',
  )
  fetchMock.mockResolvedValueOnce({ status: 403, ok: false })
  el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="刷新图谱"]')!.click()
  await vi.waitFor(() => expect(el.shadowRoot?.textContent).toContain('开放主题端图谱'))
  expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="放大"]')!.disabled).toBe(
    true,
  )
  const refresh = el.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="刷新图谱"]')!
  expect(refresh.disabled).toBe(false)
  refresh.click()
  await vi.waitFor(() => expect(renderers.length).toBe(2))
})
