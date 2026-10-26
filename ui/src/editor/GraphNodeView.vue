<script setup lang="ts">
import { VButton } from '@halo-dev/components'
import { NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor'
import { computed, ref } from 'vue'
import GraphInsertModal from './GraphInsertModal.vue'

const props = defineProps(nodeViewProps)

const modalVisible = ref(false)

const modeLabel = computed(() => {
  switch (props.node?.attrs.mode) {
    case 'local':
      return '局部图谱'
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
  if (attrs.mode !== 'full') {
    parts.push(`深度：${attrs.depth}`)
  }
  return parts.join(' · ')
})

function onConfirm(attrs: { mode: string; post: string; nodes: string; depth: number; dark: boolean }) {
  props.updateAttributes({
    mode: attrs.mode,
    post: attrs.post,
    nodes: attrs.nodes,
    depth: attrs.depth,
    dark: attrs.dark,
  })
  modalVisible.value = false
}
</script>

<template>
  <NodeViewWrapper as="div" class="graph-node-view">
    <div class="graph-node-view__card">
      <div class="graph-node-view__icon">◈</div>
      <div class="graph-node-view__info">
        <p class="graph-node-view__title">知识图谱</p>
        <p class="graph-node-view__summary">{{ summary }}</p>
      </div>
      <div class="graph-node-view__actions">
        <VButton size="sm" @click="modalVisible = true">配置</VButton>
        <VButton size="sm" type="danger" @click="props.deleteNode()">删除</VButton>
      </div>
    </div>
    <p class="graph-node-view__hint">发布后将在文章中渲染为可交互的知识图谱。</p>
    <GraphInsertModal
      :visible="modalVisible"
      :initial="props.node?.attrs"
      @close="modalVisible = false"
      @confirm="onConfirm"
    />
  </NodeViewWrapper>
</template>

<style scoped>
.graph-node-view {
  margin: 8px 0;
}

.graph-node-view__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(124, 184, 255, 0.35);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(124, 184, 255, 0.08), rgba(168, 130, 255, 0.08));
}

.graph-node-view__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(124, 184, 255, 0.18);
  color: #7cb8ff;
  font-size: 20px;
}

.graph-node-view__info {
  flex: 1;
  min-width: 0;
}

.graph-node-view__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.graph-node-view__summary {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-node-view__actions {
  display: flex;
  gap: 8px;
}

.graph-node-view__hint {
  margin: 6px 2px;
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
}
</style>
