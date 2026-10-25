<script setup lang="ts">
import { VEmpty, VLoading, VModal, VButton } from '@halo-dev/components'
import { IconExternalLinkLine } from '@halo-dev/components'
import { onMounted, ref, watch } from 'vue'
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
  <VModal
    :visible="!!postName"
    :width="560"
    title="反向链接"
    @close="emit('close')"
  >
    <div class="backlinks">
      <p v-if="postTitle" class="backlinks__subject">「{{ postTitle }}」的被链接文章</p>
      <VLoading v-if="loading" />
      <VEmpty
        v-else-if="!items.length"
        title="暂无反向链接"
        message="其他文章通过 [[标题]] 链接到本文后，会显示在这里。"
      >
        <template #actions>
          <VButton @click="emit('close')">关闭</VButton>
        </template>
      </VEmpty>
      <ul v-else class="backlinks__list">
        <li v-for="item in items" :key="item.sourcePostName" class="backlinks__item">
          <div class="backlinks__item-head">
            <span class="backlinks__item-title">{{ item.sourceTitle }}</span>
            <a
              v-if="item.sourcePermalink"
              :href="item.sourcePermalink"
              target="_blank"
              rel="noopener"
              class="backlinks__item-link"
            >
              <IconExternalLinkLine />
            </a>
          </div>
          <p v-if="item.snippet" class="backlinks__snippet">{{ item.snippet }}</p>
        </li>
      </ul>
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

.backlinks__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backlinks__item {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: var(--color-bg-2, #fafafa);
}

.backlinks__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.backlinks__item-title {
  font-size: 13px;
  font-weight: 600;
}

.backlinks__item-link {
  color: var(--color-primary, #4cc2ba);
}

.backlinks__snippet {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
  line-height: 1.5;
}
</style>
