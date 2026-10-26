<script setup lang="ts">
  import {
    VButton,
    VEmpty,
    VEntity,
    VEntityContainer,
    VEntityField,
    VLoading,
    VSpace,
  } from '@halo-dev/components'
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
  <VEntityContainer v-else>
    <VEntity v-for="(item, index) in items" :key="`${item.sourcePostName}-${index}`">
      <template #start>
        <VEntityField :title="item.sourceTitle">
          <template #description>
            <span class="broken-table__target">[[{{ item.targetTitle }}]]</span>
            <span v-if="item.snippet" class="broken-table__snippet">
              {{ item.snippet }}
            </span>
          </template>
        </VEntityField>
      </template>
      <template #end>
        <VSpace>
          <VButton size="sm" @click="copy(item.targetTitle)">
            {{ copied ? '已复制' : '复制标题' }}
          </VButton>
          <VButton size="sm" @click="openSource(item)">打开来源</VButton>
        </VSpace>
      </template>
    </VEntity>
  </VEntityContainer>
</template>

<style scoped>
.broken-table__target {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #ff8f8f;
  margin-right: 8px;
}

.broken-table__snippet {
  color: var(--color-text-3, #9ca3af);
}
</style>
