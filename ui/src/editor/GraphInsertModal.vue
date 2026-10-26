<script setup lang="ts">
import { VAlert, VButton, VModal, VLoading } from '@halo-dev/components'
import { FormKit } from '@formkit/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchPostBriefs, type PostBrief } from '../api/obsidian'
import { normalizeTheme, type ThemeMode } from '../shared/graph-renderer/theme-controller'

export interface GraphAttrs {
  mode: 'full' | 'local' | 'nodes'
  post: string
  nodes: string
  depth: number
  theme: ThemeMode
  dark?: boolean | null
}

const props = defineProps<{
  visible: boolean
  initial?: Partial<GraphAttrs>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', attrs: GraphAttrs): void
}>()

const mode = ref<'full' | 'local' | 'nodes'>('full')
const post = ref('')
const nodes = ref('')
const depth = ref(1)
const theme = ref<ThemeMode>('auto')
const center = ref<'current' | 'selected'>('current')
const searchError = ref('')
const selectedNodes = computed(() =>
  nodes.value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
)
const valid = computed(
  () =>
    mode.value === 'full' ||
    (mode.value === 'local'
      ? center.value === 'current' || !!post.value
      : selectedNodes.value.length > 0),
)
let searchSequence = 0

const keyword = ref('')
const results = ref<PostBrief[]>([])
const searching = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      searchSequence++
      if (searchTimer) clearTimeout(searchTimer)
      searching.value = false
      return
    }
    mode.value = props.initial?.mode ?? 'full'
    post.value = props.initial?.post ?? ''
    nodes.value = props.initial?.nodes ?? ''
    depth.value = props.initial?.depth ?? 1
    theme.value = normalizeTheme(props.initial?.theme, props.initial?.dark)
    center.value = post.value ? 'selected' : 'current'
    searchError.value = ''
    searchSequence++
    keyword.value = ''
    results.value = []
  },
  { immediate: true },
)

watch(keyword, () => {
  searchSequence++
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(search, 300)
})

async function search() {
  if (!keyword.value.trim()) {
    results.value = []
    searching.value = false
    return
  }
  const sequence = ++searchSequence
  searching.value = true
  searchError.value = ''
  try {
    const found = await searchPostBriefs(keyword.value.trim())
    if (sequence === searchSequence) results.value = found
  } catch {
    if (sequence === searchSequence) searchError.value = '文章检索失败，请重试'
  } finally {
    if (sequence === searchSequence) searching.value = false
  }
}

function selectPost(candidate: PostBrief) {
  if (mode.value === 'nodes') {
    nodes.value = [...new Set([...selectedNodes.value, candidate.name])].join(',')
  } else {
    post.value = candidate.name
  }
  results.value = []
  keyword.value = ''
}

function confirm() {
  if (!valid.value) return
  emit('confirm', {
    mode: mode.value,
    post: mode.value === 'local' && center.value === 'selected' ? post.value.trim() : '',
    nodes: mode.value === 'nodes' ? [...new Set(selectedNodes.value)].join(',') : '',
    depth: Math.min(Math.max(Number(depth.value) || 1, 1), 5),
    theme: theme.value,
    dark: null,
  })
}
onBeforeUnmount(() => {
  searchSequence++
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <VModal :visible="visible" :width="520" title="关系图谱" @close="emit('close')">
    <div class="graph-modal">
      <div class="graph-modal__field">
        <label class="graph-modal__label">展示模式</label>
        <FormKit
          v-model="mode"
          type="select"
          :outer-class="['!mb-0']"
          :options="[
            { label: '全站图谱', value: 'full' },
            { label: '围绕文章的局部图谱', value: 'local' },
            { label: '指定文章集合的局部图谱', value: 'nodes' },
          ]"
        />
      </div>

      <div v-if="mode === 'local'" class="graph-modal__field">
        <FormKit
          v-model="center"
          type="select"
          label="中心文章"
          :options="[
            { label: '当前文章（发布时自动绑定）', value: 'current' },
            { label: '指定另一篇文章', value: 'selected' },
          ]"
        />
        <p v-if="center === 'current'" class="graph-modal__meta">
          围绕嵌入此图谱的文章展示入链与出链，不会退回全站图谱。
        </p>
      </div>
      <div
        v-if="mode === 'nodes' || (mode === 'local' && center === 'selected')"
        class="graph-modal__field"
      >
        <FormKit
          v-model="keyword"
          type="text"
          label="搜索文章"
          placeholder="输入标题，点击文章选择…"
          :outer-class="['!mb-0']"
        />
        <VLoading v-if="searching" />
        <p v-if="searchError" role="alert">{{ searchError }}</p>
        <ul v-if="results.length" class="graph-modal__results">
          <li v-for="candidate in results" :key="candidate.name">
            <button
              type="button"
              class="w-full border-0 bg-transparent text-left cursor-pointer"
              @click="selectPost(candidate)"
            >
              {{ candidate.title }}
            </button>
          </li>
        </ul>
        <p v-if="mode === 'local' && post" class="graph-modal__meta">已选择：{{ post }}</p>
        <template v-if="mode === 'nodes'">
          <p class="graph-modal__meta">
            已选 {{ selectedNodes.length }} 篇；仅展示所选文章之间的关系。
          </p>
          <FormKit
            v-model="nodes"
            type="textarea"
            label="所选文章标识（可编辑，逗号分隔）"
            :rows="2"
          />
        </template>
      </div>

      <div v-if="mode === 'local'" class="graph-modal__field">
        <label class="graph-modal__label">展开深度（{{ depth }}）</label>
        <FormKit
          v-model="depth"
          type="range"
          :min="1"
          :max="5"
          :number="true"
          :outer-class="['!mb-0']"
        />
      </div>

      <FormKit
        v-model="theme"
        type="select"
        label="图谱主题"
        :options="[
          { label: '跟随文章主题（自动）', value: 'auto' },
          { label: '明亮', value: 'light' },
          { label: '暗黑', value: 'dark' },
        ]"
      />
      <VAlert
        v-if="!valid"
        type="info"
        :closable="false"
        title="请选择中心文章或至少一篇局部图谱文章"
      />
    </div>
    <template #footer>
      <VButton @click="emit('close')">取消</VButton>
      <VButton type="secondary" :disabled="!valid" @click="confirm">确定</VButton>
    </template>
  </VModal>
</template>

<style scoped>
.graph-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.graph-modal__label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-text-2, #4b5563);
}

.graph-modal__label--inline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  cursor: pointer;
}

.graph-modal__meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
}

.graph-modal__results {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
}

.graph-modal__results li {
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}

.graph-modal__results li:hover {
  background: var(--color-bg-3, #f4f4f6);
}
</style>
