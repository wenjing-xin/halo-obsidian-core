<script setup lang="ts">
import { VAlert, VButton, VCard, VEmpty, VLoading, VTabbar } from '@halo-dev/components'
import { IconRefreshLine, IconDashboard, IconLink, IconErrorWarning } from '@halo-dev/components'
import { FormKit } from '@formkit/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import PostRelationList, { type RelationPostRow } from '../components/PostRelationList.vue'
import type { BacklinkItem, GraphSummary, UnresolvedItem } from '../shared/graph-renderer/types'

const activeTab = ref('backlinks')
const error = ref('')
let searchSeq = 0
let selectionSeq = 0

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

const searchRows = computed<RelationPostRow[]>(() =>
  postResults.value.map((post) => ({ ...post, key: post.name })),
)
const backlinkRows = computed<RelationPostRow[]>(() =>
  backlinks.value.map((item) => ({
    key: item.sourcePostName,
    name: item.sourcePostName,
    title: item.sourceTitle,
    permalink: item.sourcePermalink,
    snippet: item.snippet,
    status: 'backlink',
  })),
)
const outgoingRows = computed<RelationPostRow[]>(() =>
  outgoingLinks.value.map((item, index) => ({
    key: `${item.targetPostName}-${index}`,
    name: item.targetPostName,
    title: item.targetTitle,
    snippet: item.snippet,
    status: 'resolved',
  })),
)
const selectedBroken = computed<UnresolvedItem[]>(() =>
  outgoingUnresolved.value.map((item) => ({
    sourcePostName: selectedPost.value?.name || '',
    sourceTitle: selectedPost.value?.title || '',
    targetTitle: item.targetTitle,
    snippet: item.snippet || '',
  })),
)
function selectRow(row: RelationPostRow) {
  if (row.name)
    void selectPost({ name: row.name, title: row.title, permalink: row.permalink || undefined })
}

async function loadSummary() {
  try {
    summary.value = (await fetchSummary()).data
  } catch {
    error.value = '统计加载失败，请稍后重试'
  }
}

