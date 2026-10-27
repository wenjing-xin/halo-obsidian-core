<script setup lang="ts">
  import { computed } from 'vue'

  const props = withDefaults(
    defineProps<{
      label: string
      dark?: boolean
      disabled?: boolean
      busy?: boolean
      /** Transparent background, for icons stacked inside a vertical pill bar. */
      bare?: boolean
    }>(),
    { dark: false, disabled: false, busy: false, bare: false },
  )
  const emit = defineEmits<{ activate: [] }>()

  const btnClass = computed(() => {
    const base =
      'inline-flex h-8 w-8 flex-none items-center justify-center rounded-full p-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:flex-none'
    const tone = props.bare
      ? props.dark
        ? 'bg-transparent text-gray-300 hover:bg-white/10 hover:text-gray-100'
        : 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      : props.dark
        ? 'bg-white/5 text-[#b8bec8] hover:bg-white/[0.09] hover:text-gray-100'
        : 'bg-[#f1f3f5] text-[#68717d] hover:bg-[#e5e9ee] hover:text-gray-700'
    const state = props.disabled ? 'cursor-default opacity-45' : 'cursor-pointer'
    return [base, tone, state]
  })
</script>

<template>
  <div
    v-tooltip="label"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    :aria-disabled="disabled"
    :aria-busy="busy"
    :class="btnClass"
    @click.stop="!disabled && emit('activate')"
    @keydown.enter.stop.prevent="!disabled && emit('activate')"
    @keydown.space.stop.prevent="!disabled && emit('activate')"
  >
    <slot />
  </div>
</template>
