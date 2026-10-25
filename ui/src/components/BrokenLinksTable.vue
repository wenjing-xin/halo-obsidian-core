<script setup lang="ts">
  import { VButton, VEmpty, VLoading } from '@halo-dev/components'
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { UnresolvedItem } from '../shared/graph-renderer/types'

  defineProps<{
    items: UnresolvedItem[]
    loading?: boolean
  }>()

  const router = useRouter()

  const copied = ref(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    } catch {
      // Clipboard unavailable; ignore silently.
    }
  }

  function openSource(item: UnresolvedItem) {
    router.push({ path: '/posts/editor', query: { name: item.sourcePostName } })
  }
</script>

<template>
  <VLoading v-if="loading" />
  <VEmpty v-else-if="!items.length" title="没有断链" message="所有 [[双链]] 都已成功解析到对应文章。" />
  <div v-else class="broken-table">
    <table>
      <thead>
        <tr>
          <th>来源文章</th>
          <th>目标标题</th>
          <th>上下文</th>
          <th class="broken-table__actions-col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in items" :key="`${item.sourcePostName}-${index}`">
          <td class="broken-table__source" :title="item.sourceTitle">
            {{ item.sourceTitle }}
          </td>
          <td>
            <span class="broken-table__target">[[{{ item.targetTitle }}]]</span>
          </td>
          <td class="broken-table__snippet">
            {{ item.snippet || '—' }}
          </td>
          <td class="broken-table__actions-col">
            <VButton size="sm" @click="copy(item.targetTitle)">
              {{ copied ? '已复制' : '复制标题' }}
            </VButton>
            <VButton size="sm" @click="openSource(item)">打开来源</VButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.broken-table {
  overflow-x: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
}

.broken-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.broken-table th,
.broken-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.broken-table th {
  background: var(--color-bg-3, #f4f4f6);
  font-weight: 600;
  color: var(--color-text-2, #4b5563);
}

.broken-table tbody tr:last-child td {
  border-bottom: none;
}

.broken-table__source {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.broken-table__target {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #ff8f8f;
}

.broken-table__snippet {
  max-width: 320px;
  color: var(--color-text-3, #9ca3af);
}

.broken-table__actions-col {
  white-space: nowrap;
}

.broken-table__actions-col :deep(.v-button + .v-button) {
  margin-left: 8px;
}
</style>
