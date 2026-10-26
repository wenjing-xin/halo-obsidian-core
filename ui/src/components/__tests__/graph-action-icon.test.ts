import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GraphActionIcon from '../GraphActionIcon.vue'
it('provides standalone icon actions with keyboard and disabled behavior', async () => {
  const wrapper = mount(GraphActionIcon, {
    props: { label: 'Refresh' },
    slots: { default: '<svg />' },
    global: { directives: { tooltip: () => {} } },
  })
  expect(wrapper.element.tagName).toBe('DIV')
  expect(wrapper.find('button').exists()).toBe(false)
  await wrapper.trigger('keydown', { key: 'Enter' })
  await wrapper.trigger('keydown', { key: ' ' })
  expect(wrapper.emitted('activate')).toHaveLength(2)
  await wrapper.setProps({ disabled: true })
  await wrapper.trigger('click')
  await wrapper.trigger('keydown', { key: 'Enter' })
  expect(wrapper.emitted('activate')).toHaveLength(2)
  expect(wrapper.attributes('tabindex')).toBe('-1')
  wrapper.unmount()
})
