<script setup lang="ts">
import { VAlert, VCard, VEmpty, VLoading, VModal } from '@halo-dev/components'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  fetchCategoryOptions,
  fetchConsoleGraph,
  fetchSummary,
  fetchTagOptions,
  reindexAll,
} from '../api/obsidian'
import type { TaxonomyOption } from '../api/obsidian'
import ObsidianGraphCanvas from '../components/ObsidianGraphCanvas.vue'
import GraphToolbar from '../components/GraphToolbar.vue'
import NodeDetailPanel from '../components/NodeDetailPanel.vue'
import BacklinksModal from '../components/BacklinksModal.vue'
import type { GraphNode, GraphPayload } from '../shared/graph-renderer/types'

const canvasRef = ref<InstanceType<typeof ObsidianGraphCanvas> | null>(null)

const payload = ref<GraphPayload | null>(null)
const loading = ref(false)
const error = ref('')

const selected = ref<GraphNode | null>(null)
const backlinksTarget = ref<{ name: string; title: string } | null>(null)
const enlarged = ref(false)

const categoryOptions = ref<TaxonomyOption[]>([])
const tagOptions = ref<TaxonomyOption[]>([])

const filters = reactive({
  keyword: '',
  selectedCategories: [] as string[],
  selectedTags: [] as string[],
  showBroken: true,
  showTaxonomy: true,
  expandParents: false,
})

const visual = reactive({
  dark: false,
  showLabels: true,
  showArrows: false,
  showCategories: true,
  showTags: true,
})

const summary = ref<Awaited<ReturnType<typeof fetchSummary>>['data'] | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await fetchConsoleGraph({
      keyword: filters.keyword,
      category: filters.selectedCategories,
      tag: filters.selectedTags,
      showBroken: filters.showBroken,
      showTaxonomy: filters.showTaxonomy,
      expandParents: filters.expandParents,
    })
    payload.value = data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '图谱加载失败'
  } finally {
    loading.value = false
  }
}

async function loadFilterOptions() {
  try {
    const [categories, tags] = await Promise.all([fetchCategoryOptions(), fetchTagOptions()])
    categoryOptions.value = categories
    tagOptions.value = tags
  } catch {
    // Filter options are optional; the graph still works without them.
  }
}

async function loadSummary() {
  try {
    summary.value = (await fetchSummary()).data
  } catch {
    // ignore
  }
}

function toggleCategory(name: string) {
  const index = filters.selectedCategories.indexOf(name)
  if (index >= 0) {
    filters.selectedCategories.splice(index, 1)
  } else {
    filters.selectedCategories.push(name)
  }
}

function toggleTag(name: string) {
  const index = filters.selectedTags.indexOf(name)
  if (index >= 0) {
    filters.selectedTags.splice(index, 1)
  } else {
    filters.selectedTags.push(name)
  }
}

function clearFilters() {
  filters.keyword = ''
  filters.selectedCategories = []
  filters.selectedTags = []
}

const reindexing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

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
        await load()
      }
    }, 1000)
  } catch {
    reindexing.value = false
  }
}

function onSelect(node: GraphNode | null) {
  selected.value = node
}

function viewBacklinks(node: GraphNode) {
  backlinksTarget.value = { name: node.id, title: node.title }
}

function openPost(node: GraphNode) {
  if (node.permalink) {
    window.open(node.permalink, '_blank', 'noopener')
  }
}

function zoom(factor: number) {
  canvasRef.value?.zoomBy(factor)
}

function resetView() {
  canvasRef.value?.resetViewport()
}

onMounted(() => {
  load()
  loadFilterOptions()
  loadSummary()
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<template>
  <div class="graph-view">
    <GraphToolbar
      v-model:keyword="filters.keyword"
      :category-options="categoryOptions"
      :tag-options="tagOptions"
      :selected-categories="filters.selectedCategories"
      :selected-tags="filters.selectedTags"
      v-model:show-broken="filters.showBroken"
      v-model:show-taxonomy="filters.showTaxonomy"
      v-model:expand-parents="filters.expandParents"
      v-model:dark="visual.dark"
      v-model:show-labels="visual.showLabels"
      v-model:show-arrows="visual.showArrows"
      v-model:show-categories="visual.showCategories"
      v-model:show-tags="visual.showTags"
      :reindexing="reindexing"
      @toggle-category="toggleCategory"
      @toggle-tag="toggleTag"
      @clear-filters="clearFilters"
      @reindex="reindex"
      @zoom="zoom"
      @reset-view="resetView"
      @enlarge="enlarged = true"
    />

    <VAlert
      v-if="error"
      class="graph-view__alert"
      type="error"
      :title="error"
      :closable="false"
    />

    <VCard class="graph-view__card" :body-class="['!p-0']">
      <div class="graph-view__stage">
        <VLoading v-if="loading && !payload" class="graph-view__loading" />
        <VEmpty
          v-else-if="payload && !payload.nodes.length"
          class="graph-view__empty"
          title="暂无图谱数据"
          message="发布包含 [[双链]] 的文章后，这里会展示关系图谱。"
        />
        <ObsidianGraphCanvas
          ref="canvasRef"
          :payload="payload"
          :dark="visual.dark"
          :show-labels="visual.showLabels"
          :show-arrows="visual.showArrows"
          :show-categories="visual.showCategories"
          :show-tags="visual.showTags"
          :highlight="filters.keyword"
          @select="onSelect"
        />
        <div v-if="payload?.truncated" class="graph-view__truncated">
          节点较多，已截断展示。可使用筛选或调大设置中的节点上限。
        </div>
        <NodeDetailPanel
          :node="selected"
          @close="selected = null"
          @view-backlinks="viewBacklinks"
          @open-post="openPost"
        />
      </div>
    </VCard>

    <VModal
      :visible="enlarged"
      :width="1200"
      title="关系图谱"
      @close="enlarged = false"
    >
      <div class="graph-view__modal-stage">
        <ObsidianGraphCanvas
          :payload="payload"
          :dark="visual.dark"
          :show-labels="visual.showLabels"
          :show-arrows="visual.showArrows"
          :show-categories="visual.showCategories"
          :show-tags="visual.showTags"
          :highlight="filters.keyword"
          @select="onSelect"
        />
        <div v-if="payload?.truncated" class="graph-view__truncated">
          节点较多，已截断展示。可使用筛选或调大设置中的节点上限。
        </div>
      </div>
    </VModal>

    <BacklinksModal
      :post-name="backlinksTarget?.name ?? null"
      :post-title="backlinksTarget?.title"
      @close="backlinksTarget = null"
    />
  </div>
</template>

<style scoped>
.graph-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 5rem);
}

.graph-view__alert {
  margin: 0;
}

.graph-view__card {
  flex: 1;
  min-height: 360px;
  overflow: hidden;
}

.graph-view__card:deep(.card-wrapper),
.graph-view__card:deep(.card-body) {
  height: 100%;
}

.graph-view__card:deep(.card-body) {
  overflow: hidden;
}

.graph-view__stage {
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
}

.graph-view__modal-stage {
  position: relative;
  height: 75vh;
  overflow: hidden;
  border-radius: 8px;
}

.graph-view__loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(128, 128, 128, 0.12);
}

.graph-view__empty {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
}

.graph-view__truncated {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(24, 26, 31, 0.85);
  color: #ffc46b;
  font-size: 12px;
}
</style>
