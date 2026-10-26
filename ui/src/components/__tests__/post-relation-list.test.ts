import { expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
const calls = vi.hoisted(() => ({ push: vi.fn(), copy: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: calls.push }) }))
vi.mock('../../shared/copy-wikilink', () => ({ copyWikiLinkTag: calls.copy }))
vi.mock('@halo-dev/components', () => {
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.default?.(), slots.start?.(), slots.end?.(), slots.dropdownItems?.()]),
  })
  const field = defineComponent({
    name: 'VEntityField',
    props: ['title', 'route', 'description'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.title, slots.title?.(), slots.description?.(), slots.extra?.()]),
  })
  const button = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  })
  return {
    VEntity: box,
    VEntityContainer: box,
    VEntityField: field,
    VDropdownItem: button,
    VLoading: box,
    VEmpty: box,
    VStatusDot: box,
    IconExternalLinkLine: box,
    Toast: { success: vi.fn(), error: vi.fn() },
  }
})
import PostRelationList from '../PostRelationList.vue'
it('uses native title routing and dropdowns for relation rows', async () => {
  const wrapper = mount(PostRelationList, {
    props: {
      items: [
        {
          key: '1',
          name: 'source',
          title: 'Source',
          status: 'broken',
          targetTitle: 'Missing',
          snippet: 'Surrounding content',
        },
      ],
    },
    global: { directives: { tooltip: () => {} } },
  })
  expect(wrapper.text()).toContain('未解析目标：Missing')
  expect(wrapper.findComponent({ name: 'VEntityField' }).props('route')).toEqual({
    name: 'PostEditor',
    query: { name: 'source' },
  })
  await wrapper
    .findAll('button')
    .find((b) => b.text() === '编辑来源文章')!
    .trigger('click')
  expect(calls.push).toHaveBeenCalledWith({ name: 'PostEditor', query: { name: 'source' } })
  await wrapper
    .findAll('button')
    .find((b) => b.text() === '复制来源文章双链标签')!
    .trigger('click')
  expect(calls.copy).toHaveBeenCalledWith({ name: 'source', title: 'Source', permalink: undefined })
  wrapper.unmount()
})
