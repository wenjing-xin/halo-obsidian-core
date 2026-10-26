import { createApp } from 'vue'
import type { PostBrief } from '../api/obsidian'
import PostLinkPicker from './PostLinkPicker.vue'
import { pickerPosition, type InsertionAnchor } from './picker-position'

interface PickerOptions {
  anchor: () => InsertionAnchor
  excludePostName?: string
  onSelect: (post: PostBrief) => void
  onClose: () => void
}
let closeActive: (() => void) | undefined

export function openPostLinkPicker(options: PickerOptions): () => void {
  closeActive?.()
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;z-index:9999;width:min(440px,calc(100vw - 24px));'
  document.body.append(host)
  let disposed = false
  const app = createApp(PostLinkPicker, {
    excludePostName: options.excludePostName,
    onSelect(post: PostBrief) { destroy(); options.onSelect(post) },
    onClose: close,
    onResize: position,
  })
  function position() {
    if (disposed) return
    const placement = pickerPosition(options.anchor(), host.offsetWidth, host.scrollHeight || 360,
      window.innerWidth, window.innerHeight)
    host.style.left = `${placement.left}px`
    host.style.top = `${placement.top}px`
    host.style.maxHeight = `${placement.maxHeight}px`
  }
  function destroy() {
    if (disposed) return
    disposed = true
    document.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('scroll', reposition, true)
    window.removeEventListener('resize', position)
    observer.disconnect()
    app.unmount()
    host.remove()
    if (closeActive === close) closeActive = undefined
  }
  function close() { destroy(); options.onClose() }
  function outside(event: PointerEvent) {
    if (!host.contains(event.target as globalThis.Node)) close()
  }
  function reposition(event: Event) {
    if (event.target instanceof Element && host.contains(event.target)) return
    position()
  }
  const observer = new ResizeObserver(position)
  app.mount(host)
  observer.observe(host)
  position()
  document.addEventListener('pointerdown', outside, true)
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', position)
  closeActive = close
  return destroy
}
