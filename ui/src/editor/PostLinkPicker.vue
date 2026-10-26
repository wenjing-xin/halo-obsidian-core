<script setup lang="ts">
import { IconClose, IconLink, VButton, VEmpty, VEntity, VEntityContainer, VEntityField, VLoading } from '@halo-dev/components'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { searchPostBriefs, type PostBrief } from '../api/obsidian'

const props = defineProps<{ excludePostName?: string }>()
const emit = defineEmits<{ select: [post: PostBrief]; close: []; resize: [] }>()
const keyword = ref('')
const results = ref<PostBrief[]>([])
const searching = ref(false)
const error = ref('')
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined

async function search() {
  const current = ++generation
  searching.value = true
  error.value = ''
  try {
    const posts = await searchPostBriefs(keyword.value, { excludePostName: props.excludePostName, publishedOnly: true })
    if (current !== generation) return
    results.value = posts
    active.value = 0
  } catch {
    if (current === generation) error.value = '文章搜索失败，请重试'
  } finally {
    if (current === generation) {
      searching.value = false
      await nextTick()
      emit('resize')
    }
  }
}

watch(keyword, () => {
  generation++
  searching.value = true
  results.value = []
  clearTimeout(timer)
  timer = setTimeout(search, 250)
})

async function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); emit('close'); return }
  if (event.key === 'Tab') { emit('close'); return }
  if (searching.value || !results.value.length) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length
    await nextTick()
    list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const post = results.value[active.value]
    if (post) emit('select', post)
  }
}

onMounted(() => { input.value?.focus({ preventScroll: true }); void search() })
onBeforeUnmount(() => { generation++; clearTimeout(timer) })
</script>

<template>
  <section class="post-link-picker" role="dialog" aria-label="插入文章关联" @keydown="onKeydown">
    <header class="post-link-picker__header">
      <div><strong>插入文章关联</strong><p>选择已发布文章，在当前位置创建双链</p></div>
      <VButton size="sm" aria-label="关闭文章选择器" @click="emit('close')"><template #icon><IconClose /></template></VButton>
    </header>
    <div class="post-link-picker__search">
      <input ref="input" v-model="keyword" type="search" aria-label="搜索关联文章" placeholder="搜索文章标题…" role="combobox" aria-controls="obsidian-post-options" :aria-expanded="results.length > 0" :aria-activedescendant="results[active] ? `obsidian-option-${active}` : undefined" autocomplete="off" />
    </div>
    <div ref="list" class="post-link-picker__results">
      <VLoading v-if="searching" />
      <div v-else-if="error" class="post-link-picker__error" role="alert">{{ error }} <VButton size="sm" @click="search">重试</VButton></div>
      <VEmpty v-else-if="!results.length" title="没有可关联的文章" message="仅显示其他已发布文章，试试其他关键词。" />
      <VEntityContainer v-else id="obsidian-post-options" role="listbox" aria-label="关联文章列表">
        <VEntity v-for="(post, index) in results" :id="`obsidian-option-${index}`" :key="post.name" role="option" :aria-selected="index === active" :is-selected="index === active" class="cursor-pointer" @mouseenter="active = index" @mousedown.prevent @click="emit('select', post)">
          <template #start>
            <IconLink class="post-link-picker__icon" />
            <VEntityField :title="post.title" :description="post.permalink" class="min-w-0" />
          </template>
          <template #end><span class="post-link-picker__badge">文章</span></template>
        </VEntity>
      </VEntityContainer>
    </div>
    <footer>↑ ↓ 选择 · Enter 插入 · Esc 取消<span v-if="excludePostName"> · 已排除当前文章</span></footer>
  </section>
</template>

<style scoped>
.post-link-picker { display:flex; flex-direction:column; width:100%; max-height:inherit; overflow:hidden; border:1px solid #e5e7eb; border-radius:10px; background:#fff; color:#374151; box-shadow:0 12px 35px #11182724; font-size:13px; }
.post-link-picker__header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px 8px; }
.post-link-picker__header p { margin:4px 0 0; color:#6b7280; font-size:12px; }
.post-link-picker__search { padding:0 12px 10px; }
input { box-sizing:border-box; width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font:inherit; color:inherit; background:transparent; }
input:focus { outline:2px solid #0f766e40; border-color:#0f766e; }
.post-link-picker__results { min-height:0; overflow:auto; max-height:280px; border-top:1px solid #f3f4f6; }
.post-link-picker__icon { flex-shrink:0; width:18px; height:18px; color:#0f766e; }
.post-link-picker__badge { font-size:11px; padding:2px 6px; border-radius:4px; background:#f0fdfa; color:#0f766e; white-space:nowrap; }
.post-link-picker__error { padding:18px; }
footer { padding:9px 12px; border-top:1px solid #f3f4f6; color:#9ca3af; font-size:11px; }
:deep(.entity-field-wrapper) { max-width:100%; }
:deep(.entity-start-wrapper) { max-width:0; }
:deep(.entity-start) { gap:10px; }
:deep(.entity-end-wrapper) { width:48px; padding-left:0; }
@media(max-width:480px) { .post-link-picker__header p { font-size:11px; } }
</style>
