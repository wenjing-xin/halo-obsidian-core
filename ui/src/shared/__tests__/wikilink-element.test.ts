import { afterEach, expect, it, vi } from 'vitest'
import '../wikilink-element'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
  document.documentElement.removeAttribute('data-color-scheme')
  vi.unstubAllGlobals()
})

it('renders a Markdown tag as a safe link and preserves its display text', () => {
  const link = document.createElement('obsidian-core-link')
  link.setAttribute('post', 'article-a')
  link.setAttribute('url', '/archives/article-a')
  link.setAttribute('title', 'Article A')
  link.textContent = 'Alias'
  document.body.append(link)

  const anchor = link.shadowRoot!.querySelector('a')!
  expect(anchor.getAttribute('href')).toBe('/archives/article-a')
  expect(anchor.getAttribute('target')).toBe('_blank')
  expect(link.shadowRoot!.querySelector('slot')!.assignedNodes()[0]?.textContent).toBe('Alias')
})

it('renders unavailable and unsafe destinations as non-clickable text', () => {
  const link = document.createElement('obsidian-core-link')
  link.setAttribute('post', 'article-a')
  link.setAttribute('url', 'javascript:alert(1)')
  link.textContent = 'Article A'
  document.body.append(link)

  expect(link.shadowRoot!.querySelector('a')!.hasAttribute('href')).toBe(false)
  expect(link.shadowRoot!.querySelector('slot')!.assignedNodes().length).toBe(1)
})

it('matches the hyperlink editor inline card proportions without a colored border', () => {
  const link = document.createElement('obsidian-core-link')
  document.body.append(link)
  const styles = link.shadowRoot!.querySelector('style')!.textContent!
  expect(styles).toContain('font-size: 90%')
  expect(styles).toContain('padding: 2px 6px')
  expect(styles).toContain('width: 16px')
  expect(styles).toContain('border: 0')
  expect(styles).toContain('--halo-hyperlink-card-inline-bg-color')
  expect(link.shadowRoot!.querySelector('.label slot')).not.toBeNull()
})

it('follows comment widget theme conventions live and disconnects cleanly', async () => {
  const media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  const link = document.createElement('obsidian-core-link')
  document.body.append(link)
  const anchor = link.shadowRoot!.querySelector('a')!
  expect(anchor.dataset.colorScheme).toBe('light')
  document.documentElement.setAttribute('data-color-scheme', 'dark')
  await Promise.resolve()
  expect(anchor.dataset.colorScheme).toBe('dark')
  document.documentElement.setAttribute('data-color-scheme', 'light')
  await Promise.resolve()
  expect(anchor.dataset.colorScheme).toBe('light')
  document.documentElement.setAttribute('data-color-scheme', 'auto')
  media.matches = true
  media.dispatchEvent(new Event('change'))
  expect(anchor.dataset.colorScheme).toBe('dark')
  link.setAttribute('theme', 'light')
  expect(anchor.dataset.colorScheme).toBe('light')
  link.removeAttribute('theme')
  expect(anchor.dataset.colorScheme).toBe('dark')
  link.remove()
  media.matches = false
  media.dispatchEvent(new Event('change'))
  expect(anchor.dataset.colorScheme).toBe('dark')
  document.body.append(link)
  expect(anchor.dataset.colorScheme).toBe('light')
})
