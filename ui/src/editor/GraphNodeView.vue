<script setup lang="ts">
import { VButton } from '@halo-dev/components'
import { NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchConsoleGraphPreview } from '../api/obsidian'
import ObsidianGraphCanvas from '../components/ObsidianGraphCanvas.vue'
import type { GraphPayload } from '../shared/graph-renderer/types'
import GraphInsertModal, { type GraphAttrs } from './GraphInsertModal.vue'
import GraphResizeFrame from './GraphResizeFrame.vue'
import { currentPostName } from './picker-position'
import {
  normalizeGraphHeight,
  normalizeGraphWidth,
  normalizeGraphAlignment,
} from '../shared/graph-renderer/embed-size'
import {
  normalizeTheme,
  observeGraphTheme,
  resolveDark,
} from '../shared/graph-renderer/theme-controller'

const props = defineProps(nodeViewProps)

const modalVisible = ref(false)
const editorPost = ref(currentPostName(window.location.href))
const previewPost = computed(() => props.node?.attrs.post || editorPost.value)
const currentPostPending = computed(
  () => props.node?.attrs.mode === 'local' && !previewPost.value,
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
  if (attrs.mode === 'local' && !previewPost.value) {
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
      post: previewPost.value || undefined,
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
    previewPost.value,
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
  // Halo may create the article after the node view mounts. Track the saved
  // article identity without serializing it into an implicit local graph.
  props.editor.on('transaction', syncEditorPost)
})
function syncEditorPost() {
  editorPost.value = currentPostName(window.location.href)
}
onBeforeUnmount(() => {
  stopTheme?.()
  props.editor.off('transaction', syncEditorPost)
  fetchSeq++
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

const height = computed(() => normalizeGraphHeight(props.node?.attrs.height))
const width = computed(() => normalizeGraphWidth(props.node?.attrs.width))
const align = computed(() => normalizeGraphAlignment(props.node?.attrs.align))
function onResize(size: { width: number; height: number }) {
  props.updateAttributes(size)
}

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
  <NodeViewWrapper as="div" class="my-3" contenteditable="false">
    <div ref="frameRef">
      <GraphResizeFrame
        :width="width"
        :height="height"
        :align="align"
        :selected="props.selected"
        :editable="props.editor.isEditable"
        @resize="onResize"
      >
        <template #actions>
          <div class="flex gap-0.5">
            <button
              v-for="option in ['left', 'center', 'right'] as const"
              :key="option"
              type="button"
              :class="alignBtnClass(option)"
              :aria-label="
                option === 'left' ? '左对齐图谱' : option === 'center' ? '居中图谱' : '右对齐图谱'
              "
              :title="option === 'left' ? '左对齐' : option === 'center' ? '居中' : '右对齐'"
              @click="setAlign(option)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
        </template>
        <ObsidianGraphCanvas
          v-if="payload && !isEmpty && !loadError"
          :payload="payload"
          :dark="darkAttr"
        />
        <div
          v-if="loading || loadError || isEmpty || currentPostPending"
          class="absolute inset-0 flex items-center justify-center bg-slate-400/[0.08] p-6 text-center text-[13px] text-gray-400"
        >
          <span v-if="loading">图谱加载中…</span>
          <span v-else-if="loadError">图谱加载失败：{{ loadError }}</span>
          <span v-else-if="currentPostPending"
            >请先保存当前文章，或在配置中选择中心文章后预览局部图谱。</span
          >
          <span v-else>该范围内暂无图谱节点，请在配置中调整范围。</span>
        </div>
      </GraphResizeFrame>
    </div>
    <p class="mx-0.5 my-1.5 truncate text-xs text-gray-400">关系图谱 · {{ summary }}</p>
    <GraphInsertModal
      :visible="modalVisible"
      :initial="props.node?.attrs"
      @close="closeConfig"
      @confirm="onConfirm"
    />
  </NodeViewWrapper>
</template>
