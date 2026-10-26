import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
const api = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('../../api/obsidian', () => ({ searchPostBriefs: api.search }))
vi.mock('@halo-dev/components', () => {
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.default?.(), slots.start?.(), slots.end?.()]),
  })
  const entity = defineComponent({
    name: 'VEntity',
    setup:
      (_, { slots }) =>
      () =>
        h('div', { 'data-entity': 'true' }, [slots.start?.(), slots.end?.()]),
  })
  const field = defineComponent({
    props: ['title', 'description'],
    setup: (props) => () => h('div', [props.title, props.description]),
  })
  return {
    IconClose: box,
    IconLink: box,
    VButton: box,
    VEmpty: box,
    VEntity: entity,
    VEntityContainer: box,
    VEntityField: field,
    VLoading: box,
  }
})
import PostLinkPicker from '../PostLinkPicker.vue'
let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
  vi.useRealTimers()
})
it('renders selectable articles with VEntity and passes current-post exclusion', async () => {
  const post = { name: 'target', title: 'Target article', permalink: '/target' }
  api.search.mockResolvedValue([post])
  wrapper = mount(PostLinkPicker, { props: { excludePostName: 'current' } })
  await flushPromises()
  expect(api.search).toHaveBeenCalledWith('', { excludePostName: 'current', publishedOnly: true })
  expect(wrapper.findAll('[data-entity]')).toHaveLength(1)
  expect(wrapper.text()).toContain('Target article')
  await wrapper.get('[role="option"]').trigger('click')
  expect(wrapper.emitted('select')?.[0]).toEqual([post])
})
it('supports Enter selection and Escape cancellation without an overlay', async () => {
  const post = { name: 'target', title: 'Target article', permalink: '/target' }
  api.search.mockResolvedValue([post])
  wrapper = mount(PostLinkPicker)
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'Enter' })
  expect(wrapper.emitted('select')?.[0]).toEqual([post])
  await wrapper.get('input').trigger('keydown', { key: 'Escape' })
  expect(wrapper.emitted('close')).toHaveLength(1)
})
