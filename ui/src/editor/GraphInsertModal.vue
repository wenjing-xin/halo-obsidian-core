<script setup lang="ts">
import { VButton, VModal } from '@halo-dev/components'
import { ref, watch } from 'vue'
import { searchPostBriefs, type PostBrief } from '../api/obsidian'

export interface GraphAttrs {
  mode: 'full' | 'local' | 'nodes'
  post: string
  nodes: string
  depth: number
  dark: boolean
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
const dark = ref(true)

const keyword = ref('')
const results = ref<PostBrief[]>([])
const searching = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      return
    }
    mode.value = props.initial?.mode ?? 'full'
    post.value = props.initial?.post ?? ''
    nodes.value = props.initial?.nodes ?? ''
    depth.value = props.initial?.depth ?? 1
    dark.value = props.initial?.dark ?? true
    keyword.value = ''
    results.value = []
  }
)

function onKeywordInput(event: Event) {
  keyword.value = (event.target as HTMLInputElement).value
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(search, 300)
}

async function search() {
  if (!keyword.value.trim()) {
    results.value = []
    return
  }
  searching.value = true
  try {
    results.value = await searchPostBriefs(keyword.value.trim())
  } finally {
    searching.value = false
  }
}

function selectPost(candidate: PostBrief) {
  post.value = candidate.name
  keyword.value = candidate.title
  results.value = []
}

function confirm() {
  emit('confirm', {
    mode: mode.value,
    post: post.value.trim(),
    nodes: nodes.value.trim(),
    depth: Math.min(Math.max(depth.value || 1, 1), 5),
    dark: dark.value,
  })
}
</script>

<template>
  <VModal :visible="visible" :width="520" title="知识图谱" @close="emit('close')">
    <div class="graph-modal">
      <div class="graph-modal__field">
        <label>展示模式</label>
        <select v-model="mode">
          <option value="full">全站图谱</option>
          <option value="local">局部图谱（以一篇文章为中心）</option>
          <option value="nodes">指定文章</option>
        </select>
      </div>

      <div v-if="mode === 'local'" class="graph-modal__field">
        <label>中心文章</label>
        <input :value="keyword" type="text" placeholder="搜索并选择一篇文章…" @input="onKeywordInput" />
        <p v-if="post" class="graph-modal__meta">已选择：{{ post }}</p>
        <ul v-if="results.length" class="graph-modal__results">
          <li v-for="candidate in results" :key="candidate.name" @click="selectPost(candidate)">
            {{ candidate.title }}
          </li>
        </ul>
      </div>

      <div v-if="mode === 'nodes'" class="graph-modal__field">
        <label>文章（Post Name，英文逗号分隔）</label>
        <textarea v-model="nodes" rows="3" placeholder="post-a,post-b,post-c" />
      </div>

      <div v-if="mode !== 'full'" class="graph-modal__field">
        <label>展开深度（{{ depth }}）</label>
        <input v-model.number="depth" type="range" min="1" max="5" />
      </div>

      <div class="graph-modal__field graph-modal__field--inline">
        <label>
          <input v-model="dark" type="checkbox" />
          使用深色主题（Obsidian 风格）
        </label>
      </div>
    </div>
    <template #footer>
      <VButton @click="emit('close')">取消</VButton>
      <VButton type="secondary" @click="confirm">确定</VButton>
    </template>
  </VModal>
</template>

<style scoped>
.graph-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.graph-modal__field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-text-2, #4b5563);
}

.graph-modal__field--inline label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.graph-modal__field input[type='text'],
.graph-modal__field select,
.graph-modal__field textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--color-border, #dcdfe4);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
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
