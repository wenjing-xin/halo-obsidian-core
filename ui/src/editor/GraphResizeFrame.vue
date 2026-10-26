<script setup lang="ts">
import { VButton } from '@halo-dev/components'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  GRAPH_DEFAULT_HEIGHT,
  GRAPH_MAX_HEIGHT,
  GRAPH_MIN_HEIGHT,
  GRAPH_MIN_WIDTH,
  minimumGraphWidthPercent,
  normalizeGraphAlignment,
  normalizeGraphHeight,
  normalizeGraphWidth,
  resizedGraphDimensions,
  type GraphResizeHandle,
  type GraphResizeOrigin,
} from '../shared/graph-renderer/embed-size'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    align?: string
    selected?: boolean
    editable?: boolean
  }>(),
  { width: 100, height: GRAPH_DEFAULT_HEIGHT, align: 'center', selected: false, editable: true },
)
const emit = defineEmits<{ resize: [size: { width: number; height: number }] }>()
const container = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const parentWidth = ref(0)
const live = ref<{ width: number; height: number } | null>(null)
const resizing = ref(false)
const width = computed(
  () => live.value?.width ?? normalizeGraphWidth(props.width, parentWidth.value),
)
const height = computed(() => live.value?.height ?? normalizeGraphHeight(props.height))
const align = computed(() => normalizeGraphAlignment(props.align))
const minPercent = computed(() => minimumGraphWidthPercent(parentWidth.value))
const horizontalHandle = computed(() => (align.value === 'right' ? 'left' : 'right'))
const frameStyle = computed(() => ({
  width: `${width.value}%`,
  minWidth: `min(${GRAPH_MIN_WIDTH}px, 100%)`,
  maxWidth: '100%',
  marginLeft: align.value === 'left' ? '0' : 'auto',
  marginRight: align.value === 'right' ? '0' : 'auto',
}))
let observer: ResizeObserver | undefined
let origin: GraphResizeOrigin | null = null
let pointerId: number | null = null
let captureTarget: HTMLElement | null = null

onMounted(() => {
  observer = new ResizeObserver(() => {
    parentWidth.value = container.value?.clientWidth || 0
  })
  if (container.value) {
    parentWidth.value = container.value.clientWidth
    observer.observe(container.value)
  }
})

function updateDimension(kind: 'width' | 'height', event: Event) {
  const input = event.target as HTMLInputElement
  const size = { width: width.value, height: height.value }
  size[kind] =
    kind === 'width'
      ? normalizeGraphWidth(input.value, parentWidth.value)
      : normalizeGraphHeight(input.value)
  input.value = String(size[kind])
  emit('resize', size)
}

function resetSize() {
  emit('resize', { width: 100, height: GRAPH_DEFAULT_HEIGHT })
}

function startResize(handle: GraphResizeHandle, event: PointerEvent) {
  if (!props.editable || event.button !== 0 || origin || !frame.value || !viewport.value) return
  const fullWidth = container.value?.clientWidth || 0
  if (!fullWidth) return
  event.preventDefault()
  event.stopPropagation()
  origin = {
    handle,
    align: align.value,
    x: event.clientX,
    y: event.clientY,
    width: frame.value.getBoundingClientRect().width,
    height: viewport.value.getBoundingClientRect().height,
    containerWidth: fullWidth,
  }
  pointerId = event.pointerId
  captureTarget = event.currentTarget as HTMLElement
  captureTarget.setPointerCapture?.(event.pointerId)
  live.value = { width: width.value, height: height.value }
  resizing.value = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('blur', cancelResize)
}

