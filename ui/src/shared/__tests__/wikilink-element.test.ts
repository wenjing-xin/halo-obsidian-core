import { afterEach, expect, it } from 'vitest'
import '../wikilink-element'

afterEach(() => {
  document.body.innerHTML = ''
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
