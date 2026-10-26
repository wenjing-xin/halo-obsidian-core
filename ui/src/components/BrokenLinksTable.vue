<script setup lang="ts">
import { computed } from 'vue'
import type { UnresolvedItem } from '../shared/graph-renderer/types'
import PostRelationList, { type RelationPostRow } from './PostRelationList.vue'
const props = defineProps<{ items: UnresolvedItem[]; loading?: boolean }>()
const rows = computed<RelationPostRow[]>(() =>
  props.items.map((item, index) => ({
    key: `${item.sourcePostName}-${index}`,
    name: item.sourcePostName,
    title: item.sourceTitle,
    targetTitle: item.targetTitle,
    snippet: item.snippet,
    status: 'broken',
  })),
)
</script>
<template>
  <PostRelationList
    :items="rows"
    :loading="loading"
    empty-title="没有断链"
    empty-message="所有文章关联都已解析到对应文章。"
  />
</template>
