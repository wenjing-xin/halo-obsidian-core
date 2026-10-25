<script setup lang="ts">
  import { VButton, VDropdown, VDropdownItem, VSpace, IconSearch } from '@halo-dev/components'
  import type { TaxonomyOption } from '../api/obsidian'

  const props = defineProps<{
    keyword: string
    categoryOptions: TaxonomyOption[]
    tagOptions: TaxonomyOption[]
    selectedCategories: string[]
    selectedTags: string[]
    showBroken: boolean
    showTaxonomy: boolean
    expandParents: boolean
    showLabels: boolean
    showArrows: boolean
    showCategories: boolean
    showTags: boolean
    reindexing: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:keyword', value: string): void
    (e: 'toggle-category', name: string): void
    (e: 'toggle-tag', name: string): void
    (e: 'clear-filters'): void
    (e: 'update:showBroken', value: boolean): void
    (e: 'update:showTaxonomy', value: boolean): void
    (e: 'update:expandParents', value: boolean): void
    (e: 'update:showLabels', value: boolean): void
    (e: 'update:showArrows', value: boolean): void
    (e: 'update:showCategories', value: boolean): void
    (e: 'update:showTags', value: boolean): void
    (e: 'reindex'): void
    (e: 'zoom', factor: number): void
    (e: 'reset-view'): void
  }>()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function onKeywordInput(event: Event) {
    const value = (event.target as HTMLInputElement).value
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => emit('update:keyword', value), 300)
  }

  function hasFilters(props_: typeof props) {
    return (
      props_.selectedCategories.length > 0
      || props_.selectedTags.length > 0
      || props_.keyword.trim() !== ''
    )
  }
</script>

<template>
  <div class="graph-toolbar">
    <div class="graph-toolbar__search">
      <IconSearch />
      <input :value="keyword" type="text" placeholder="搜索文章标题…" @input="onKeywordInput" />
    </div>

    <VDropdown>
      <VButton size="sm">
        分类{{ selectedCategories.length ? ` (${selectedCategories.length})` : '' }}
      </VButton>
      <template #popper>
        <div class="graph-toolbar__filter-panel">
          <VDropdownItem v-for="option in categoryOptions" :key="option.name"
            @click="emit('toggle-category', option.name)">
            <span class="graph-toolbar__check"
              :class="{ 'graph-toolbar__check--on': selectedCategories.includes(option.name) }">
              {{ selectedCategories.includes(option.name) ? '✓' : '' }}
            </span>
            {{ option.displayName }}
          </VDropdownItem>
          <div v-if="!categoryOptions.length" class="graph-toolbar__empty">暂无分类</div>
        </div>
      </template>
    </VDropdown>

    <VDropdown>
      <VButton size="sm">
        标签{{ selectedTags.length ? ` (${selectedTags.length})` : '' }}
      </VButton>
      <template #popper>
        <div class="graph-toolbar__filter-panel">
          <VDropdownItem v-for="option in tagOptions" :key="option.name" @click="emit('toggle-tag', option.name)">
            <span class="graph-toolbar__check"
              :class="{ 'graph-toolbar__check--on': selectedTags.includes(option.name) }">
              {{ selectedTags.includes(option.name) ? '✓' : '' }}
            </span>
            {{ option.displayName }}
          </VDropdownItem>
          <div v-if="!tagOptions.length" class="graph-toolbar__empty">暂无标签</div>
        </div>
      </template>
    </VDropdown>

    <VButton v-if="hasFilters(props)" size="sm" @click="emit('clear-filters')">清除筛选</VButton>

    <div class="graph-toolbar__spacer" />

    <div class="graph-toolbar__toggles">
      <label>
        <input type="checkbox" :checked="showBroken"
          @change="emit('update:showBroken', ($event.target as HTMLInputElement).checked)" />
        断链
      </label>
      <label>
        <input type="checkbox" :checked="showTaxonomy"
          @change="emit('update:showTaxonomy', ($event.target as HTMLInputElement).checked)" />
        分类层级
      </label>
      <label>
        <input type="checkbox" :checked="expandParents"
          @change="emit('update:expandParents', ($event.target as HTMLInputElement).checked)" />
        展开父级分类
      </label>
      <label>
        <input type="checkbox" :checked="showCategories"
          @change="emit('update:showCategories', ($event.target as HTMLInputElement).checked)" />
        分类节点
      </label>
      <label>
        <input type="checkbox" :checked="showTags"
          @change="emit('update:showTags', ($event.target as HTMLInputElement).checked)" />
        标签节点
      </label>
      <label>
        <input type="checkbox" :checked="showLabels"
          @change="emit('update:showLabels', ($event.target as HTMLInputElement).checked)" />
        显示标签
      </label>
      <label>
        <input type="checkbox" :checked="showArrows"
          @change="emit('update:showArrows', ($event.target as HTMLInputElement).checked)" />
        箭头
      </label>
    </div>

    <div class="graph-toolbar__spacer" />

    <VSpace>
      <VButton size="sm" @click="emit('zoom', 1.25)">+</VButton>
      <VButton size="sm" @click="emit('zoom', 0.8)">−</VButton>
      <VButton size="sm" @click="emit('reset-view')">重置视图</VButton>
      <VButton size="sm" :loading="reindexing" @click="emit('reindex')">
        {{ reindexing ? '索引中…' : '重新索引' }}
      </VButton>
    </VSpace>
  </div>
</template>

<style scoped>
.graph-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-bg-3, #e8e8ec);
  background: var(--color-bg-1, #fff);
}

.graph-toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 32px;
  min-width: 200px;
  border: 1px solid var(--color-border, #dcdfe4);
  border-radius: 6px;
  background: var(--color-bg-2, #fafafa);
}

.graph-toolbar__search input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  width: 100%;
}

.graph-toolbar__spacer {
  flex: 1;
}

.graph-toolbar__toggles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-2, #4b5563);
}

.graph-toolbar__toggles label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}

.graph-toolbar__filter-panel {
  max-height: 280px;
  min-width: 180px;
  overflow-y: auto;
  padding: 4px 0;
}

.graph-toolbar__check {
  display: inline-block;
  width: 16px;
  color: #4cc2ba;
}

.graph-toolbar__check--on {
  font-weight: 600;
}

.graph-toolbar__empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-3, #9ca3af);
}
</style>
