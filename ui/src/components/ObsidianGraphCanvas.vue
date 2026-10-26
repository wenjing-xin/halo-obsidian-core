<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GraphRenderer } from '../shared/graph-renderer/renderer'
import type { GraphNode, GraphPayload } from '../shared/graph-renderer/types'

const props = withDefaults(
  defineProps<{
    payload?: GraphPayload | null
    dark?: boolean
    showLabels?: boolean
    showArrows?: boolean
    showCategories?: boolean
    showTags?: boolean
    highlight?: string
  }>(),
  {
    payload: null,
    dark: false,
    showLabels: true,
    showArrows: false,
    showCategories: true,
    showTags: true,
    highlight: '',
  }
)

const emit = defineEmits<{
  (e: 'select', node: GraphNode | null): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderer: GraphRenderer | null = null

function currentOpts() {
  return {
    dark: props.dark,
    showLabels: props.showLabels,
    showArrows: props.showArrows,
    showCategories: props.showCategories,
    showTags: props.showTags,
  }
}

async function mountRenderer() {
  if (!canvasRef.value || renderer) {
    return
  }
  // Dynamic import keeps d3-force in a separate chunk.
  const { GraphRenderer: Renderer } = await import('../shared/graph-renderer/renderer')
  if (!canvasRef.value || renderer) {
    return
  }
  renderer = new Renderer(canvasRef.value, {
    ...currentOpts(),
    onSelect: (node) => emit('select', node),
  })
  if (props.payload) {
    renderer.setData(props.payload, currentOpts())
  }
  if (props.highlight) {
    renderer.setHighlight(props.highlight)
  }
}

onMounted(mountRenderer)

watch(
  () => props.payload,
  (payload) => {
    if (renderer && payload) {
      renderer.setData(payload, currentOpts())
    }
  }
)

watch(
  () => [props.dark, props.showLabels, props.showArrows],
  () => {
    renderer?.setOptions(currentOpts())
  }
)

watch(
  () => [props.showCategories, props.showTags],
  () => {
    if (renderer && props.payload) {
      renderer.setData(props.payload, currentOpts())
    }
  }
)

watch(
  () => props.highlight,
  (keyword) => {
    renderer?.setHighlight(keyword ?? '')
  }
)

onBeforeUnmount(() => {
  renderer?.destroy()
  renderer = null
})

function zoomBy(factor: number) {
  renderer?.zoomBy(factor)
}

function resetViewport() {
  renderer?.resetViewport()
}

defineExpose({ zoomBy, resetViewport })
</script>

<template>
  <canvas ref="canvasRef" class="obsidian-graph-canvas" />
</template>

<style scoped>
.obsidian-graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
