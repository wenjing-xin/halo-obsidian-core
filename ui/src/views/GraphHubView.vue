<script setup lang="ts">
  import { IconGitBranch, VCard, VPageHeader, VTabbar } from '@halo-dev/components'
  import { ref } from 'vue'
  import GraphView from './GraphView.vue'
  import LinkView from './LinkView.vue'

  const activeTab = ref('graph')

  const tabs = [
    { id: 'graph', label: '关系图谱' },
    { id: 'links', label: '双链管理' },
  ]
</script>

<template>
  <VPageHeader title="关系图谱">
    <template #icon>
      <IconGitBranch />
    </template>
  </VPageHeader>
  <VCard class="md:m-4" :body-class="['!p-1']">
    <template #header>
      <VTabbar v-model:active-id="activeTab" :items="tabs" type="outline" class="w-full" />
    </template>
    <KeepAlive>
      <GraphView v-if="activeTab === 'graph'" />
      <LinkView v-else />
    </KeepAlive>
  </VCard>
</template>
