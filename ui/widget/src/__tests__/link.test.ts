import { afterEach, expect, it } from 'vitest'
import '../link'
import type { ObsidianCoreLinkElement } from '../link'

afterEach(() => {
  document.body.innerHTML = ''
})

async function mount(attributes: Record<string, string>, text = '') {
  const element = document.createElement('obsidian-core-link') as ObsidianCoreLinkElement
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  element.textContent = text
  document.body.append(element)
  return element
}

it('hydrates a plain Markdown tag without loading graph data', async () => {
  const element = await mount({ post: 'p1', url: '/articles/a', title: 'Article' }, 'Alias')
  const anchor = element.shadowRoot!.querySelector('a')!
  expect(anchor.getAttribute('href')).toBe('/articles/a')
  expect(anchor.getAttribute('target')).toBe('_blank')
  expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
  expect(element.textContent).toBe('Alias')
})

it('uses the title fallback and reacts to safe attribute updates', async () => {
  const element = await mount({ url: '/a', title: 'Article', target: '_self' })
  expect(element.shadowRoot!.querySelector('slot')!.textContent).toBe('Article')
  expect(element.shadowRoot!.querySelector('a')!.target).toBe('_self')
  element.setAttribute('url', '/b')
  expect(element.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe('/b')
})

it.each(['javascript:alert(1)', '//evil.test', 'data:text/html,evil', '/\\evil.test'])(
  'does not navigate to unsafe URL %s',
  async (url) => {
    const element = await mount({ url, title: '<img src=x onerror=alert(1)>' })
    expect(element.shadowRoot!.querySelector('a')!.hasAttribute('href')).toBe(false)
    expect(element.shadowRoot!.querySelector('img')).toBeNull()
    expect(element.shadowRoot!.querySelector('[aria-disabled="true"]')).not.toBeNull()
  },
)
