<script setup lang="ts">
import { VButton } from '@halo-dev/components'
import { NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchConsoleGraphPreview } from '../api/obsidian'
import ObsidianGraphCanvas from '../components/ObsidianGraphCanvas.vue'
import type { GraphPayload } from '../shared/graph-renderer/types'
import GraphInsertModal, { type GraphAttrs } from './GraphInsertModal.vue'
import {
  normalizeTheme,
  observeGraphTheme,
  resolveDark,
} from '../shared/graph-renderer/theme-controller'

const props = defineProps(nodeViewProps)

const modalVisible = ref(props.node?.attrs.configured === false)
const currentPostPending = computed(
  () => props.node?.attrs.mode === 'local' && !props.node?.attrs.post,
)

// ---------------------------------------------------------------------------
// Live graph preview
// ---------------------------------------------------------------------------

const payload = ref<GraphPayload | null>(null)
const loading = ref(false)
const loadError = ref('')

let fetchSeq = 0

async function loadGraph() {
  const attrs = props.node?.attrs ?? {}
  const seq = ++fetchSeq
  if (attrs.configured === false || (attrs.mode === 'local' && !attrs.post)) {
    payload.value = null
    loading.value = false
    loadError.value = ''
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await fetchConsoleGraphPreview({
      mode: attrs.mode || 'full',
      post: attrs.post || undefined,
      nodes: attrs.nodes
        ? String(attrs.nodes)
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [],
      depth: attrs.depth || 1,
      showTaxonomy: true,
    })
    if (seq === fetchSeq) {
      payload.value = data
    }
  } catch (error) {
    if (seq === fetchSeq) {
      loadError.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (seq === fetchSeq) {
      loading.value = false
    }
  }
}

watch(
  () => [
    props.node?.attrs.configured,
    props.node?.attrs.mode,
    props.node?.attrs.post,
    props.node?.attrs.nodes,
    props.node?.attrs.depth,
  ],
  loadGraph,
  { immediate: true },
)

const darkAttr = ref(false)
let stopTheme: (() => void) | undefined
function syncPreviewTheme() {
  if (!frameRef.value) return
  darkAttr.value = resolveDark(
    frameRef.value,
    normalizeTheme(props.node?.attrs.theme, props.node?.attrs.dark),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
}
watch(() => [props.node?.attrs.theme, props.node?.attrs.dark], syncPreviewTheme)
onMounted(() => {
  if (frameRef.value) stopTheme = observeGraphTheme(frameRef.value, syncPreviewTheme)
})
onBeforeUnmount(() => {
  stopTheme?.()
  fetchSeq++
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
})

const isEmpty = computed(
  () =>
    !loading.value &&
    !loadError.value &&
    payload.value !== null &&
    payload.value.nodes.length === 0,
)

// ---------------------------------------------------------------------------
// Sizing & alignment
// ---------------------------------------------------------------------------

const frameRef = ref<HTMLElement | null>(null)

const liveHeight = ref<number | null>(null)
const liveWidth = ref<number | null>(null)

const height = computed(() => liveHeight.value ?? (Number(props.node?.attrs.height) || 360))
const width = computed(() => liveWidth.value ?? (Number(props.node?.attrs.width) || 100))
const align = computed(() => {
  const value = props.node?.attrs.align
  return value === 'left' || value === 'right' ? value : 'center'
})

const frameStyle = computed(() => ({
  height: `${height.value}px`,
  width: `${width.value}%`,
  marginLeft: align.value === 'left' ? '0' : 'auto',
  marginRight: align.value === 'right' ? '0' : 'auto',
}))

const frameClass = computed(() => [
  'relative overflow-hidden rounded-[10px] border transition-colors',
  props.selected
    ? 'border-[rgba(124,184,255,0.65)] shadow-[0_0_0_3px_rgba(124,184,255,0.18)]'
    : 'border-slate-400/25',
])

function setAlign(value: 'left' | 'center' | 'right') {
  props.updateAttributes({ align: value })
}

function alignBtnClass(option: 'left' | 'center' | 'right') {
  return [
    'flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] border-0 text-gray-400 transition-colors',
    align.value === option
      ? 'bg-[rgba(124,184,255,0.25)] text-[#7cb8ff]'
      : 'bg-transparent hover:bg-white/10 hover:text-gray-200',
  ]
}

const handleBase = 'group absolute z-[6] touch-none opacity-40 transition-opacity hover:opacity-100'

const handleInnerClass = 'absolute inset-0.5 rounded bg-[rgba(124,184,255,0.9)]'

type ResizeHandle = 'right' | 'bottom' | 'corner'

interface ResizeSession {
  handle: ResizeHandle
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  fullWidth: number
}

let session: ResizeSession | null = null

function startResize(handle: ResizeHandle, event: PointerEvent) {
  const frame = frameRef.value
  if (!frame || !frame.parentElement) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  session = {
    handle,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: frame.clientWidth,
    startHeight: frame.clientHeight,
    fullWidth: frame.parentElement.clientWidth,
  }
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize, { once: true })
}

function onResizeMove(event: PointerEvent) {
  if (!session) {
    return
  }
  const dx = event.clientX - session.startX
  const dy = event.clientY - session.startY
  if (session.handle !== 'bottom' && session.fullWidth > 0) {
    const percent = ((session.startWidth + dx) / session.fullWidth) * 100
    liveWidth.value = Math.round(Math.min(100, Math.max(20, percent)))
  }
  if (session.handle !== 'right') {
    liveHeight.value = Math.round(Math.min(1200, Math.max(200, session.startHeight + dy)))
  }
}

function endResize() {
  window.removeEventListener('pointermove', onResizeMove)
  if (session && (liveWidth.value !== null || liveHeight.value !== null)) {
    props.updateAttributes({
      width: liveWidth.value ?? props.node?.attrs.width,
      height: liveHeight.value ?? props.node?.attrs.height,
    })
  }
  session = null
  liveWidth.value = null
  liveHeight.value = null
}

// ---------------------------------------------------------------------------
// Configuration modal
// ---------------------------------------------------------------------------

const modeLabel = computed(() => {
  switch (props.node?.attrs.mode) {
    case 'local':
      return props.node?.attrs.post ? '指定中心局部图谱' : '当前文章局部图谱'
    case 'nodes':
      return '指定文章'
    default:
      return '全站图谱'
  }
})

const summary = computed(() => {
  const attrs = props.node?.attrs ?? {}
  const parts: string[] = [modeLabel.value]
  if (attrs.mode === 'local' && attrs.post) {
    parts.push(`中心：${attrs.post}`)
  }
  if (attrs.mode === 'nodes' && attrs.nodes) {
    parts.push(`文章：${attrs.nodes}`)
  }
  if (attrs.mode === 'local') {
    parts.push(`深度：${attrs.depth}`)
  }
  return parts.join(' · ')
})

function onConfirm(attrs: GraphAttrs) {
  props.updateAttributes({ ...attrs, configured: true })
  modalVisible.value = false
}
function closeConfig() {
  modalVisible.value = false
  if (props.node?.attrs.configured === false) props.deleteNode()
}
</script>

<template>
  <NodeViewWrapper as="div" class="my-2">
    <div ref="frameRef" :class="frameClass" :style="frameStyle" @dblclick="modalVisible = true">
      <ObsidianGraphCanvas
        v-if="payload && !isEmpty && !loadError"
        :payload="payload"
        :dark="darkAttr"
      />
      <div
        v-if="loading || loadError || isEmpty || currentPostPending"
        class="absolute inset-0 flex items-center justify-center bg-slate-400/[0.08] p-4 text-center text-[13px] text-gray-400"
      >
        <span v-if="loading">图谱加载中…</span>
        <span v-else-if="loadError">图谱加载失败：{{ loadError }}</span>
        <span v-else-if="currentPostPending"
          >当前文章局部图谱将在发布后自动绑定本文；可在配置中调整深度。</span
        >
        <span v-else>该范围内暂无图谱节点，双击可调整范围配置</span>
      </div>

      <div
        v-if="props.selected"
        class="absolute right-2 top-2 z-[5] flex items-center gap-1.5 rounded-lg bg-[rgba(30,32,38,0.85)] px-1.5 py-1 backdrop-blur-md"
        @mousedown.stop
      >
        <div class="mr-0.5 flex gap-0.5">
          <button
            v-for="option in ['left', 'center', 'right'] as const"
            :key="option"
            type="button"
            :class="alignBtnClass(option)"
            :title="option === 'left' ? '左对齐' : option === 'center' ? '居中' : '右对齐'"
            @click="setAlign(option)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect y="1.5" width="14" height="2" rx="1" fill="currentColor" />
              <rect
                :x="option === 'left' ? 0 : option === 'center' ? 2.5 : 5"
                y="6"
                width="9"
                height="2"
                rx="1"
                fill="currentColor"
              />
              <rect
                :x="option === 'left' ? 0 : option === 'center' ? 3.5 : 7"
                y="10.5"
                width="7"
                height="2"
                rx="1"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <VButton size="sm" @click="modalVisible = true">配置</VButton>
        <VButton size="sm" type="danger" @click="props.deleteNode()">删除</VButton>
      </div>

      <template v-if="props.selected">
        <div
          :class="[handleBase, 'right-[-5px] top-1/2 h-11 w-2.5 -translate-y-1/2 cursor-ew-resize']"
          title="拖动调整宽度"
          @pointerdown="startResize('right', $event)"
        >
          <span :class="handleInnerClass" />
        </div>
        <div
          :class="[
            handleBase,
            'bottom-[-5px] left-1/2 h-2.5 w-11 -translate-x-1/2 cursor-ns-resize',
          ]"
          title="拖动调整高度"
          @pointerdown="startResize('bottom', $event)"
        >
          <span :class="handleInnerClass" />
        </div>
        <div
          :class="[handleBase, 'bottom-[-5px] right-[-5px] h-3.5 w-3.5 cursor-nwse-resize']"
          title="拖动调整大小"
          @pointerdown="startResize('corner', $event)"
        >
          <span :class="handleInnerClass" />
        </div>
      </template>
    </div>

    <p class="mx-0.5 my-1.5 truncate text-xs text-gray-400">
      关系图谱 · {{ summary }} · {{ width }}% × {{ height }}px
    </p>

    <GraphInsertModal
      :visible="modalVisible"
      :initial="props.node?.attrs"
      @close="closeConfig"
      @confirm="onConfirm"
    />
  </NodeViewWrapper>
</template>
