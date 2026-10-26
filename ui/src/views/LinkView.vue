<script setup lang="ts">
  import {
    VAlert,
    VButton,
    VCard,
    VEmpty,
    VLoading,
    VPageHeader,
    VTabbar,
    VTag,
  } from '@halo-dev/components'
  import { IconLink, IconRefreshLine } from '@halo-dev/components'
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
  <VPageHeader title="双链管理">
    <template #icon>
      <IconLink />
    </template>
    <template #actions>
      <VButton :loading="reindexing" type="secondary" @click="reindex">
        <template #icon>
          <IconRefreshLine />
        </template>
        {{ reindexing ? '索引中…' : '重新索引' }}
      </VButton>
    </template>
  </VPageHeader>

  <div class="link-view">
    <div class="link-view__summary">
      <div class="link-view__stat">
        <span class="link-view__stat-value">{{ summary?.wikilinkCount ?? 0 }}</span>
        <span class="link-view__stat-label">已索引文章</span>
      </div>
      <div class="link-view__stat">
        <span class="link-view__stat-value link-view__stat-value--ok">
          {{ summary?.resolvedCount ?? 0 }}
        </span>
        <span class="link-view__stat-label">已解析双链</span>
      </div>
      <div class="link-view__stat">
        <span class="link-view__stat-value link-view__stat-value--bad">
          {{ summary?.unresolvedCount ?? 0 }}
        </span>
        <span class="link-view__stat-label">断链</span>
      </div>
      <div class="link-view__stat">
        <span class="link-view__stat-value link-view__stat-value--time">
          {{ formatDate(summary?.lastIndexedAt) }}
        </span>
        <span class="link-view__stat-label">最后索引时间</span>
      </div>
      <div v-if="summary?.reindexing" class="link-view__progress">
        重建索引中 {{ summary.reindexProcessed }}/{{ summary.reindexTotal }}
      </div>
    </div>

    <VTabbar v-model:active-id="activeTab" :items="[
      { id: 'backlinks', label: '反向链接' },
      { id: 'broken', label: '断链检测' },
    ]" />

    <div v-if="activeTab === 'backlinks'" class="link-view__backlinks">
      <VCard :body-class="['!p-0']">
        <div class="link-view__search">
          <FormKit v-model="keyword" type="text" :outer-class="['!mb-0']" placeholder="输入文章标题搜索，然后选择一篇文章查看其反向链接…" />
        </div>

        <VLoading v-if="searching" />
        <ul v-else-if="!selectedPost && postResults.length" class="link-view__results">
          <li v-for="post in postResults" :key="post.name" class="link-view__result" @click="selectPost(post)">
            {{ post.title }}
          </li>
        </ul>

        <div v-if="selectedPost" class="link-view__detail">
          <div class="link-view__detail-head">
            <span class="link-view__detail-title">{{ selectedPost.title }}</span>
            <VTag v-if="selectedPost.permalink" @click="selectedPost = null">切换文章</VTag>
          </div>

          <VLoading v-if="backlinksLoading" />

          <template v-else>
            <section class="link-view__section">
              <h4>反向链接（{{ backlinks.length }}）</h4>
              <VEmpty v-if="!backlinks.length" title="暂无反向链接" message="没有其他文章链接到本文。" />
              <ul v-else class="link-view__links">
                <li v-for="item in backlinks" :key="item.sourcePostName">
                  <span class="link-view__link-title">{{ item.sourceTitle }}</span>
                  <span v-if="item.snippet" class="link-view__link-snippet">{{ item.snippet }}</span>
                </li>
              </ul>
            </section>

            <section class="link-view__section">
              <h4>出链（{{ outgoingLinks.length }}）</h4>
              <VEmpty v-if="!outgoingLinks.length" title="暂无出链" message="本文没有解析成功的 [[双链]]。" />
              <ul v-else class="link-view__links">
                <li v-for="(entry, index) in outgoingLinks" :key="index">
                  <span class="link-view__link-title">{{ entry.targetTitle }}</span>
                  <span v-if="entry.snippet" class="link-view__link-snippet">{{ entry.snippet }}</span>
                </li>
              </ul>
            </section>

            <section v-if="outgoingUnresolved.length" class="link-view__section">
              <h4>未解析（{{ outgoingUnresolved.length }}）</h4>
              <ul class="link-view__links">
                <li v-for="(entry, index) in outgoingUnresolved" :key="index" class="link-view__link-broken">
                  <span class="link-view__link-title">[[{{ entry.targetTitle }}]]</span>
                  <span v-if="entry.snippet" class="link-view__link-snippet">{{ entry.snippet }}</span>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </VCard>
    </div>

    <div v-else class="link-view__broken">
      <VAlert v-if="unresolved.length" type="warning" :closable="false" title="以下 [[双链]] 未解析到任何文章" />
      <BrokenLinksTable :items="unresolved" :loading="unresolvedLoading" />
    </div>
  </div>
</template>

<style scoped>
.link-view {
  margin: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-view__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: var(--color-bg-1, #fff);
}

.link-view__stat {
  display: flex;
  flex-direction: column;
  min-width: 110px;
}

.link-view__stat-value {
  font-size: 20px;
  font-weight: 700;
}

.link-view__stat-value--ok {
  color: #2ea886;
}

.link-view__stat-value--bad {
  color: #e05a5a;
}

.link-view__stat-value--time {
  font-size: 14px;
  font-weight: 500;
  line-height: 28px;
}

.link-view__stat-label {
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
}

.link-view__progress {
  align-self: center;
  margin-left: auto;
  color: #4cc2ba;
  font-size: 13px;
}

.link-view__search {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.link-view__search input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #dcdfe4);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.link-view__results {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 240px;
  overflow-y: auto;
}

.link-view__result {
  padding: 9px 16px;
  font-size: 13px;
  cursor: pointer;
}

.link-view__result:hover {
  background: var(--color-bg-3, #f4f4f6);
}

.link-view__detail {
  padding: 12px 16px 16px;
}

.link-view__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.link-view__detail-title {
  font-size: 15px;
  font-weight: 600;
}

.link-view__section {
  margin-top: 14px;
}

.link-view__section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-text-2, #4b5563);
}

.link-view__links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-view__links li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-bg-2, #fafafa);
}

.link-view__link-broken {
  border-color: rgba(224, 90, 90, 0.35);
}

.link-view__link-title {
  font-size: 13px;
  font-weight: 500;
}

.link-view__link-snippet {
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
}
</style>
