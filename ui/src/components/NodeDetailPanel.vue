<script setup lang="ts">
  import { VButton, VTag } from '@halo-dev/components'
  import type { GraphNode } from '../shared/graph-renderer/types'

  defineProps<{
    node: GraphNode | null
  }>()

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'view-backlinks', node: GraphNode): void
    (e: 'open-post', node: GraphNode): void
  }>()

  const typeLabel: Record<string, string> = {
    post: '文章',
    category: '分类',
    tag: '标签',
  }
</script>

<template>
  <aside v-if="node" class="node-panel">
    <div class="node-panel__header">
      <span class="node-panel__type" :data-type="node.type">
        {{ typeLabel[node.type] ?? node.type }}
      </span>
      <h3 class="node-panel__title" :title="node.title">{{ node.title }}</h3>
      <VButton class="node-panel__close" size="sm" ghost aria-label="关闭" @click="emit('close')">
        ×
      </VButton>
    </div>

    <div class="node-panel__body">
      <div class="node-panel__row">
        <span class="node-panel__label">连接数</span>
        <span>{{ node.degree }}</span>
      </div>

      <template v-if="node.type === 'post'">
        <div v-if="node.categories.length" class="node-panel__row">
          <span class="node-panel__label">分类</span>
          <span class="node-panel__tags">
            <VTag v-for="cat in node.categories" :key="cat">{{ cat }}</VTag>
          </span>
        </div>
        <div v-if="node.tags.length" class="node-panel__row">
          <span class="node-panel__label">标签</span>
          <span class="node-panel__tags">
            <VTag v-for="tag in node.tags" :key="tag">{{ tag }}</VTag>
          </span>
        </div>
      </template>

      <p v-if="node.broken" class="node-panel__broken">
        该双链未解析到任何文章，请检查标题或创建对应文章。
      </p>

      <div v-if="node.type === 'post' && !node.broken" class="node-panel__actions">
        <VButton size="sm" @click="emit('view-backlinks', node)">反向链接</VButton>
        <VButton v-if="node.permalink" size="sm" @click="emit('open-post', node)">
          打开文章
        </VButton>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.node-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 264px;
  max-height: calc(100% - 24px);
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(24, 26, 31, 0.92);
  color: #dcddde;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.node-panel__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 12px 8px;
}

.node-panel__type {
  flex-shrink: 0;
  margin-top: 3px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(124, 184, 255, 0.15);
  color: #7cb8ff;
}

.node-panel__type[data-type='category'] {
  background: rgba(168, 130, 255, 0.15);
  color: #a882ff;
}

.node-panel__type[data-type='tag'] {
  background: rgba(105, 210, 168, 0.15);
  color: #69d2a8;
}

.node-panel__title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-all;
}

.node-panel__close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #8a8f98;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.node-panel__close:hover {
  color: #fff;
}

.node-panel__body {
  padding: 0 12px 12px;
  font-size: 13px;
}

.node-panel__row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: baseline;
}

.node-panel__label {
  flex-shrink: 0;
  width: 44px;
  color: #8a8f98;
  font-size: 12px;
}

.node-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.node-panel__broken {
  margin: 8px 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(255, 143, 143, 0.12);
  color: #ff8f8f;
  font-size: 12px;
  line-height: 1.5;
}

.node-panel__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
