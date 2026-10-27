import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeTheme, observeGraphTheme, readGraphTheme, resolveDark } from '../theme-controller'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
  document.documentElement.removeAttribute('data-color-scheme')
  vi.unstubAllGlobals()
})
function host() {
  const host = document.createElement('div')
  document.body.append(host)
  return host
}

describe('graph theme', () => {
  it('defaults to auto while preserving legacy booleans', () => {
    expect(normalizeTheme()).toBe('auto')
    expect(normalizeTheme(null, false)).toBe('light')
    expect(normalizeTheme(null, 'true')).toBe('dark')
    expect(normalizeTheme('auto', true)).toBe('auto')
  })
  it('respects explicit mode before theme ancestors and system', () => {
    const el = host()
    document.body.className = 'dark'
    expect(resolveDark(el, 'light', true)).toBe(false)
    expect(resolveDark(el, 'auto', false)).toBe(true)
    document.body.className = 'light'
    expect(resolveDark(el, 'auto', true)).toBe(false)
  })
  it('uses nearest ancestor and comment widget conventions', () => {
    const el = host()
    document.documentElement.setAttribute('data-color-scheme', 'dark')
    document.body.className = 'color-scheme-light'
    expect(resolveDark(el, 'auto', true)).toBe(false)
    document.body.className = 'color-scheme-auto'
    expect(resolveDark(el, 'auto', false)).toBe(false)
  })
  it('prioritizes a changed explicit attribute over a stale dark class', () => {
    const el = host()
    document.body.className = 'dark'
    document.body.dataset.colorScheme = 'light'
    expect(resolveDark(el, 'auto', true)).toBe(false)
    document.body.dataset.colorScheme = 'dark'
    expect(resolveDark(el, 'auto', false)).toBe(true)
    delete document.body.dataset.colorScheme
  })
  it('resolves theme ancestors across shadow roots', () => {
    const wrapper = host()
    wrapper.dataset.colorScheme = 'dark'
    const el = document.createElement('span')
    wrapper.attachShadow({ mode: 'open' }).append(el)
    expect(resolveDark(el, 'auto', false)).toBe(true)
    wrapper.dataset.colorScheme = 'light'
    expect(resolveDark(el, 'auto', true)).toBe(false)
  })
  it('supports computed color-scheme and CSS variables', () => {
    const el = host()
    el.style.colorScheme = 'dark'
    el.style.setProperty('--obsidian-graph-bg', '#123456')
    expect(resolveDark(el, 'auto', false)).toBe(true)
    expect(readGraphTheme(el, true).background).toBe('#123456')
  })
  it('observes live changes and cleans up', async () => {
    const media = new EventTarget()
    vi.stubGlobal('matchMedia', () => media)
    const onChange = vi.fn()
    const stop = observeGraphTheme(host(), onChange)
    document.body.className = 'dark'
    await Promise.resolve()
    expect(onChange).toHaveBeenCalledTimes(2)
    media.dispatchEvent(new Event('change'))
    expect(onChange).toHaveBeenCalledTimes(3)
    stop()
    document.body.className = 'light'
    await Promise.resolve()
    media.dispatchEvent(new Event('change'))
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})