async function loadUnresolved() {
  unresolvedLoading.value = true
  try {
    unresolved.value = (await fetchUnresolvedLinks()).data
  } catch {
    error.value = '断链列表加载失败，请稍后重试'
  } finally {
    unresolvedLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, () => {
  searchSeq++
  selectionSeq++
  selectedPost.value = null
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(searchPosts, 300)
})

async function searchPosts() {
  if (!keyword.value.trim()) {
    postResults.value = []
    searching.value = false
    return
  }
  const seq = ++searchSeq
  searching.value = true
  error.value = ''
  try {
    const posts = await searchPostBriefs(keyword.value.trim())
    if (seq === searchSeq) postResults.value = posts
  } catch {
    if (seq === searchSeq) error.value = '文章搜索失败，请重试'
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

async function selectPost(post: PostBrief) {
  const seq = ++selectionSeq
  selectedPost.value = post
  error.value = ''
  backlinksLoading.value = true
  backlinks.value = []
  outgoingLinks.value = []
  outgoingUnresolved.value = []
  try {
    const [backlinksResult, outgoingResult] = await Promise.allSettled([
      fetchBacklinks(post.name),
      fetchOutgoing(post.name),
    ])
    if (seq !== selectionSeq) return
    if (backlinksResult.status === 'fulfilled')
      backlinks.value = backlinksResult.value.data.items ?? []
    else error.value = '反向链接加载失败，请重试'
    if (outgoingResult.status === 'fulfilled') {
      outgoingLinks.value = outgoingResult.value.data.spec?.outgoingLinks ?? []
      outgoingUnresolved.value = outgoingResult.value.data.spec?.unresolvedLinks ?? []
    } else if (outgoingResult.reason?.response?.status !== 404) {
      error.value = '出链加载失败，请重试'
    }
  } finally {
    if (seq === selectionSeq) backlinksLoading.value = false
  }
}

async function reindex() {
  if (pollTimer) clearInterval(pollTimer)
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
    error.value = '重建索引失败，请重试'
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
  searchSeq++
  selectionSeq++
  if (searchTimer) clearTimeout(searchTimer)
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
const statCards = computed(() => [
  {
    label: '已索引文章',
    value: summary.value?.wikilinkCount ?? '—',
    description: '已发布内容的双链索引',
    icon: IconDashboard,
    color: 'text-gray-900',
    background: 'bg-gray-100',
  },
  {
    label: '已解析双链',
    value: summary.value?.resolvedCount ?? '—',
    description: '已关联到目标文章',
    icon: IconLink,
    color: 'text-emerald-700',
    background: 'bg-emerald-50',
  },
  {
    label: '待修复双链',
    value: summary.value?.unresolvedCount ?? '—',
    description: '未匹配到已发布文章',
    icon: IconErrorWarning,
    color: 'text-amber-700',
    background: 'bg-amber-50',
  },
  {
    label: '最近同步',
    value: formatDate(summary.value?.lastIndexedAt),
    description: summary.value?.reindexing ? '索引重建中' : '文章变更后自动更新',
    icon: IconRefreshLine,
    color: 'text-gray-700',
    background: 'bg-gray-100',
    small: true,
  },
])
</script>

<template>
  <div class="m-2 flex flex-col gap-4 md:m-4">
    <VAlert v-if="error" type="error" :closable="false" :title="error" />
    <VAlert type="info" title="如何在文章中使用双链" :closable="false">
      <template #description>
        <div class="flex flex-col gap-1 text-xs leading-5">
          <p class="m-0">
            Markdown 用户：在「文章」列表的下拉菜单中点击<strong>复制双链标签</strong>，将复制的
            <code>obsidian-core-link</code> 标签直接粘贴到正文；不要放进代码块。
          </p>
          <p class="m-0">
            默认编辑器用户：通过「文章关联」选择目标文章。标签使用文章标识建立关系，不依赖标题；来源和目标文章发布后同步索引。
          </p>
        </div>
      </template>
    </VAlert>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <VCard
        v-for="card in statCards"
        :key="card.label"
        class="h-full min-w-0"
        :body-class="['!p-4']"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="m-0 text-xs font-medium text-gray-500">{{ card.label }}</p>
            <p
              :class="[
                'mb-1 mt-2 break-words font-semibold tabular-nums tracking-tight',
                card.small ? 'text-sm leading-7' : 'text-2xl',
                card.color,
              ]"
            >
              {{ card.value }}
            </p>
            <p class="m-0 text-xs text-gray-400">{{ card.description }}</p>
          </div>
          <span
            :class="[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              card.background,
              card.color,
            ]"
          >
            <component :is="card.icon" class="h-4 w-4" />
          </span>
        </div>
      </VCard>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="m-0 text-xs text-gray-500" role="status">
        {{
          summary?.reindexing
            ? `重建索引中 ${summary.reindexProcessed}/${summary.reindexTotal}`
            : '发布或更新文章后自动同步；历史数据可手动重新索引。'
        }}
      </p>
      <VButton
        :loading="reindexing || summary?.reindexing"
        type="secondary"
        size="sm"
        @click="reindex"
      >
        <template #icon><IconRefreshLine /></template>
        {{ reindexing ? '索引中…' : '重新索引' }}
      </VButton>
    </div>

    <VTabbar
      v-model:active-id="activeTab"
      :items="[
        { id: 'backlinks', label: '反向链接' },
        { id: 'broken', label: '断链检测' },
      ]"
    />

    <div v-if="activeTab === 'backlinks'">
      <VCard :body-class="['!p-0']">
        <template #header>
          <div class="w-full px-3.5 py-3">
            <FormKit
              v-model="keyword"
              type="text"
              :outer-class="['!mb-0']"
              placeholder="输入文章标题搜索，然后选择一篇文章查看其反向链接…"
            />
          </div>
        </template>

        <PostRelationList
          v-if="!selectedPost"
          :items="searchRows"
          :loading="searching"
          selectable
          :empty-title="keyword.trim() ? '未找到文章' : '选择一篇文章'"
          :empty-message="
            keyword.trim()
              ? '尝试其他标题关键词；索引仅包含已发布内容。'
              : '输入文章标题，查看其反向链接和出链。'
          "
          @select="selectRow"
        />
        <div v-if="selectedPost" class="pb-4 pt-3">
          <div class="mb-2.5 flex items-center justify-between px-4">
            <span class="text-[15px] font-semibold">{{ selectedPost.title }}</span>
            <VButton size="sm" @click="selectedPost = null">切换文章</VButton>
          </div>

          <VLoading v-if="backlinksLoading" />

          <template v-else>
            <section class="mt-3.5">
              <h4 class="mb-2 mt-0 px-4 text-[13px] font-normal text-gray-600">
                反向链接（{{ backlinks.length }}）
              </h4>
              <PostRelationList
                :items="backlinkRows"
                empty-title="暂无反向链接"
                empty-message="其他文章插入本文的双链标签后，会显示在这里。"
              />
            </section>
            <section class="mt-3.5">
              <h4 class="mb-2 mt-0 px-4 text-[13px] font-normal text-gray-600">
                出链（{{ outgoingLinks.length }}）
              </h4>
              <PostRelationList
                :items="outgoingRows"
                empty-title="暂无出链"
                empty-message="本文没有解析成功的双链标签。"
              />
            </section>
            <section v-if="selectedBroken.length" class="mt-3.5">
              <h4 class="mb-2 mt-0 px-4 text-[13px] font-normal text-gray-600">
                未解析（{{ selectedBroken.length }}）
              </h4>
              <BrokenLinksTable :items="selectedBroken" />
            </section>
          </template>
        </div>
      </VCard>
    </div>

    <div v-else>
      <VAlert
        v-if="unresolved.length"
        type="warning"
        :closable="false"
        title="以下关联尚未解析到目标文章，请检查目标是否已发布或已删除"
      />
      <VCard class="mt-3" :body-class="['!p-0']">
        <BrokenLinksTable :items="unresolved" :loading="unresolvedLoading" />
      </VCard>
    </div>
  </div>
</template>