function onPointerMove(event: PointerEvent) {
  if (!origin || event.pointerId !== pointerId) return
  event.preventDefault()
  live.value = resizedGraphDimensions(origin, event.clientX, event.clientY)
}
function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  onPointerMove(event)
  finishResize(true)
}
function onPointerCancel(event: PointerEvent) {
  if (event.pointerId === pointerId) finishResize(false)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    finishResize(false)
  }
}
function cancelResize() {
  finishResize(false)
}
function finishResize(commit: boolean) {
  if (commit && live.value) emit('resize', { ...live.value })
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('blur', cancelResize)
  if (pointerId !== null && captureTarget?.hasPointerCapture?.(pointerId))
    captureTarget.releasePointerCapture(pointerId)
  origin = null
  pointerId = null
  captureTarget = null
  live.value = null
  resizing.value = false
}
onBeforeUnmount(() => {
  finishResize(false)
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="container"
    class="graph-embed-container"
    contenteditable="false"
    :data-resizing="resizing"
  >
    <div
      ref="frame"
      class="graph-embed-frame"
      :class="{ 'is-selected': selected, 'is-resizing': resizing }"
      :style="frameStyle"
    >
      <div
        v-if="editable"
        class="graph-embed-toolbar"
        data-graph-resize-ui
        @mousedown.stop
        @pointerdown.stop
        @keydown.stop
        @dragstart.prevent
      >
        <span class="graph-embed-title">关系图谱</span>
        <div class="graph-embed-fields">
          <label
            >宽
            <input
              aria-label="图谱宽度百分比"
              type="number"
              :value="width"
              :min="minPercent"
              max="100"
              step="1"
              @change="updateDimension('width', $event)"
            />
            %</label
          >
          <label
            >高
            <input
              aria-label="图谱高度像素"
              type="number"
              :value="height"
              :min="GRAPH_MIN_HEIGHT"
              :max="GRAPH_MAX_HEIGHT"
              step="20"
              @change="updateDimension('height', $event)"
            />
            px</label
          >
          <VButton size="sm" @click="resetSize">重置尺寸</VButton>
        </div>
        <div class="graph-embed-actions"><slot name="actions" /></div>
      </div>
      <div
        ref="viewport"
        class="graph-embed-viewport"
        :style="{ height: `${height}px`, minHeight: `${GRAPH_MIN_HEIGHT}px` }"
      >
        <div class="graph-embed-canvas"><slot /></div>
        <template v-if="editable">
          <button
            type="button"
            data-graph-resize-ui
            class="graph-resize-handle graph-resize-horizontal"
            :class="horizontalHandle === 'left' ? 'at-left' : 'at-right'"
            aria-label="拖动调整图谱宽度"
            title="拖动调整宽度；也可在上方输入百分比"
            @pointerdown="startResize(horizontalHandle, $event)"
            @mousedown.stop.prevent
            @dragstart.prevent
          >
            <span />
          </button>
          <button
            type="button"
            data-graph-resize-ui
            class="graph-resize-handle graph-resize-bottom"
            aria-label="拖动调整图谱高度"
            title="拖动调整高度，最低 300px"
            @pointerdown="startResize('bottom', $event)"
            @mousedown.stop.prevent
            @dragstart.prevent
          >
            <span />
          </button>
          <button
            type="button"
            data-graph-resize-ui
            class="graph-resize-handle graph-resize-corner"
            :class="align === 'right' ? 'at-left' : 'at-right'"
            aria-label="拖动调整图谱宽高"
            title="拖动同时调整宽高；Esc 取消"
            @pointerdown="startResize('corner', $event)"
            @mousedown.stop.prevent
            @dragstart.prevent
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 13 13 5M9 13l4-4" /></svg>
          </button>
        </template>
        <output v-if="resizing" class="graph-resize-readout" aria-live="polite"
          >{{ width }}% × {{ height }}px</output
        >
      </div>
      <p v-if="editable" class="graph-embed-help">
        拖动右侧 / 底边 / 角标调整 · 最小 {{ GRAPH_MIN_WIDTH }} ×
        {{ GRAPH_MIN_HEIGHT }}px（窄屏自适应）
      </p>
    </div>
  </div>
</template>

<style scoped>
.graph-embed-container {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.graph-embed-frame {
  position: relative;
  box-sizing: border-box;
  border: 1px solid #94a3b84d;
  border-radius: 10px;
}
.is-selected,
.is-resizing {
  border-color: #5fa6dd;
  box-shadow: 0 0 0 2px #5fa6dd20;
}
.graph-embed-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #94a3b833;
  border-radius: 10px 10px 0 0;
  background: var(--color-bg-2, #f8fafc);
  color: var(--color-text-2, #475569);
  font-size: 12px;
}
.graph-embed-title {
  font-weight: 600;
  white-space: nowrap;
}
.graph-embed-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.graph-embed-fields label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.graph-embed-fields input {
  box-sizing: border-box;
  width: 64px;
  min-width: 0;
  padding: 4px;
  border: 1px solid #94a3b866;
  border-radius: 4px;
  font: inherit;
  background: var(--color-bg-1, #fff);
  color: inherit;
}
.graph-embed-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}
.graph-embed-viewport {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}
.graph-embed-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.graph-embed-help {
  margin: 0;
  padding: 7px 10px;
  border-top: 1px solid #94a3b833;
  font-size: 11px;
  line-height: 1.6;
  color: #8492a6;
}
.graph-resize-handle {
  position: absolute;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #358bc8;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.graph-resize-handle:focus-visible {
  outline: 2px solid #358bc8;
  outline-offset: 1px;
  border-radius: 4px;
}
.graph-resize-horizontal {
  top: calc(50% - 26px);
  width: 20px;
  height: 52px;
  cursor: ew-resize;
}
.at-right {
  right: 0;
}
.at-left {
  left: 0;
}
.graph-resize-horizontal span {
  width: 5px;
  height: 34px;
  background: currentColor;
  border-radius: 4px;
  opacity: 0.65;
}
.graph-resize-bottom {
  bottom: 0;
  left: calc(50% - 26px);
  height: 20px;
  width: 52px;
  cursor: ns-resize;
}
.graph-resize-bottom span {
  width: 34px;
  height: 5px;
  background: currentColor;
  border-radius: 4px;
  opacity: 0.65;
}
.graph-resize-corner {
  bottom: 0;
  width: 26px;
  height: 26px;
  cursor: nwse-resize;
  background: #e8f3fc;
  border-radius: 6px 0 0 0;
}
.graph-resize-corner.at-left {
  transform: scaleX(-1);
  cursor: nesw-resize;
}
.graph-resize-corner svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.graph-resize-handle:hover span {
  opacity: 1;
}
.graph-resize-readout {
  position: absolute;
  bottom: 28px;
  right: 28px;
  z-index: 8;
  background: #1e293b;
  color: #fff;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 12px;
  pointer-events: none;
}
.is-resizing {
  user-select: none;
}
</style>
