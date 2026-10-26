<script setup lang="ts">
import { IconRefreshLine, VAlert, VEmpty, VLoading, VModal, VSwitch } from '@halo-dev/components'
import IconPlayLine from '~icons/ri/play-line'
import IconSettingsLine from '~icons/ri/settings-3-line'
import IconFullscreenLine from '~icons/ri/fullscreen-line'
import IconCloseLine from '~icons/ri/close-line'
import IconAddLine from '~icons/ri/add-line'
import IconSubtractLine from '~icons/ri/subtract-line'
import GraphActionIcon from '../components/GraphActionIcon.vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  fetchCategoryOptions,
  fetchConsoleGraph,
  fetchSummary,
  fetchTagOptions,
  reindexAll,
} from '../api/obsidian'
import type { TaxonomyOption } from '../api/obsidian'
import ObsidianGraphCanvas from '../components/ObsidianGraphCanvas.vue'
import NodeDetailPanel from '../components/NodeDetailPanel.vue'
import BacklinksModal from '../components/BacklinksModal.vue'
import type { GraphNode, GraphPayload } from '../shared/graph-renderer/types'

const canvasRef = ref<InstanceType<typeof ObsidianGraphCanvas> | null>(null)
const modalCanvasRef = ref<InstanceType<typeof ObsidianGraphCanvas> | null>(null)

const payload = ref<GraphPayload | null>(null)
const loading = ref(false)
const error = ref('')

const selected = ref<GraphNode | null>(null)
const backlinksTarget = ref<{ name: string; title: string } | null>(null)
const enlarged = ref(false)
const panelOpen = ref(false)
const sections = reactive({ filters: true, display: true, forces: true })

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
  showGroups: false,
})

// Appearance sliders (Obsidian "外观" section), stored in slider units.
const appearance = reactive({
  textFade: 100,
  nodeSize: 100,
  lineThickness: 100,
})

// Force sliders (Obsidian "力度" section), stored in slider units.
const forceSliders = reactive({
  center: 30,
  repel: 22,
  link: 50,
  distance: 55,
})

const textFade = computed(() => Number(appearance.textFade) / 100)
const nodeSize = computed(() => Number(appearance.nodeSize) / 100)
const lineThickness = computed(() => Number(appearance.lineThickness) / 100)
const forceOptions = computed(() => ({
  center: (Number(forceSliders.center) / 100) * 0.5,
  repel: 0.5 + (Number(forceSliders.repel) / 100) * 7.5,
  link: (Number(forceSliders.link) / 100) * 2,
  distance: Number(forceSliders.distance),
}))

const categorySelectOptions = computed(() =>
  categoryOptions.value.map((option) => ({ label: option.displayName, value: option.name })),
)
const tagSelectOptions = computed(() =>
  tagOptions.value.map((option) => ({ label: option.displayName, value: option.name })),
)

const hasFilters = computed(
  () =>
    filters.selectedCategories.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.keyword.trim() !== '',
)

const summary = ref<Awaited<ReturnType<typeof fetchSummary>>['data'] | null>(null)

// ---------------------------------------------------------------------------
// UnoCSS class groups (light/dark aware)
// ---------------------------------------------------------------------------

const panelClass = computed(() => [
  'absolute bottom-3 right-3 top-3 z-[5] flex w-[264px] flex-col overflow-hidden rounded-[10px] border shadow-lg backdrop-blur-lg',
  visual.dark
    ? 'border-white/10 bg-neutral-900/90 shadow-black/40'
    : 'border-slate-900/[0.08] bg-white/90 shadow-slate-900/[0.08]',
])

const sectionClass = computed(() => [
  'border-t',
  visual.dark ? 'border-white/[0.08]' : 'border-slate-900/[0.07]',
])

const sectionHeaderClass = computed(() => [
  'flex w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 py-2.5 text-left text-[13px] font-semibold',
  visual.dark ? 'text-gray-200' : 'text-gray-800',
])

const sectionBodyClass = computed(() => [
  'flex flex-col gap-2 px-3 pb-3 text-xs',
  visual.dark ? 'text-gray-400' : 'text-gray-600',
])

const emptyClass = computed(() => [
  'absolute inset-0 z-[2] flex items-center justify-center',
  visual.dark ? 'bg-neutral-800/90' : 'bg-white/90',
])

