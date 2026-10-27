<script setup lang="ts">
  import { VButton, VCard, VTag } from '@halo-dev/components'
  import IconCloseLine from '~icons/ri/close-line'
  import { computed } from 'vue'
  import type { GraphNode } from '../shared/graph-renderer/types'

  const props = defineProps<{
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

  const typeBadgeClass = computed(() => {
    const base = 'mt-0.5 flex-none rounded px-1.5 py-0.5 text-[11px] leading-4'
    switch (props.node?.type) {
      case 'category':
        return `${base} bg-[#a882ff]/15 text-[#a882ff]`
      case 'tag':
        return `${base} bg-[#69d2a8]/15 text-[#69d2a8]`
      default:
        return `${base} bg-[#7cb8ff]/15 text-[#7cb8ff]`
    }
  })

  const hasActions = computed(
    () => props.node?.type === 'post' && !props.node?.broken,
  )
</script>

<template>
  <VCard
    v-if="node"
    class="absolute left-3 top-3 z-[5] w-[264px] shadow-lg"
    :body-class="['!p-3']"
  >
    <template #header>
      <div class="flex w-full items-start gap-2">
        <span :class="typeBadgeClass">{{ typeLabel[node.type] ?? node.type }}</span>
        <h3 class="m-0 flex-1 break-all text-sm font-semibold leading-5" :title="node.title">
          {{ node.title }}
        </h3>
        <button
          type="button"
          aria-label="关闭"
          class="flex-none cursor-pointer border-0 bg-transparent p-0 text-gray-400 transition-colors hover:text-gray-700 [&>svg]:h-4 [&>svg]:w-4"
          @click="emit('close')"
        >
          <IconCloseLine />
        </button>
      </div>
    </template>

    <div class="flex flex-col gap-2 text-[13px]">
      <div class="flex items-baseline gap-2">
        <span class="w-11 flex-none text-xs text-gray-400">连接数</span>
        <span>{{ node.degree }}</span>
      </div>

      <template v-if="node.type === 'post'">
        <div v-if="node.categories.length" class="flex items-baseline gap-2">
          <span class="w-11 flex-none text-xs text-gray-400">分类</span>
          <span class="flex flex-wrap gap-1">
            <VTag v-for="cat in node.categories" :key="cat">{{ cat }}</VTag>
          </span>
        </div>
        <div v-if="node.tags.length" class="flex items-baseline gap-2">
          <span class="w-11 flex-none text-xs text-gray-400">标签</span>
          <span class="flex flex-wrap gap-1">
            <VTag v-for="tag in node.tags" :key="tag">{{ tag }}</VTag>
          </span>
        </div>
      </template>

      <p
        v-if="node.broken"
        class="m-0 rounded-md bg-[#ff8f8f]/10 p-2 text-xs leading-5 text-[#e05a5a]"
      >
        该双链未解析到任何文章，请检查标题或创建对应文章。
      </p>
    </div>

    <template v-if="hasActions" #footer>
      <div class="flex gap-2">
        <VButton size="sm" @click="emit('view-backlinks', node)">反向链接</VButton>
        <VButton v-if="node.permalink" size="sm" @click="emit('open-post', node)">
          打开文章
        </VButton>
      </div>
    </template>
  </VCard>
</template>
