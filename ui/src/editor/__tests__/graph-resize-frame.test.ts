import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
vi.mock('@halo-dev/components', () => ({
  VButton: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('button', slots.default?.()),
  }),
}))
import GraphResizeFrame from '../GraphResizeFrame.vue'
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      width: this.classList.contains('graph-embed-frame') ? 600 : 800,
      height: 420,
      left: 0,
      right: 800,
      top: 0,
      bottom: 420,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect
  })
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}
it('keeps resize controls visible without requiring node selection', () => {
  wrapper = mount(GraphResizeFrame, { props: { width: 75, height: 420, selected: false } })
  expect(wrapper.findAll('[data-graph-resize-ui]').length).toBe(4)
  expect(wrapper.get('[aria-label="图谱宽度百分比"]').element).toHaveProperty('value', '75')
  expect(wrapper.get('.graph-embed-viewport').attributes('style')).toContain('min-height: 300px')
})
it('drags the corner and only persists once on pointer release', async () => {
  wrapper = mount(GraphResizeFrame, { props: { width: 75, height: 420, align: 'left' } })
  wrapper
    .get('[aria-label="拖动调整图谱宽高"]')
    .element.dispatchEvent(pointer('pointerdown', 600, 420))
  window.dispatchEvent(pointer('pointermove', 400, 100))
  await wrapper.vm.$nextTick()
  expect(wrapper.emitted('resize')).toBeUndefined()
  expect(wrapper.get('.graph-embed-viewport').attributes('style')).toContain('height: 300px')
  window.dispatchEvent(pointer('pointerup', 400, 100))
  expect(wrapper.emitted('resize')?.[0]).toEqual([{ width: 50, height: 300 }])
})
it('cancels resizing without mutating the saved node', async () => {
  wrapper = mount(GraphResizeFrame)
  wrapper
    .get('[aria-label="拖动调整图谱高度"]')
    .element.dispatchEvent(pointer('pointerdown', 400, 420))
  window.dispatchEvent(pointer('pointermove', 400, 600))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(wrapper.emitted('resize')).toBeUndefined()
  window.dispatchEvent(pointer('pointerup', 400, 600))
  expect(wrapper.emitted('resize')).toBeUndefined()
})
it('clamps number inputs and resets to a full-width 420px frame', async () => {
  wrapper = mount(GraphResizeFrame, { props: { width: 75, height: 420 } })
  await wrapper.get('[aria-label="图谱高度像素"]').setValue('10')
  expect(wrapper.emitted('resize')?.slice(-1)[0]).toEqual([{ width: 75, height: 300 }])
  await wrapper.get('[aria-label="图谱宽度百分比"]').setValue('5')
  expect(wrapper.emitted('resize')?.slice(-1)[0]).toEqual([{ width: 40, height: 420 }])
  await wrapper
    .findAll('button')
    .find((b) => b.text() === '重置尺寸')
    ?.trigger('click')
  expect(wrapper.emitted('resize')?.slice(-1)[0]).toEqual([{ width: 100, height: 420 }])
})
