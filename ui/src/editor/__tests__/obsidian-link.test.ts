import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@halo-dev/richtext-editor', async () => {
  const { createRequire } = await import('node:module')
  const { realpathSync } = await import('node:fs')
  const require = createRequire(realpathSync('node_modules/@halo-dev/richtext-editor/package.json'))
  const core = await import(require.resolve('@tiptap/core'))
  const state = await import(require.resolve('@tiptap/pm/state'))
  return { ...core, Plugin: state.Plugin, ToolboxItem: {} }
})
vi.mock('@halo-dev/components', () => ({ IconLink: {} }))
vi.mock('../post-link-picker', () => ({ openPostLinkPicker: vi.fn() }))
import { Editor, Node } from '@halo-dev/richtext-editor'
import { ObsidianLink } from '../obsidian-link'
const doc = Node.create({ name: 'doc', topNode: true, content: 'block+' })
const paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
})
const text = Node.create({ name: 'text', group: 'inline' })
let editor: Editor | undefined
function create(content: string) {
  editor = new Editor({ extensions: [doc, paragraph, text, ObsidianLink], content })
  return editor
}
afterEach(() => {
  editor?.destroy()
  vi.restoreAllMocks()
})
it('round-trips the new tag preserving identity, URL, title and alias', () => {
  const initial =
    '<p>See <obsidian-core-link post="p1" url="/archives/post" title="Article" target="_self">Display alias</obsidian-core-link>.</p>'
  const first = create(initial)
  const json = first.getJSON().content?.[0]?.content?.[1]
  expect(json?.type).toBe('obsidianLink')
  expect(json && 'attrs' in json ? json.attrs : undefined).toMatchObject({
    postName: 'p1',
    permalink: '/archives/post',
    title: 'Article',
    target: '_self',
  })
  const saved = first.getHTML()
  expect(saved).toContain('<obsidian-core-link')
  expect(saved).not.toContain('<a ')
  expect(saved).toContain('Display alias</obsidian-core-link>')
  first.destroy()
  expect(create(saved).getJSON().content?.[0]?.content?.[1]).toEqual(json)
})
it('omits unsafe URLs on import and preserves ordinary text', () => {
  const saved = create(
    '<p>before <obsidian-core-link post="p1" url="javascript:alert(1)">Alias</obsidian-core-link> after</p>',
  ).getHTML()
  expect(saved).not.toContain('javascript:')
  expect(saved).toContain('before ')
  expect(saved).toContain(' after')
})
it('clicking the serialized editor node navigates to its safe URL', () => {
  const instance = create(
    '<p><obsidian-core-link post="p1" url="https://example.com/post">Article</obsidian-core-link></p>',
  )
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const tag = instance.view.dom.querySelector('obsidian-core-link')!
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: tag })
  const handled = instance.view.someProp('handleClick', (handler) =>
    handler(instance.view, 1, event),
  )
  expect(handled).toBe(true)
  expect(open).toHaveBeenCalledWith('https://example.com/post', '_blank', 'noopener,noreferrer')
})
