import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const api = vi.hoisted(() => ({ preview: vi.fn(), update: vi.fn() }))
vi.mock('../../api/obsidian', () => ({ fetchConsoleGraphPreview: api.preview }))
vi.mock('@halo-dev/components', () => ({ VButton: { template: '<button><slot /></button>' } }))
vi.mock('@halo-dev/richtext-editor', () => ({
  nodeViewProps: ['node', 'editor', 'selected', 'updateAttributes', 'deleteNode'],
  NodeViewWrapper: { template: '<div><slot /></div>' },
}))
vi.mock('../GraphInsertModal.vue', () => ({
  default: { props: ['visible'], template: '<div v-if="visible" data-config-modal />' },
}))
vi.mock('../GraphResizeFrame.vue', () => ({
  default: { template: '<section><slot name="actions" /><slot /></section>' },
}))
vi.mock('../../components/ObsidianGraphCanvas.vue', () => ({
  default: defineComponent({
    props: ['payload'],
    setup: (props) => () =>
      h(
        'div',
        { 'data-graph-preview': true },
        props.payload.nodes.map((node: { title: string }) => node.title).join(', '),
      ),
  }),
}))
import GraphNodeView from '../GraphNodeView.vue'

let wrapper: ReturnType<typeof mount> | undefined
const payload = {
  nodes: [{ id: 'current', title: 'Current article' }],
  edges: [],
  brokenNodes: [],
  brokenEdges: [],
}

beforeEach(() => {
  window.history.replaceState(null, '', '/console/posts/editor?name=current')
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }))
  api.preview.mockResolvedValue({ data: payload })
})
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function mountGraph(attrs: Record<string, unknown>) {
  wrapper = mount(GraphNodeView, {
    props: {
      node: { attrs } as any,
      editor: { isEditable: true, on: vi.fn(), off: vi.fn() } as any,
      updateAttributes: api.update,
      deleteNode: vi.fn(),
    } as any,
  })
  return wrapper
}

it('immediately renders global nodes without opening the configuration modal', async () => {
  const view = mountGraph({ mode: 'full' })
  await flushPromises()
  expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({ mode: 'full' }))
  expect(view.get('[data-graph-preview]').text()).toBe('Current article')
  expect(view.find('[data-config-modal]').exists()).toBe(false)
})

it('resolves implicit current-article scope for preview without persisting the identity', async () => {
  const view = mountGraph({ mode: 'local', post: '', depth: 2 })
  await flushPromises()
  expect(api.preview).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'local', post: 'current', depth: 2 }),
  )
  expect(view.find('[data-graph-preview]').exists()).toBe(true)
  expect(api.update).not.toHaveBeenCalled()
})

it('does not query a global graph when an unsaved local graph has no article context', async () => {
  window.history.replaceState(null, '', '/console/posts/editor')
  const view = mountGraph({ mode: 'local', post: '' })
  await flushPromises()
  expect(api.preview).not.toHaveBeenCalled()
  expect(view.text()).toContain('请先保存当前文章')
})

it('keeps explicit centers and selected article scopes', async () => {
  const view = mountGraph({ mode: 'local', post: 'chosen' })
  await flushPromises()
  expect(api.preview).toHaveBeenLastCalledWith(expect.objectContaining({ post: 'chosen' }))
  await view.setProps({ node: { attrs: { mode: 'nodes', nodes: 'a, b' } } as any })
  await flushPromises()
  expect(api.preview).toHaveBeenLastCalledWith(
    expect.objectContaining({ mode: 'nodes', nodes: ['a', 'b'] }),
  )
})
