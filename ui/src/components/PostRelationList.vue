<script setup lang="ts">
import {
  IconExternalLinkLine,
  Toast,
  VDropdownItem,
  VEmpty,
  VEntity,
  VEntityContainer,
  VEntityField,
  VLoading,
  VStatusDot,
} from '@halo-dev/components'
import { useRouter } from 'vue-router'
import { copyWikiLinkTag } from '../shared/copy-wikilink'
import { safePostPermalink } from '../shared/wikilink-tag'

export interface RelationPostRow {
  key: string
  name?: string
  title: string
  permalink?: string | null
  snippet?: string
  targetTitle?: string
  status?: 'backlink' | 'resolved' | 'broken'
}
withDefaults(
  defineProps<{
    items: RelationPostRow[]
    loading?: boolean
    selectable?: boolean
    emptyTitle?: string
    emptyMessage?: string
  }>(),
  { loading: false, selectable: false, emptyTitle: '暂无文章', emptyMessage: '当前范围没有文章。' },
)
const emit = defineEmits<{ select: [row: RelationPostRow] }>()
const router = useRouter()
const statusLabels = { backlink: '反向链接', resolved: '已解析', broken: '待修复' }

function edit(row: RelationPostRow) {
  if (row.name) void router.push({ name: 'PostEditor', query: { name: row.name } })
}
function visit(row: RelationPostRow) {
  const href = safePostPermalink(row.permalink)
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}
async function copyTag(row: RelationPostRow) {
  if (row.name)
    await copyWikiLinkTag({ name: row.name, title: row.title, permalink: row.permalink })
}
async function copyTarget(row: RelationPostRow) {
  try {
    await navigator.clipboard.writeText(row.targetTitle || row.title)
    Toast.success('未解析目标已复制')
  } catch {
    Toast.error('复制失败，请允许浏览器访问剪贴板后重试')
  }
}
</script>

<template>
  <VLoading v-if="loading" />
  <VEmpty v-else-if="!items.length" :title="emptyTitle" :message="emptyMessage" />
  <VEntityContainer v-else class="post-relation-list">
    <VEntity v-for="row in items" :key="row.key">
      <template #start>
        <VEntityField
          :title="row.title"
          :route="
            !selectable && row.name ? { name: 'PostEditor', query: { name: row.name } } : undefined
          "
          max-width="30rem"
          @click="selectable && emit('select', row)"
        >
          <template v-if="selectable" #title>
            <button
              type="button"
              class="text-left text-sm font-medium text-gray-900 hover:text-gray-600"
              @click="emit('select', row)"
            >
              {{ row.title }}
            </button>
          </template>
          <template #extra>
            <a
              v-if="safePostPermalink(row.permalink)"
              v-tooltip="'查看文章'"
              :href="safePostPermalink(row.permalink)"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="查看文章"
              class="ml-2 text-gray-500 opacity-60 transition-opacity hover:text-gray-900 group-hover:opacity-100"
              ><IconExternalLinkLine class="h-3.5 w-3.5"
            /></a>
          </template>
          <template #description>
            <div class="flex min-w-0 flex-col gap-1.5 text-xs text-gray-500">
              <span v-if="row.targetTitle" class="text-amber-700"
                >未解析目标：{{ row.targetTitle }}</span
              >
              <span v-if="row.snippet" class="relation-snippet">{{ row.snippet }}</span>
              <span v-else-if="row.permalink" class="truncate">{{ row.permalink }}</span>
            </div>
          </template>
        </VEntityField>
      </template>
      <template v-if="row.status" #end>
        <VEntityField
          ><template #description
            ><VStatusDot
              :state="row.status === 'broken' ? 'warning' : 'success'"
              :text="statusLabels[row.status]" /></template
        ></VEntityField>
      </template>
      <template #dropdownItems>
        <VDropdownItem v-if="selectable" @click="emit('select', row)">查看反向链接</VDropdownItem>
        <VDropdownItem v-if="row.name" @click="edit(row)">{{
          row.status === 'broken' ? '编辑来源文章' : '编辑文章'
        }}</VDropdownItem>
        <VDropdownItem v-if="safePostPermalink(row.permalink)" @click="visit(row)"
          >查看文章</VDropdownItem
        >
        <VDropdownItem v-if="row.name" @click="copyTag(row)">{{
          row.status === 'broken' ? '复制来源文章双链标签' : '复制双链标签'
        }}</VDropdownItem>
        <VDropdownItem v-if="row.status === 'broken'" @click="copyTarget(row)"
          >复制未解析目标</VDropdownItem
        >
      </template>
    </VEntity>
  </VEntityContainer>
</template>

<style scoped>
.post-relation-list :deep(table) {
  table-layout: fixed;
}
.post-relation-list :deep(.entity-start-wrapper) {
  width: auto;
  min-width: 0;
}
.post-relation-list :deep(.entity-end-wrapper) {
  width: 136px;
}
.post-relation-list :deep(.entity-start) {
  min-width: 0;
}
.post-relation-list :deep(.entity-field-wrapper) {
  min-width: 0;
  max-width: 100% !important;
}
.post-relation-list :deep(.entity-field-title-body) {
  min-width: 0;
}
.relation-snippet {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
}
@media (max-width: 640px) {
  .post-relation-list :deep(.entity-end-wrapper) {
    width: 124px;
  }
  .post-relation-list :deep(.entity-end) {
    gap: 10px;
  }
  .post-relation-list :deep(.entity-start-wrapper),
  .post-relation-list :deep(.entity-end-wrapper) {
    padding: 12px;
  }
}
</style>
