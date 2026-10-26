<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    dark?: boolean
    disabled?: boolean
    busy?: boolean
  }>(),
  { dark: false, disabled: false, busy: false },
)
const emit = defineEmits<{ activate: [] }>()
</script>

<template>
  <div
    v-tooltip="label"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    :aria-disabled="disabled"
    :aria-busy="busy"
    class="graph-action-icon"
    :class="{ 'is-dark': dark, 'is-disabled': disabled }"
    @click.stop="!disabled && emit('activate')"
    @keydown.enter.stop.prevent="!disabled && emit('activate')"
    @keydown.space.stop.prevent="!disabled && emit('activate')"
  >
    <slot />
  </div>
</template>

<style scoped>
.graph-action-icon {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: #f1f3f5;
  color: #68717d;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
.graph-action-icon:hover {
  background: #e5e9ee;
  color: #374151;
}
.graph-action-icon:focus-visible {
  outline: 2px solid #9ca3af;
  outline-offset: 2px;
}
.graph-action-icon.is-dark {
  background: #ffffff0d;
  color: #b8bec8;
}
.graph-action-icon.is-dark:hover {
  background: #ffffff18;
  color: #f3f4f6;
}
.graph-action-icon.is-disabled {
  cursor: default;
  opacity: 0.45;
}
.graph-action-icon :deep(svg) {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
</style>
