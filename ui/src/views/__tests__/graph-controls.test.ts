import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
const calls = vi.hoisted(() => ({
  replay: vi.fn(),
  reindex: vi.fn().mockResolvedValue({ data: true }),
}))
vi.mock('@halo-dev/components', () => {
  const icon = defineComponent({ setup: () => () => h('svg') })
  const button = defineComponent({
    setup:
      (_, { attrs, slots }) =>
      () =>
        h('button', attrs, [slots.icon?.(), slots.default?.()]),
  })
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.header?.(), slots.default?.()]),
  })
  return {
    VButton: button,
    IconRefreshLine: icon,
    VAlert: box,
    VEmpty: box,
    VLoading: box,
    VModal: box,
    VSwitch: box,
  }
})
vi.mock('../../components/ObsidianGraphCanvas.vue', () => ({
  default: defineComponent({
    setup(_, { expose }) {
      expose({ replay: calls.replay })
      return () => h('div')
    },
  }),
}))
vi.mock('../../components/NodeDetailPanel.vue', () => ({ default: { render: () => null } }))
vi.mock('../../components/BacklinksModal.vue', () => ({ default: { render: () => null } }))
vi.mock('../../api/obsidian', () => ({
  fetchConsoleGraph: vi.fn().mockResolvedValue({ data: { nodes: [], edges: [] } }),
  fetchCategoryOptions: vi.fn().mockResolvedValue([]),
  fetchTagOptions: vi.fn().mockResolvedValue([]),
  fetchSummary: vi.fn().mockResolvedValue({ data: { reindexing: false } }),
  reindexAll: calls.reindex,
}))
import GraphView from '../GraphView.vue'
let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})
it('starts collapsed and exposes uniformly sized standalone icon actions', async () => {
  wrapper = mount(GraphView, {
    global: {
      stubs: { FormKit: true },
      directives: { tooltip: (el, binding) => el.setAttribute('data-tooltip', binding.value) },
    },
  })
  await flushPromises()
  expect(wrapper.find('aside').exists()).toBe(false)
  const refresh = wrapper.get('[aria-label="重新索引并刷新图谱"]')
  expect(refresh.element.tagName).toBe('DIV')
  expect(refresh.attributes('role')).toBe('button')
  expect(refresh.classes()).toContain('graph-action-icon')
  expect(wrapper.findAll('.graph-action-icon')).toHaveLength(7)
  expect(wrapper.find('.graph-action-icon button').exists()).toBe(false)
  expect(refresh.attributes('data-tooltip')).toBe('重新索引并刷新图谱')
  const play = wrapper.get('[aria-label="播放关系图谱生成动画"]')
  expect(play.text()).toBe('')
  expect(play.attributes('data-tooltip')).toBe('播放关系图谱生成动画')
  await play.trigger('click')
  expect(calls.replay).toHaveBeenCalled()
  await wrapper.get('[aria-label="图谱设置"]').trigger('click')
  expect(wrapper.find('aside').exists()).toBe(true)
  await wrapper.get('[aria-label="收起面板"]').trigger('click')
  expect(wrapper.find('aside').exists()).toBe(false)
})
