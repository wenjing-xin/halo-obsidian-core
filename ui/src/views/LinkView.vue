<script setup lang="ts">
import {
  VAlert,
  VButton,
  VCard,
  VEmpty,
  VLoading,
  VTabbar,
  VTag,
} from '@halo-dev/components'
import { IconRefreshLine } from '@halo-dev/components'
import { FormKit } from '@formkit/vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  fetchBacklinks,
  fetchOutgoing,
  fetchSummary,
  fetchUnresolvedLinks,
  reindexAll,
  searchPostBriefs,
  type PostBrief,
  type WikiLinkEntry,
} from '../api/obsidian'
import BrokenLinksTable from '../components/BrokenLinksTable.vue'
import type {
  BacklinkItem,
  GraphSummary,
  UnresolvedItem,
} from '../shared/graph-renderer/types'

const activeTab = ref('backlinks')

const summary = ref<GraphSummary | null>(null)

const unresolved = ref<UnresolvedItem[]>([])
const unresolvedLoading = ref(false)

const keyword = ref('')
const searching = ref(false)
const postResults = ref<PostBrief[]>([])
const selectedPost = ref<PostBrief | null>(null)

const backlinks = ref<BacklinkItem[]>([])
const backlinksLoading = ref(false)

const outgoingLinks = ref<WikiLinkEntry[]>([])
const outgoingUnresolved = ref<WikiLinkEntry[]>([])

const reindexing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const codeClass = 'rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-700'

async function loadSummary() {
  try {
    summary.value = (await fetchSummary()).data
  } catch {
    // ignore
  }
}

async function loadUnresolved() {
  unresolvedLoading.value = true
  try {
    unresolved.value = (await fetchUnresolvedLinks()).data
  } finally {
    unresolvedLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(searchPosts, 300)
})

async function searchPosts() {
  if (!keyword.value.trim()) {
    postResults.value = []
    return
  }
  searching.value = true
  try {
    postResults.value = await searchPostBriefs(keyword.value.trim())
  } finally {
    searching.value = false
  }
}

async function selectPost(post: PostBrief) {
  selectedPost.value = post
  backlinksLoading.value = true
  backlinks.value = []
  outgoingLinks.value = []
  outgoingUnresolved.value = []
  try {
    const [backlinksResult, outgoingResult] = await Promise.all([
      fetchBacklinks(post.name),
      fetchOutgoing(post.name),
    ])
    backlinks.value = backlinksResult.data.items ?? []
    outgoingLinks.value = outgoingResult.data.spec?.outgoingLinks ?? []
    outgoingUnresolved.value = outgoingResult.data.spec?.unresolvedLinks ?? []
  } catch {
    // Post may not have a WikiLink entry yet.
  } finally {
    backlinksLoading.value = false
  }
}

async function reindex() {
  reindexing.value = true
  try {
    await reindexAll()
    pollTimer = setInterval(async () => {
      await loadSummary()
      if (summary.value && !summary.value.reindexing) {
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        reindexing.value = false
        await Promise.all([loadUnresolved(), reloadSelected()])
      }
    }, 1000)
  } catch {
    reindexing.value = false
  }
}

async function reloadSelected() {
  if (selectedPost.value) {
    await selectPost(selectedPost.value)
  }
}

