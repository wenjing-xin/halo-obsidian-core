<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GraphRenderer, RendererForces } from '../shared/graph-renderer/renderer'
import type { GraphNode, GraphPayload } from '../shared/graph-renderer/types'

const props = withDefaults(
  defineProps<{
    payload?: GraphPayload | null
    dark?: boolean
    showLabels?: boolean
    showArrows?: boolean
    showCategories?: boolean
    showTags?: boolean
    showGroups?: boolean
    highlight?: string
    textFade?: number
    nodeSize?: number
    lineThickness?: number
    forces?: Partial<RendererForces>
  }>(),
  {
    payload: null,
    dark: false,
    showLabels: true,
    showArrows: false,
    showCategories: true,
    showTags: true,
    showGroups: false,
    highlight: '',
    textFade: 1,
    nodeSize: 1,
    lineThickness: 1,
    forces: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'select', node: GraphNode | null): void
}>()

const containerRef = ref<HTMLElement | null>(null)

let renderer: GraphRenderer | null = null

function currentOpts() {
  return {
    dark: props.dark,
    showLabels: props.showLabels,
    showArrows: props.showArrows,
    showCategories: props.showCategories,
    showTags: props.showTags,
    showGroups: props.showGroups,
    textFade: props.textFade,
    nodeSize: props.nodeSize,
    lineThickness: props.lineThickness,
    forces: { ...props.forces },
  }
}

async function mountRenderer() {
  if (!containerRef.value || renderer) {
    return
  }
  // Dynamic import keeps sigma/graphology in a separate lazy chunk.
  const { GraphRenderer: Renderer } = await import('../shared/graph-renderer/renderer')
  if (!containerRef.value || renderer) {
    return
  }
  renderer = new Renderer(containerRef.value, {
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
  },
)

watch(
  () => [
    props.dark,
    props.showGroups,
    props.showLabels,
    props.showArrows,
    props.textFade,
    props.nodeSize,
    props.lineThickness,
  ],
  () => {
    renderer?.setOptions(currentOpts())
  },
)

watch(
  () => props.forces,
  (forces) => {
    renderer?.setOptions({ forces: { ...forces } })
  },
  { deep: true },
)

watch(
  () => [props.showCategories, props.showTags],
  () => {
    if (renderer && props.payload) {
      renderer.setData(props.payload, currentOpts())
    }
  },
)

watch(
  () => props.highlight,
  (keyword) => {
    renderer?.setHighlight(keyword ?? '')
  },
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

function replay() {
  renderer?.replay()
}

defineExpose({ zoomBy, resetViewport, replay })
</script>

<template>
  <div ref="containerRef" class="obsidian-graph-canvas" />
</template>

<style scoped>
.obsidian-graph-canvas {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}
</style>
