import { expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { GraphNode } from '../../shared/graph-renderer/types'

vi.mock('@halo-dev/components', () => ({
  IconClose: defineComponent({ name: 'IconClose', render: () => h('svg') }),
  VCard: defineComponent({
    name: 'VCard',
    props: ['bodyClass'],
    setup:
      (_, { slots }) =>
      () =>
        h('section', [slots.header?.(), slots.default?.(), slots.footer?.()]),
  }),
  VTag: defineComponent({
    name: 'VTag',
    props: ['theme'],
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
  VButton: defineComponent({
    name: 'VButton',
    props: { type: String, size: String, ghost: Boolean },
    emits: ['click'],
    setup:
      (_, { slots, emit }) =>
      () =>
        h('button', { onClick: () => emit('click') }, [slots.icon?.(), slots.default?.()]),
  }),
}))
import NodeDetailPanel from '../NodeDetailPanel.vue'

const node: GraphNode = {
  id: 'post',
  title: '基础语法：从 CPU 角度看变量、数组、类型、运算、跳转、函数等语法',
  type: 'post',
  degree: 3,
  size: 4,
  categories: ['软件开发'],
  tags: ['Java'],
  permalink: '/archives/post',
}
const global = { directives: { tooltip: () => {} } }

it('uses a single-line ellipsis title with the full title available and native Halo controls', async () => {
  const wrapper = mount(NodeDetailPanel, { props: { node }, global })
  const title = wrapper.get('h3')
  expect(title.text()).toBe(node.title)
  expect(title.attributes('title')).toBe(node.title)
  expect(title.classes()).toEqual(expect.arrayContaining(['truncate', 'min-w-0', 'flex-1']))
  expect(title.classes()).not.toContain('break-all')
  expect(wrapper.findAllComponents({ name: 'VTag' })[0]!.text()).toBe('文章')
  const close = wrapper.findAllComponents({ name: 'VButton' })[0]!
  expect(close.props()).toMatchObject({ size: 'xs', type: 'secondary', ghost: true })
  expect(close.findComponent({ name: 'IconClose' }).exists()).toBe(true)
  await wrapper.get('[aria-label="关闭详情"]').trigger('click')
  expect(wrapper.emitted('close')).toHaveLength(1)
  await wrapper.findAll('button')[1]!.trigger('click')
  expect(wrapper.emitted('view-backlinks')?.[0]).toEqual([node])
  await wrapper.findAll('button')[2]!.trigger('click')
  expect(wrapper.emitted('open-post')?.[0]).toEqual([node])
  wrapper.unmount()
})

it.each([
  ['category', '分类'],
  ['tag', '标签'],
] as const)('uses the native %s type tag without article actions', (type, label) => {
  const wrapper = mount(NodeDetailPanel, { props: { node: { ...node, type } }, global })
  expect(wrapper.findComponent({ name: 'VTag' }).text()).toBe(label)
  expect(wrapper.findAll('button')).toHaveLength(1)
  wrapper.unmount()
})

it('shows unresolved state without article actions and hides the panel without a selection', async () => {
  const wrapper = mount(NodeDetailPanel, { props: { node: { ...node, broken: true } }, global })
  expect(wrapper.findComponent({ name: 'VTag' }).props('theme')).toBe('danger')
  expect(wrapper.text()).toContain('该双链未解析')
  expect(wrapper.findAll('button')).toHaveLength(1)
  await wrapper.setProps({ node: null })
  expect(wrapper.find('section').exists()).toBe(false)
  wrapper.unmount()
})