onMounted(() => {
  loadSummary()
  loadUnresolved()
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}
</script>

<template>
  <div class="mx-4 mb-5 mt-3 flex flex-col gap-3">
    <VAlert type="info" title="如何在文章中使用双链" :closable="false">
      <template #description>
        <div class="flex flex-col gap-1 text-xs leading-5">
          <p class="m-0">
            在 Markdown 编辑器中使用 <code :class="codeClass">[[文章标题]]</code> 创建双链，支持
            <code :class="codeClass">[[文章标题|显示别名]]</code> 自定义链接文本，以及
            <code :class="codeClass">[[文章标题#小节标题]]</code> 定位到目标文章的小节。
          </p>
          <p class="m-0">
            注意：文章<strong>发布后</strong>才会建立双链索引；默认按标题匹配且不区分大小写（可在插件设置中调整）；
            未匹配到任何已发布文章的 <code :class="codeClass">[[ ]]</code> 会保留原文并计入「断链检测」。
          </p>
        </div>
      </template>
    </VAlert>

    <div class="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3.5">
      <div class="flex min-w-[110px] flex-col">
        <span class="text-xl font-bold">{{ summary?.wikilinkCount ?? 0 }}</span>
        <span class="text-xs text-gray-400">已索引文章</span>
      </div>
      <div class="flex min-w-[110px] flex-col">
        <span class="text-xl font-bold text-[#2ea886]">{{ summary?.resolvedCount ?? 0 }}</span>
        <span class="text-xs text-gray-400">已解析双链</span>
      </div>
      <div class="flex min-w-[110px] flex-col">
        <span class="text-xl font-bold text-[#e05a5a]">{{ summary?.unresolvedCount ?? 0 }}</span>
        <span class="text-xs text-gray-400">断链</span>
      </div>
      <div class="flex min-w-[110px] flex-col">
        <span class="text-sm font-medium leading-7">{{ formatDate(summary?.lastIndexedAt) }}</span>
        <span class="text-xs text-gray-400">最后索引时间</span>
      </div>
      <div v-if="summary?.reindexing" class="ml-auto self-center text-[13px] text-[#4cc2ba]">
        重建索引中 {{ summary.reindexProcessed }}/{{ summary.reindexTotal }}
      </div>
      <VButton class="ml-auto self-center" :loading="reindexing" type="secondary" size="sm" @click="reindex">
        <template #icon>
          <IconRefreshLine />
        </template>
        {{ reindexing ? '索引中…' : '重新索引' }}
      </VButton>
    </div>

    <VTabbar v-model:active-id="activeTab" :items="[
      { id: 'backlinks', label: '反向链接' },
      { id: 'broken', label: '断链检测' },
    ]" />

    <div v-if="activeTab === 'backlinks'">
      <VCard :body-class="['!p-0']">
        <div class="border-b border-gray-200 px-3.5 py-3">
          <FormKit v-model="keyword" type="text" :outer-class="['!mb-0']" placeholder="输入文章标题搜索，然后选择一篇文章查看其反向链接…" />
        </div>

        <VLoading v-if="searching" />
        <ul v-else-if="!selectedPost && postResults.length" class="m-0 max-h-60 list-none overflow-y-auto p-0 py-1">
          <li
            v-for="post in postResults"
            :key="post.name"
            class="cursor-pointer px-4 py-2.5 text-[13px] hover:bg-gray-100"
            @click="selectPost(post)"
          >
            {{ post.title }}
          </li>
        </ul>

        <div v-if="selectedPost" class="px-4 pb-4 pt-3">
          <div class="mb-2.5 flex items-center justify-between">
            <span class="text-[15px] font-semibold">{{ selectedPost.title }}</span>
            <VTag v-if="selectedPost.permalink" @click="selectedPost = null">切换文章</VTag>
          </div>

          <VLoading v-if="backlinksLoading" />

          <template v-else>
            <section class="mt-3.5">
              <h4 class="mb-2 mt-0 text-[13px] font-normal text-gray-600">反向链接（{{ backlinks.length }}）</h4>
              <VEmpty v-if="!backlinks.length" title="暂无反向链接" message="没有其他文章链接到本文。" />
              <ul v-else class="m-0 flex list-none flex-col gap-1.5 p-0">
                <li
                  v-for="item in backlinks"
                  :key="item.sourcePostName"
                  class="flex flex-col gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <span class="text-[13px] font-medium">{{ item.sourceTitle }}</span>
                  <span v-if="item.snippet" class="text-xs text-gray-400">{{ item.snippet }}</span>
                </li>
              </ul>
            </section>

            <section class="mt-3.5">
              <h4 class="mb-2 mt-0 text-[13px] font-normal text-gray-600">出链（{{ outgoingLinks.length }}）</h4>
              <VEmpty v-if="!outgoingLinks.length" title="暂无出链" message="本文没有解析成功的 [[双链]]。" />
              <ul v-else class="m-0 flex list-none flex-col gap-1.5 p-0">
                <li
                  v-for="(entry, index) in outgoingLinks"
                  :key="index"
                  class="flex flex-col gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <span class="text-[13px] font-medium">{{ entry.targetTitle }}</span>
                  <span v-if="entry.snippet" class="text-xs text-gray-400">{{ entry.snippet }}</span>
                </li>
              </ul>
            </section>

            <section v-if="outgoingUnresolved.length" class="mt-3.5">
              <h4 class="mb-2 mt-0 text-[13px] font-normal text-gray-600">未解析（{{ outgoingUnresolved.length }}）</h4>
              <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
                <li
                  v-for="(entry, index) in outgoingUnresolved"
                  :key="index"
                  class="flex flex-col gap-0.5 rounded-md border border-[rgba(224,90,90,0.35)] bg-gray-50 px-3 py-2"
                >
                  <span class="text-[13px] font-medium">[[{{ entry.targetTitle }}]]</span>
                  <span v-if="entry.snippet" class="text-xs text-gray-400">{{ entry.snippet }}</span>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </VCard>
    </div>

    <div v-else>
      <VAlert v-if="unresolved.length" type="warning" :closable="false" title="以下 [[双链]] 未解析到任何文章" />
      <BrokenLinksTable :items="unresolved" :loading="unresolvedLoading" />
    </div>
  </div>
</template>