function chevronClass(open: boolean) {
  return ['h-3 w-3 text-gray-400 transition-transform duration-200', open ? 'rotate-90' : '']
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

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

let filterTimer: ReturnType<typeof setTimeout> | null = null

watch(
  filters,
  () => {
    if (filterTimer) {
      clearTimeout(filterTimer)
    }
    filterTimer = setTimeout(() => {
      load()
    }, 300)
  },
  { deep: true },
)

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

function clearFilters() {
  filters.keyword = ''
  filters.selectedCategories = []
  filters.selectedTags = []
}

const reindexing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function reindex() {
  if (reindexing.value) return
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

function replay() {
  canvasRef.value?.replay()
  modalCanvasRef.value?.replay()
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
  if (filterTimer) {
    clearTimeout(filterTimer)
  }
})
</script>

<template>
  <div class="flex h-[calc(100vh-9rem)] flex-col">
    <VAlert v-if="error" class="mx-3 mt-3 shrink-0" type="error" :title="error" :closable="false" />

    <div class="relative min-h-[360px] flex-1 overflow-hidden">
      <VLoading v-if="loading && !payload" class="absolute inset-0 z-[2] bg-gray-500/[0.12]" />
      <VEmpty
        v-else-if="payload && !payload.nodes.length"
        :class="emptyClass"
        title="暂无图谱数据"
        message="发布包含双链标签的文章后，这里会展示关系图谱。"
      />
      <ObsidianGraphCanvas
        ref="canvasRef"
        :payload="payload"
        :dark="visual.dark"
        :show-labels="visual.showLabels"
        :show-arrows="visual.showArrows"
        :show-categories="visual.showCategories"
        :show-tags="visual.showTags"
        :show-groups="visual.showGroups"
        :highlight="filters.keyword"
        :text-fade="textFade"
        :node-size="nodeSize"
        :line-thickness="lineThickness"
        :forces="forceOptions"
        @select="onSelect"
      />
      <div
        v-if="payload?.truncated"
        class="absolute bottom-3 left-3 z-[3] rounded-md bg-[rgba(24,26,31,0.85)] px-2.5 py-1.5 text-xs text-[#ffc46b]"
      >
        节点较多，已截断展示。可使用筛选或调大设置中的节点上限。
      </div>

      <div v-if="!panelOpen" class="absolute right-3 top-3 z-[5] flex flex-col items-end gap-2">
        <GraphActionIcon
          :label="reindexing ? '正在重建双链索引' : '重新索引并刷新图谱'"
          :dark="visual.dark"
          :disabled="reindexing"
          :busy="reindexing"
          @activate="reindex"
        >
          <IconRefreshLine :class="{ 'animate-spin': reindexing }" />
        </GraphActionIcon>
        <GraphActionIcon
          label="图谱设置"
          :dark="visual.dark"
          :aria-expanded="panelOpen"
          @activate="panelOpen = true"
          ><IconSettingsLine
        /></GraphActionIcon>
        <GraphActionIcon label="放大图谱" :dark="visual.dark" @activate="enlarged = true"
          ><IconFullscreenLine
        /></GraphActionIcon>
        <GraphActionIcon label="播放关系图谱生成动画" :dark="visual.dark" @activate="replay"
          ><IconPlayLine
        /></GraphActionIcon>
      </div>

      <aside v-else :class="panelClass">
        <div class="flex items-center justify-end gap-1.5 px-2.5 pb-1 pt-2">
          <GraphActionIcon
            :label="reindexing ? '正在重建双链索引' : '重新索引并刷新图谱'"
            :dark="visual.dark"
            :disabled="reindexing"
            :busy="reindexing"
            @activate="reindex"
            ><IconRefreshLine :class="{ 'animate-spin': reindexing }"
          /></GraphActionIcon>
          <GraphActionIcon label="放大图谱" :dark="visual.dark" @activate="enlarged = true"
            ><IconFullscreenLine
          /></GraphActionIcon>
          <GraphActionIcon label="收起面板" :dark="visual.dark" @activate="panelOpen = false"
            ><IconCloseLine
          /></GraphActionIcon>
        </div>

        <div class="flex-1 overflow-y-auto pb-2.5">
          <section :class="sectionClass">
            <button
              type="button"
              :class="sectionHeaderClass"
              @click="sections.filters = !sections.filters"
            >
              <svg
                :class="chevronClass(sections.filters)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              <span>筛选</span>
            </button>
            <div v-show="sections.filters" :class="sectionBodyClass">
              <FormKit
                v-model="filters.keyword"
                type="text"
                placeholder="搜索文件…"
                :outer-class="['!mb-0']"
              />
              <FormKit
                v-if="categorySelectOptions.length"
                v-model="filters.selectedCategories"
                type="select"
                multiple
                label="分类"
                :options="categorySelectOptions"
              />
              <FormKit
                v-if="tagSelectOptions.length"
                v-model="filters.selectedTags"
                type="select"
                multiple
                label="标签"
                :options="tagSelectOptions"
              />
              <div class="flex items-center justify-between gap-2">
                <span>标签节点</span>
                <VSwitch v-model="visual.showTags" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>分类节点</span>
                <VSwitch v-model="visual.showCategories" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>仅显示已创建的笔记</span>
                <VSwitch
                  :model-value="!filters.showBroken"
                  @update:model-value="(value: boolean) => (filters.showBroken = !value)"
                />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>分类层级</span>
                <VSwitch v-model="filters.showTaxonomy" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>展开父级分类</span>
                <VSwitch v-model="filters.expandParents" />
              </div>
              <button
                v-if="hasFilters"
                type="button"
                class="cursor-pointer self-start border-0 bg-transparent p-0 text-xs text-[#4cc2ba] hover:underline"
                @click="clearFilters"
              >
                清除筛选
              </button>
            </div>
          </section>

          <section :class="sectionClass">
            <button
              type="button"
              :class="sectionHeaderClass"
              @click="sections.display = !sections.display"
            >
              <svg
                :class="chevronClass(sections.display)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              <span>外观</span>
            </button>
            <div v-show="sections.display" :class="sectionBodyClass">
              <div class="flex items-center justify-between gap-2">
                <span>深色背景</span>
                <VSwitch v-model="visual.dark" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>箭头</span>
                <VSwitch v-model="visual.showArrows" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>显示标签</span>
                <VSwitch v-model="visual.showLabels" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <span>分组颜色</span><VSwitch v-model="visual.showGroups" />
              </div>
              <FormKit
                v-model="appearance.textFade"
                type="range"
                min="0"
                max="100"
                step="1"
                label="文本透明度"
              />
              <FormKit
                v-model="appearance.nodeSize"
                type="range"
                min="40"
                max="200"
                step="1"
                label="节点大小"
              />
              <FormKit
                v-model="appearance.lineThickness"
                type="range"
                min="30"
                max="250"
                step="1"
                label="连线粗细"
              />
              <GraphActionIcon label="播放关系图谱生成动画" :dark="visual.dark" @activate="replay"
                ><IconPlayLine
              /></GraphActionIcon>
            </div>
          </section>

          <section :class="sectionClass">
            <button
              type="button"
              :class="sectionHeaderClass"
              @click="sections.forces = !sections.forces"
            >
              <svg
                :class="chevronClass(sections.forces)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              <span>力度</span>
            </button>
            <div v-show="sections.forces" :class="sectionBodyClass">
              <FormKit
                v-model="forceSliders.center"
                type="range"
                min="0"
                max="100"
                step="1"
                label="图谱向心力"
              />
              <FormKit
                v-model="forceSliders.repel"
                type="range"
                min="0"
                max="100"
                step="1"
                label="节点间的排斥力"
              />
              <FormKit
                v-model="forceSliders.link"
                type="range"
                min="0"
                max="100"
                step="1"
                label="相连节点间的吸引力"
              />
              <FormKit
                v-model="forceSliders.distance"
                type="range"
                min="20"
                max="120"
                step="1"
                label="连线长度"
              />
            </div>
          </section>
        </div>
      </aside>

      <div
        class="absolute bottom-3 z-[4] flex flex-col gap-1.5"
        :class="panelOpen ? 'right-[288px]' : 'right-3'"
      >
        <GraphActionIcon label="放大" :dark="visual.dark" @activate="zoom(1.25)"
          ><IconAddLine
        /></GraphActionIcon>
        <GraphActionIcon label="缩小" :dark="visual.dark" @activate="zoom(0.8)"
          ><IconSubtractLine
        /></GraphActionIcon>
        <GraphActionIcon label="重置视图" :dark="visual.dark" @activate="resetView"
          ><IconRefreshLine
        /></GraphActionIcon>
      </div>

      <NodeDetailPanel
        :node="selected"
        @close="selected = null"
        @view-backlinks="viewBacklinks"
        @open-post="openPost"
      />
    </div>

    <VModal :visible="enlarged" :width="1200" title="关系图谱" @close="enlarged = false">
      <div class="relative h-[75vh] overflow-hidden rounded-lg">
        <ObsidianGraphCanvas
          ref="modalCanvasRef"
          :payload="payload"
          :dark="visual.dark"
          :show-labels="visual.showLabels"
          :show-arrows="visual.showArrows"
          :show-categories="visual.showCategories"
          :show-tags="visual.showTags"
          :show-groups="visual.showGroups"
          :highlight="filters.keyword"
          :text-fade="textFade"
          :node-size="nodeSize"
          :line-thickness="lineThickness"
          :forces="forceOptions"
          @select="onSelect"
        />
      </div>
    </VModal>

    <BacklinksModal
      :post-name="backlinksTarget?.name ?? null"
      :post-title="backlinksTarget?.title"
      @close="backlinksTarget = null"
    />
  </div>
</template>
