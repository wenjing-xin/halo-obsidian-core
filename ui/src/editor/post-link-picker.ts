import { searchPostBriefs, type PostBrief } from '../api/obsidian'

/**
 * Open a plain-DOM post picker. TipTap extensions have no Vue container of
 * their own, and a detached Vue app may fail silently inside the console
 * runtime, so this picker is built with vanilla DOM only (UnoCSS utilities
 * come from the plugin's globally loaded stylesheet).
 */
export function openPostLinkPicker(
  onSelect: (post: PostBrief) => void,
  onClose?: () => void
) {
  let disposed = false
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let results: PostBrief[] = []
  let activeIndex = -1

  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'

  const panel = document.createElement('div')
  panel.className =
    'flex w-[440px] max-w-[90vw] flex-col gap-3 rounded-lg bg-white p-4 shadow-xl'
  panel.innerHTML = `
    <h3 class="m-0 text-base font-semibold text-gray-900">插入文章关联</h3>
    <input type="text" placeholder="搜索文章标题，选择要关联的文章…"
      class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#4cc2ba] focus:ring-1 focus:ring-[#4cc2ba]" />
    <ul class="m-0 flex max-h-72 list-none flex-col gap-0 overflow-y-auto rounded-md border border-gray-200 p-0"></ul>
    <div class="picker-empty hidden py-8 text-center text-sm text-gray-400">
      未找到文章，输入关键词搜索
    </div>
    <p class="m-0 text-xs leading-5 text-gray-400">
      将在光标处插入一条指向所选文章的双链；若编辑器中有选中文字，则以选中文字作为链接文本。
    </p>
  `
  const input = panel.querySelector('input') as HTMLInputElement
  const list = panel.querySelector('ul') as HTMLUListElement
  const empty = panel.querySelector('.picker-empty') as HTMLElement

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  input.focus()

  function destroy() {
    if (disposed) {
      return
    }
    disposed = true
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    document.removeEventListener('keydown', onKeydown, true)
    overlay.remove()
  }

  function setActive(index: number) {
    activeIndex = index
    Array.from(list.children).forEach((li, i) => {
      const el = li as HTMLElement
      const active = i === index
      el.classList.toggle('bg-gray-100', active)
      el.classList.toggle('hover:bg-gray-50', !active)
    })
  }

  function renderList() {
    list.innerHTML = ''
    results.forEach((post, index) => {
      const li = document.createElement('li')
      li.className =
        'cursor-pointer truncate border-b border-b-gray-100 px-3 py-2.5 text-[13px] text-gray-800 last:border-b-0'
      li.textContent = post.title
      li.addEventListener('mouseenter', () => setActive(index))
      li.addEventListener('click', () => {
        destroy()
        onSelect(post)
      })
      list.appendChild(li)
    })
    setActive(results.length ? 0 : -1)
    empty.classList.toggle('hidden', results.length > 0)
  }

  async function search() {
    try {
      results = await searchPostBriefs(input.value.trim())
    } catch {
      results = []
    }
    if (!disposed) {
      renderList()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (disposed) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      destroy()
      onClose?.()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) {
        return
      }
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + delta + results.length) % results.length)
      return
    }
    if (event.key === 'Enter') {
      const post = activeIndex >= 0 ? results[activeIndex] : undefined
      if (!post) {
        return
      }
      event.preventDefault()
      destroy()
      onSelect(post)
    }
  }

  input.addEventListener('input', () => {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    searchTimer = setTimeout(search, 300)
  })
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) {
      destroy()
      onClose?.()
    }
  })
  document.addEventListener('keydown', onKeydown, true)

  void search()
}
