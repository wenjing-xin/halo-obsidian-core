<script setup lang="ts">
import { VEmpty, VLoading, VModal, VButton } from '@halo-dev/components'
import PostRelationList, { type RelationPostRow } from './PostRelationList.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { fetchBacklinks } from '../api/obsidian'
import type { BacklinkItem } from '../shared/graph-renderer/types'

const props = defineProps<{
  postName: string | null
  postTitle?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const items = ref<BacklinkItem[]>([])
const rows = computed<RelationPostRow[]>(() =>
  items.value.map((item) => ({
    key: item.sourcePostName,
    name: item.sourcePostName,
    title: item.sourceTitle,
    permalink: item.sourcePermalink,
    snippet: item.snippet,
    status: 'backlink',
  })),
)

async function load() {
  if (!props.postName) {
    return
  }
  loading.value = true
  try {
    const { data } = await fetchBacklinks(props.postName)
    items.value = data.items ?? []
  } finally {
    loading.value = false
  }
}

watch(() => props.postName, load)

onMounted(load)
</script>

<template>
  <VModal :visible="!!postName" :width="560" title="反向链接" @close="emit('close')">
    <div class="backlinks">
      <p v-if="postTitle" class="backlinks__subject">「{{ postTitle }}」的被链接文章</p>
      <VLoading v-if="loading" />
      <VEmpty
        v-else-if="!items.length"
        title="暂无反向链接"
        message="其他文章插入本文的双链标签后，会显示在这里。"
      >
        <template #actions>
          <VButton @click="emit('close')">关闭</VButton>
        </template>
      </VEmpty>
      <PostRelationList v-else :items="rows" />
    </div>
    <template #footer>
      <VButton @click="emit('close')">关闭</VButton>
    </template>
  </VModal>
</template>

<style scoped>
.backlinks__subject {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-2, #4b5563);
}
</style>
