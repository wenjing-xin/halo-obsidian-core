import { expect, it } from 'vitest'
import { createWikiLinkTag, safePostPermalink } from '../wikilink-tag'
it('copies the new tag with stable post identity, URL, title and display text', () => {
  const html = createWikiLinkTag({
    name: 'post-1',
    title: 'Article',
    permalink: '/archives/article',
  })
  expect(html).toBe(
    '<obsidian-core-link post="post-1" url="/archives/article" title="Article" target="_blank">Article</obsidian-core-link>',
  )
  expect(html).not.toContain('data-obsidian-post')
})
it('escapes all text and attributes, including Markdown punctuation', () => {
  const html = createWikiLinkTag({
    name: 'p"<&',
    title: 'A <B> & "C" [link] *bold*',
    permalink: '/a?x="&y=1',
  })
  const container = document.createElement('div')
  container.innerHTML = html
  const tag = container.querySelector('obsidian-core-link')!
  expect(container.children).toHaveLength(1)
  expect(tag.getAttribute('post')).toBe('p"<&')
  expect(tag.getAttribute('url')).toBe('/a?x="&y=1')
  expect(tag.textContent).toBe('A <B> & "C" [link] *bold*')
  expect(tag.children).toHaveLength(0)
  expect(html).toContain('&#91;link&#93;')
})
it('omits unsafe URLs and supports copying unpublished posts without a URL', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,payload',
    '//evil.test',
    '/\\evil.test',
    'https://a.test/\\evil',
  ]) {
    expect(safePostPermalink(href)).toBeUndefined()
    expect(createWikiLinkTag({ name: 'p', title: 'T', permalink: href })).not.toContain(' url=')
  }
  expect(createWikiLinkTag({ name: 'draft', title: 'Draft' })).toContain('post="draft"')
})
